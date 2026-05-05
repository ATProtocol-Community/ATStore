#!/usr/bin/env node
/**
 * Recompute `oauth_lexicon_hub_snapshot` from current probes (slow: resolves lexicon JSON).
 *
 *   pnpm listing:oauth-lexicon-hub-refresh
 */
import "dotenv/config";
import { refreshOAuthLexiconHubSnapshot } from "#/lib/oauth-lexicon-hub-snapshot.server";

function ts(): string {
  return new Date().toISOString();
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      `[refresh-oauth-lexicon-hub] ${ts()} DATABASE_URL is required`,
    );
    process.exit(1);
  }

  const { db, dbClient } = await import("#/db/index.server");
  try {
    const hub = await refreshOAuthLexiconHubSnapshot(db);
    console.log(
      `[refresh-oauth-lexicon-hub] ${ts()} clusterCount=${String(hub.clusterCount)} computedAt=${hub.computedAt.toISOString()}`,
    );
  } finally {
    await dbClient.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(
    `[refresh-oauth-lexicon-hub] fatal`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
