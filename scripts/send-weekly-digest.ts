#!/usr/bin/env node
/**
 * Send the weekly AT Store digest (new + trending apps) via comail to every user
 * who opted in and hasn't received one in the last ~6 days.
 */
// Railway cron (suggested): Mondays 14:00 UTC — `0 14 * * 1`, restart policy NEVER.
/**
 * Env:
 *   DATABASE_URL                       (required)
 *   COMAIL_DID / COMAIL_API_KEY        (required; comail sending account)
 *   COMAIL_FROM                        (required; e.g. digest@at.store)
 *   DIGEST_UNSUBSCRIBE_SECRET          (required in production; must match the web service)
 *   ATSTORE_WEBSITE_URL                (optional; link base, default https://at.store)
 *   COMAIL_FROM_NAME / DIGEST_MAX_PER_RUN / DIGEST_SEND_DELAY_MS   (optional)
 *
 * CLI:
 *   --dry-run   Build + render for every recipient; send nothing, stamp nothing
 */
import "dotenv/config";
import { runWeeklyDigest } from "#/server/digest/run";

const dryRun = process.argv.includes("--dry-run");
const startedAt = Date.now();
const { db, dbClient } = await import("#/db/index.server");

try {
  const summary = await runWeeklyDigest(db, { dryRun });
  console.info(
    `[digest] done in ${Date.now() - startedAt}ms: ${JSON.stringify(summary)}`,
  );
  await dbClient.end({ timeout: 5 }).catch(() => {});
  process.exit(0);
} catch (error) {
  console.error("[digest] send job failed:", error);
  await dbClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
