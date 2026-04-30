#!/usr/bin/env node
/**
 * Jetstream consumer: subscribes to `app.bsky.feed.post`, matches mentions against
 * `store_listings`, persists `store_listing_mentions`, and updates trending scores.
 *
 * Env:
 *   DATABASE_URL=…                    (required)
 *   JETSTREAM_URL=…                  (default: wss://jetstream2.us-east.bsky.network/subscribe)
 *   JETSTREAM_CURSOR_BUFFER_SEC=5     (subtract from saved cursor on reconnect for overlap)
 *   JETSTREAM_VERBOSE=1             (extra ingest_processed lines for debugging)
 *   JETSTREAM_STATS_INTERVAL_SEC=60 (periodic summary line; set 0 to disable)
 *
 * Every time a post is tied to at least one directory listing, an [MATCH] line is logged (not gated on VERBOSE).
 */
import "dotenv/config";

import type { JetstreamIngestResult } from "#/lib/trending/jetstream-ingest";

import {
  getJetstreamCursor,
  ingestJetstreamCommitLine,
  loadListingMentionIndex,
  saveJetstreamCursor,
} from "#/lib/trending/jetstream-ingest";
import { WebSocket } from "ws";

function verbose() {
  const v = process.env.JETSTREAM_VERBOSE?.trim().toLowerCase();
  return v === "1" || v === "true";
}

