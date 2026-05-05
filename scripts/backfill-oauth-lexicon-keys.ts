#!/usr/bin/env node
/**
 * Fills `store_listing_oauth_probes.oauth_lexicon_keys` from existing
 * `oauth_scopes_distinct` and expanded permission-set checklists in `report_json` (no HTTP).
 *
 *   pnpm exec tsx -r dotenv/config scripts/backfill-oauth-lexicon-keys.ts
 */
import "dotenv/config";
import * as schema from "#/db/schema";
import { refreshOAuthLexiconHubSnapshot } from "#/lib/oauth-lexicon-hub-snapshot.server";
import { extractOAuthLexiconKeysForStorefrontProbe } from "#/lib/oauth-scope-lexicon-keys";
import { eq } from "drizzle-orm";

function ts(): string {
  return new Date().toISOString();
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      `[backfill-oauth-lexicon-keys] ${ts()} DATABASE_URL is required`,
    );
    process.exit(1);
  }

  const { db, dbClient } = await import("#/db/index.server");
  const probes = schema.storeListingOAuthProbes;

  const rows = await db
    .select({
      storeListingId: probes.storeListingId,
      oauthScopesDistinct: probes.oauthScopesDistinct,
      oauthLexiconKeys: probes.oauthLexiconKeys,
      reportJson: probes.reportJson,
    })
    .from(probes);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const next = extractOAuthLexiconKeysForStorefrontProbe({
      oauthScopesDistinct: row.oauthScopesDistinct ?? [],
      scopeHumanReadable: row.reportJson?.summary?.scopeHumanReadable,
    });
    const prevSorted = [...row.oauthLexiconKeys].toSorted((a, b) =>
      a.localeCompare(b),
    );
    const same =
      next.length === prevSorted.length &&
      next.every((k, i) => k === prevSorted[i]);
    if (same) {
      skipped++;
      continue;
    }
    await db
      .update(probes)
      .set({ oauthLexiconKeys: next })
      .where(eq(probes.storeListingId, row.storeListingId));
    updated++;
  }

  console.log(
    `[backfill-oauth-lexicon-keys] ${ts()} rows=${String(rows.length)} updated=${String(updated)} skipped_unchanged=${String(skipped)}`,
  );

  try {
    const hub = await refreshOAuthLexiconHubSnapshot(db);
    console.log(
      `[backfill-oauth-lexicon-keys] ${ts()} oauth_lexicon_hub_snapshot clusterCount=${String(hub.clusterCount)}`,
    );
  } catch (error) {
    console.error(
      `[backfill-oauth-lexicon-keys] ${ts()} oauth_lexicon_hub_snapshot refresh failed`,
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
  }

  await dbClient.end({ timeout: 5 }).catch(() => {});
}

main().catch((error) => {
  console.error(
    `[backfill-oauth-lexicon-keys] fatal`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
