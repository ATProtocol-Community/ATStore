#!/usr/bin/env node
/**
 * Batch-probe every `store_listings.external_url` for OAuth / authorization metadata
 * (same logic as `pnpm oauth:detect-scopes`) and upsert into `store_listing_oauth_probes`.
 *
 * Railway cron (suggested): weekly is enough for slow-changing OAuth metadata; avoids
 * hammering third-party sites. Example crontab UTC:
 *
 *   `30 7 * * 0`  → Sundays 07:30 UTC
 *
 * Daily gentle alternative: `45 6 * * *` (06:45 UTC every day).
 *
 * Env:
 *   DATABASE_URL                                      (required)
 *   LISTING_OAUTH_PROBE_CONCURRENCY=4                 (parallel probes)
 *   LISTING_OAUTH_PROBE_LIMIT=                        (optional max rows)
 *   LISTING_OAUTH_PROBE_PROGRESS_EVERY=25
 *
 * CLI (override env): --concurrency=N --limit=N --progress-every=N --dry-run
 */
import "dotenv/config";
import * as schema from "#/db/schema";
import { probeOAuthListingAuth } from "#/lib/oauth-listing-auth-probe";
import { asc, isNotNull } from "drizzle-orm";

function ts(): string {
  return new Date().toISOString();
}

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
) {
  const base = `[sync-listing-oauth-probes] ${ts()} [${level}] ${msg}`;
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

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function omitPk<T extends { storeListingId: string }>(
  payload: T,
): Omit<T, "storeListingId"> {
  const { storeListingId: _sid, ...rest } = payload;
  void _sid;
  return rest;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    log("error", "DATABASE_URL is required.");
    process.exit(1);
  }

  const dryRun = hasFlag("dry-run");
  const concurrency = readPositiveInt(
    "concurrency",
    "LISTING_OAUTH_PROBE_CONCURRENCY",
    4,
  );
  const limit = readOptionalPositiveInt("limit", "LISTING_OAUTH_PROBE_LIMIT");
  const progressEvery = readPositiveInt(
    "progress-every",
    "LISTING_OAUTH_PROBE_PROGRESS_EVERY",
    25,
  );

  const { db, dbClient } = await import("#/db/index.server");

  const baseQuery = db
    .select({
      id: schema.storeListings.id,
      slug: schema.storeListings.slug,
      externalUrl: schema.storeListings.externalUrl,
    })
    .from(schema.storeListings)
    .where(isNotNull(schema.storeListings.externalUrl))
    .orderBy(
      asc(schema.storeListings.slug),
      asc(schema.storeListings.createdAt),
    );

  const rows =
    limit === undefined ? await baseQuery : await baseQuery.limit(limit);

  const total = rows.length;

  log("info", "startup", {
    total,
    concurrency,
    dryRun,
    limit: limit ?? null,
  });

  if (total === 0) {
    log("info", "nothing_to_do");
    await dbClient.end({ timeout: 5 }).catch(() => {});
    return;
  }

  let cursor = 0;
  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function persistSkipped(listing: {
    id: string;
    slug: string;
  }): Promise<void> {
    if (dryRun) return;
    const now = new Date();
    const payload = {
      storeListingId: listing.id,
      slug: listing.slug,
      status: "skipped_no_url",
      probeError: null as string | null,
      probedUrl: null as string | null,
      probedAt: now,
      oauthScopesDistinct: [] as Array<string>,
      transitionalScopes: [] as Array<string>,
      publishesAtprotoScope: null as boolean | null,
      clientScopeRawLine: null as string | null,
      clientScopeSyntaxOk: null as boolean | null,
      hasProtectedResourceMetadata: false,
      hasAuthorizationServerMetadata: false,
      successfulClientMetadataUrl: null as string | null,
      reportJson: null,
      updatedAt: now,
    };

    await db
      .insert(schema.storeListingOAuthProbes)
      .values(payload)
      .onConflictDoUpdate({
        target: schema.storeListingOAuthProbes.storeListingId,
        set: omitPk(payload),
      });
  }

  async function persistCompleted(
    listing: { id: string; slug: string },
    report: Awaited<ReturnType<typeof probeOAuthListingAuth>>,
  ): Promise<void> {
    if (dryRun) return;
    const successfulClientUrl = report.clientMetadata.find(
      (c) => c.result.ok,
    )?.url;

    const now = new Date();
    const payload = {
      storeListingId: listing.id,
      slug: listing.slug,
      status: "completed",
      probeError: null as string | null,
      probedUrl: report.inputUrl,
      probedAt: now,
      oauthScopesDistinct: report.summary.oauthScopesDistinct,
      transitionalScopes: report.summary.transitionalScopesPresent,
      publishesAtprotoScope: report.summary.publishesAtprotoAs,
      clientScopeRawLine: report.summary.clientScopeRawLine,
      clientScopeSyntaxOk: report.summary.clientScopeSyntaxOk,
      hasProtectedResourceMetadata: Boolean(report.protectedResource.raw),
      hasAuthorizationServerMetadata: report.authorizationServersDetail.some(
        (r) => r.result.ok,
      ),
      successfulClientMetadataUrl: successfulClientUrl ?? null,
      reportJson: report,
      updatedAt: now,
    };

    await db
      .insert(schema.storeListingOAuthProbes)
      .values(payload)
      .onConflictDoUpdate({
        target: schema.storeListingOAuthProbes.storeListingId,
        set: omitPk(payload),
      });
  }

  async function persistError(
    listing: { id: string; slug: string },
    rawUrl: string | null,
    message: string,
  ): Promise<void> {
    if (dryRun) return;
    const now = new Date();
    const payload = {
      storeListingId: listing.id,
      slug: listing.slug,
      status: "error",
      probeError: message,
      probedUrl: rawUrl,
      probedAt: now,
      oauthScopesDistinct: [] as Array<string>,
      transitionalScopes: [] as Array<string>,
      publishesAtprotoScope: null as boolean | null,
      clientScopeRawLine: null as string | null,
      clientScopeSyntaxOk: null as boolean | null,
      hasProtectedResourceMetadata: false,
      hasAuthorizationServerMetadata: false,
      successfulClientMetadataUrl: null as string | null,
      reportJson: null,
      updatedAt: now,
    };

    await db
      .insert(schema.storeListingOAuthProbes)
      .values(payload)
      .onConflictDoUpdate({
        target: schema.storeListingOAuthProbes.storeListingId,
        set: omitPk(payload),
      });
  }

  async function worker(workerId: number) {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const row = rows[i];
      if (!row) return;

      const trimmed = row.externalUrl?.trim() ?? "";
      if (!trimmed) {
        await persistSkipped(row);
        done++;
        continue;
      }

      try {
        const report = await probeOAuthListingAuth(trimmed);
        await persistCompleted(row, report);
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        log("warn", "probe_failed", {
          workerId,
          listingId: row.id,
          slug: row.slug,
          error: message,
        });
        await persistError(row, trimmed, message);
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
    succeeded: total - failed,
    failed,
    dryRun,
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