function statsIntervalSec(): number {
  const raw = process.env.JETSTREAM_STATS_INTERVAL_SEC?.trim();
  if (raw === "0") return 0;
  if (!raw) return 60;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

function ts(): string {
  return new Date().toISOString();
}

function log(
  level: "info" | "warn" | "error" | "debug",
  msg: string,
  extra?: Record<string, unknown>,
) {
  const base = `[jetstream] ${ts()} [${level}] ${msg}`;
  const out = extra && Object.keys(extra).length > 0 ? [base, extra] : [base];
  if (level === "error") console.error(...out);
  else if (level === "warn") console.warn(...out);
  else console.log(...out);
}

function parseJetstreamTimeUs(line: string): number | null {
  try {
    const o = JSON.parse(line) as { time_us?: unknown };
    return typeof o.time_us === "number" && Number.isFinite(o.time_us)
      ? o.time_us
      : null;
  } catch {
    return null;
  }
}

function buildJetstreamUrl(cursor?: number): string {
  const raw =
    process.env.JETSTREAM_URL?.trim() ||
    "wss://jetstream2.us-east.bsky.network/subscribe";
  const u = new URL(raw.includes("://") ? raw : `wss://${raw}`);
  u.searchParams.append("wantedCollections", "app.bsky.feed.post");
  if (cursor != null && Number.isFinite(cursor)) {
    const bufSec = Number(process.env.JETSTREAM_CURSOR_BUFFER_SEC ?? "5");
    const bufUs = (Number.isFinite(bufSec) ? bufSec : 5) * 1_000_000;
    const c = Math.max(0, Math.floor(cursor - bufUs));
    u.searchParams.set("cursor", String(c));
  }
  return u.toString();
}

type Stats = {
  startedAt: number;
  messages: number;
  /** `ingestJetstreamCommitLine` returned null (invalid JSON / schema) */
  ingestParseFailures: number;
  nonCommitEvents: number;
  collectionFiltered: number;
  operationFiltered: number;
  unparsedPost: number;
  noListingMatch: number;
  /** create/update that wrote ≥1 mention row */
  upsertsWithMatches: number;
  deletesProcessed: number;
  cursorSaves: number;
  ingestErrors: number;
};

function createStats(): Stats {
  return {
    startedAt: Date.now(),
    messages: 0,
    ingestParseFailures: 0,
    nonCommitEvents: 0,
    collectionFiltered: 0,
    operationFiltered: 0,
    unparsedPost: 0,
    noListingMatch: 0,
    upsertsWithMatches: 0,
    deletesProcessed: 0,
    cursorSaves: 0,
    ingestErrors: 0,
  };
}

function applyIngestStats(stats: Stats, result: JetstreamIngestResult | null) {
  if (result === null) {
    stats.ingestParseFailures += 1;
    return;
  }
  const m = result.meta;
  const sr = m?.skipReason;
  if (sr === "non_commit_event") stats.nonCommitEvents += 1;
  else if (sr === "collection_filtered") stats.collectionFiltered += 1;
  else if (sr === "operation_filtered") stats.operationFiltered += 1;
  else if (sr === "unparsed_post") stats.unparsedPost += 1;
  else if (sr === "no_listing_match") stats.noListingMatch += 1;

  if (result.processed) {
    if (m?.operation === "delete") {
      stats.deletesProcessed += 1;
    } else if (
      (m?.operation === "create" || m?.operation === "update") &&
      (m?.listingMatches ?? 0) > 0
    ) {
      stats.upsertsWithMatches += 1;
    }
  }
}

/** Always-on when a post affects stored mentions — easy to grep (`MATCH`). */
function logDirectoryListingMatch(result: JetstreamIngestResult) {
  const m = result.meta;
  const n = m?.listingMatches ?? 0;
  if (!result.processed || n <= 0) return;
  const op =
    m?.operation === "delete"
      ? "removed mention row(s) (post deleted)"
      : "stored mention row(s) (post matched)";
  log("info", `MATCH · ${op} · ${String(n)} listing(s)`, {
    postUri: m?.postUri,
    operation: m?.operation,
    repoDid: m?.repoDid,
    listingCount: n,
    time_us: result.time_us,
  });
}

/** Verbose-only: processed events that did not emit a MATCH line (e.g. delete with no prior rows). */
function logVerboseIngest(result: JetstreamIngestResult) {
  if (!verbose() || !result.processed) return;
  const n = result.meta?.listingMatches ?? 0;
  if (n > 0) return;
  const m = result.meta;
  log("info", "ingest_processed_verbose", {
    time_us: result.time_us,
    postUri: m?.postUri,
    operation: m?.operation,
    repoDid: m?.repoDid,
    listingMatches: m?.listingMatches,
  });
}

function logStatsSummary(stats: Stats) {
  const elapsedSec = Math.max(
    1,
    Math.round((Date.now() - stats.startedAt) / 1000),
  );
  log("info", "stats", {
    elapsedSec,
    messages: stats.messages,
    msgsPerSec: Number((stats.messages / elapsedSec).toFixed(2)),
    ingestParseFailures: stats.ingestParseFailures,
    nonCommitEvents: stats.nonCommitEvents,
    collectionFiltered: stats.collectionFiltered,
    operationFiltered: stats.operationFiltered,
    unparsedPost: stats.unparsedPost,
    noListingMatch: stats.noListingMatch,
    upsertsWithMatches: stats.upsertsWithMatches,
    deletesProcessed: stats.deletesProcessed,
    cursorSaves: stats.cursorSaves,
    ingestErrors: stats.ingestErrors,
  });
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    log("error", "DATABASE_URL is required.");
    process.exit(1);
  }

  const { db } = await import("#/db/index.server");

  let index = await loadListingMentionIndex(db, true);
  const initialCursor = await getJetstreamCursor(db);
  log("info", "startup", {
    listingIndexSize: index.listings.length,
    savedCursorTimeUs: initialCursor ?? null,
    statsIntervalSec: statsIntervalSec(),
    verbose: verbose(),
  });

  setInterval(
    () => {
      void loadListingMentionIndex(db, true).then((i) => {
        index = i;
        log("info", "mention_index_reloaded", {
          listingCount: i.listings.length,
        });
      });
    },
    5 * 60 * 1000,
  );

  let lastCursor = initialCursor;
  let reconnectDelayMs = 2000;
  let shouldRun = true;
  const stats = createStats();

  const intervalSec = statsIntervalSec();
  let statsTimer: ReturnType<typeof setInterval> | undefined;
  if (intervalSec > 0) {
    statsTimer = setInterval(() => {
      logStatsSummary(stats);
    }, intervalSec * 1000);
    statsTimer.unref?.();
  }

  const connect = () => {
    const url = buildJetstreamUrl(lastCursor);
    log("info", "connecting", {
      url,
      resumeCursorTimeUs: lastCursor ?? null,
    });

    const ws = new WebSocket(url);

    ws.on("open", () => {
      reconnectDelayMs = 2000;
      log("info", "websocket_open", {
        resumeCursorTimeUs: lastCursor ?? null,
      });
    });

    ws.on("message", async (data: WebSocket.RawData) => {
      stats.messages += 1;
      const line =
        typeof data === "string"
          ? data
          : Buffer.from(data as Buffer).toString("utf8");
      const timeUs = parseJetstreamTimeUs(line);
      let result: JetstreamIngestResult | null = null;
      try {
        result = await ingestJetstreamCommitLine(db, line, index);
        applyIngestStats(stats, result);
        if (result) {
          logDirectoryListingMatch(result);
          logVerboseIngest(result);
        }
      } catch (error) {
        stats.ingestErrors += 1;
        log("error", "ingest_threw", {
          err: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          linePreview: line.length > 200 ? `${line.slice(0, 200)}…` : line,
        });
      }
      const cursorToSave = timeUs ?? result?.time_us ?? null;
      if (cursorToSave != null) {
        lastCursor = cursorToSave;
        await saveJetstreamCursor(db, cursorToSave);
        stats.cursorSaves += 1;
      } else if (result) {
        log("warn", "no_cursor_in_event", {
          processed: result.processed,
        });
      }
    });

    ws.on("close", (code, reason) => {
      const reasonStr =
        typeof reason === "string" ? reason : (reason?.toString?.() ?? "");
      log("warn", "websocket_closed", {
        code,
        reason: reasonStr || "(none)",
        reconnectInMs: reconnectDelayMs,
      });
      if (!shouldRun) return;
      setTimeout(() => {
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 120_000);
        connect();
      }, reconnectDelayMs);
    });

    ws.on("error", (err) => {
      log("error", "websocket_error", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  connect();

  const shutdown = () => {
    shouldRun = false;
    if (statsTimer) clearInterval(statsTimer);
    log("info", "shutdown", { finalStats: { ...stats } });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log("error", "fatal", {
    err: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
