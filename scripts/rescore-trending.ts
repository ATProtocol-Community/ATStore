#!/usr/bin/env node
/**
 * Periodic trending re-score job. Iterates every store listing (oldest
 * `trending_updated_at` first) and calls `recomputeListingTrending`, so that
 * decayed signals (favorite half-life, mention half-life, rating recency,
 * favorite velocity) actually drift down for listings that have gone quiet.
 *
 * The reactive recompute path in `tap-favorite-sync` / `tap-review-sync` /
 * `jetstream-ingest` only fires when something happens to a listing, so without
 * this job a previously hot listing keeps its old score forever.
 *
 * Env:
 *   DATABASE_URL=…                              (required)
 *   TRENDING_RESCORE_CONCURRENCY=4              (parallel listings in flight)
 *   TRENDING_RESCORE_LIMIT=                     (optional max listings per run)
 *   TRENDING_RESCORE_PROGRESS_EVERY=100         (log every N completions)
 *
 * CLI flags (override env):
 *   --concurrency=<n>
 *   --limit=<n>
 *   --progress-every=<n>
 */
import "dotenv/config";
import * as schema from "#/db/schema";
import { recomputeListingTrending } from "#/lib/trending/recompute-listing-trending";
import { asc, sql } from "drizzle-orm";

function ts(): string {
  return new Date().toISOString();
}

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
) {
  const base = `[rescore-trending] ${ts()} [${level}] ${msg}`;
  const out = extra && Object.keys(extra).length > 0 ? [base, extra] : [base];
  if (level === "error") console.error(...out);
  else if (level === "warn") console.warn(...out);
  else console.log(...out);
}

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function readPositiveInt(
  flag: string,
  envKey: string,
  fallback: number,
): number {
  const raw = parseFlag(flag) ?? process.env[envKey];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readOptionalPositiveInt(
  flag: string,
  envKey: string,
): number | undefined {
  const raw = parseFlag(flag) ?? process.env[envKey];
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    log("error", "DATABASE_URL is required.");
    process.exit(1);
  }

  const concurrency = readPositiveInt(
    "concurrency",
    "TRENDING_RESCORE_CONCURRENCY",
    4,
  );
  const limit = readOptionalPositiveInt("limit", "TRENDING_RESCORE_LIMIT");
  const progressEvery = readPositiveInt(
    "progress-every",
    "TRENDING_RESCORE_PROGRESS_EVERY",
    100,
  );

  const { db, dbClient } = await import("#/db/index.server");

  const baseQuery = db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    // NULLS FIRST so listings that have never been scored are picked up first.
    .orderBy(
      sql`${schema.storeListings.trendingUpdatedAt} ASC NULLS FIRST`,
      asc(schema.storeListings.createdAt),
    );

  const rows = await (limit ? baseQuery.limit(limit) : baseQuery);
  const total = rows.length;

  log("info", "startup", {
    total,
    concurrency,
    limit: limit ?? null,
  });

  if (total === 0) {
    log("info", "nothing_to_do");
    return;
  }

  let cursor = 0;
  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function worker(workerId: number) {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const row = rows[i];
      if (!row) return;
      const id = row.id;
      try {
        await recomputeListingTrending(db, id);
      } catch (error) {
        failed++;
        log("warn", "recompute_failed", {
          workerId,
          listingId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      done++;
      if (done % progressEvery === 0 || done === total) {
        const elapsedMs = Date.now() - startedAt;
        const rate = done / Math.max(1, elapsedMs / 1000);
        log("info", "progress", {
          done,
          total,
          failed,
          ratePerSec: Number(rate.toFixed(2)),
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, (_, i) =>
    worker(i),
  );
  await Promise.all(workers);

  const elapsedMs = Date.now() - startedAt;
  log("info", "done", {
    total,
    succeeded: done - failed,
    failed,
    elapsedMs,
  });

  await dbClient.end({ timeout: 5 }).catch(() => {});
}

main().catch((error) => {
  log("error", "fatal", {
    error:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  process.exit(1);
});
