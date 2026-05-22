#!/usr/bin/env node
/**
 * Rebuild `store_listing_page_snapshots` for every public listing (slow: OAuth, funding, reviews).
 *
 *   pnpm listing:page-snapshots-refresh
 *   pnpm listing:page-snapshots-refresh -- --slug=murmul
 */
import "dotenv/config";

import { refreshListingPageSnapshot } from "#/lib/listing-page-snapshot";
import { and, asc, eq, isNotNull } from "drizzle-orm";

function ts(): string {
  return new Date().toISOString();
}

function slugArg(): string | null {
  const raw = process.argv.find((a) => a.startsWith("--slug="));
  if (!raw) return null;
  const value = raw.slice("--slug=".length).trim();
  return value.length > 0 ? value : null;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(`[refresh-listing-page-snapshots] ${ts()} DATABASE_URL is required`);
    process.exit(1);
  }

  const onlySlug = slugArg();
  const { db, dbClient } = await import("#/db/index.server");
  const schema = await import("#/db/schema");

  const rows = await db
    .select({ id: schema.storeListings.id, slug: schema.storeListings.slug })
    .from(schema.storeListings)
    .where(
      onlySlug
        ? and(
            eq(schema.storeListings.slug, onlySlug),
            isNotNull(schema.storeListings.slug),
          )
        : isNotNull(schema.storeListings.slug),
    )
    .orderBy(asc(schema.storeListings.slug));

  if (onlySlug && rows.length === 0) {
    console.error(
      `[refresh-listing-page-snapshots] ${ts()} no listing for slug=${onlySlug}`,
    );
    process.exit(1);
  }

  console.log(
    `[refresh-listing-page-snapshots] ${ts()} refreshing ${String(rows.length)} listing(s)…`,
  );

  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const row of rows) {
    try {
      await refreshListingPageSnapshot(db, row.id);
      ok++;
      if (ok % 25 === 0 || ok === rows.length) {
        console.log(
          `[refresh-listing-page-snapshots] ${ts()} progress ok=${String(ok)} failed=${String(failed)} slug=${row.slug ?? row.id}`,
        );
      }
    } catch (error) {
      failed++;
      const cause =
        error instanceof Error && "cause" in error && error.cause != null
          ? error.cause
          : null;
      console.warn(
        `[refresh-listing-page-snapshots] ${ts()} failed id=${row.id} slug=${row.slug ?? "?"}`,
        error instanceof Error ? (error.stack ?? error.message) : error,
        cause != null ? { cause } : undefined,
      );
      if (
        failed === 1 &&
        cause instanceof Error &&
        /store_listing_page_snapshots/i.test(cause.message) &&
        /does not exist|relation/i.test(cause.message)
      ) {
        console.error(
          `[refresh-listing-page-snapshots] ${ts()} table missing — run: pnpm db:migrate`,
        );
      }
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[refresh-listing-page-snapshots] ${ts()} done ok=${String(ok)} failed=${String(failed)} elapsedMs=${String(elapsedMs)}`,
  );

  await dbClient.end({ timeout: 5 }).catch(() => {});
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `[refresh-listing-page-snapshots] fatal`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
