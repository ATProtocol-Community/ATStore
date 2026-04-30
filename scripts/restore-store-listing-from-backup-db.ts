#!/usr/bin/env node
/**
 * Copy one or more `store_listings` rows from a **restored backup database** into the live DB.
 *
 * Prerequisite: restore your `pg_dump -Fc` backup into a throwaway database first, e.g.
 *
 *   createdb at_store_restore
 *   pg_restore --no-owner --dbname=at_store_restore ./backups/at-store-YYYY-MM-DD.dump
 *
 * Then run (default match is “kich” on slug or name):
 *
 *   SOURCE_DATABASE_URL=postgresql://user:pass@localhost:5432/at_store_restore \
 *   pnpm listing:restore-from-backup-db kich
 *
 * Uses `DATABASE_URL` from `.env` as the live target (override with `TARGET_DATABASE_URL`).
 *
 * To (re)publish the listing to the AT Store PDS after the row exists in Postgres, run
 * `pnpm listing:publish-store kich` — Tap will ingest and refresh the mirror.
 *
 * If you still have an `at://…/fyi.atstore.listing.detail/…` URI on the network but no DB backup,
 * use `pnpm listing:rehydrate-from-at-uri <at-uri>` instead (rebuilds the mirror from the PDS).
 */
import "dotenv/config";
import postgres from "postgres";

type StoreListingRow = {
  id: string;
  source_url: string;
  name: string;
  slug: string;
  external_url: string | null;
  icon_url: string | null;
  screenshot_urls: Array<string>;
  tagline: string | null;
  full_description: string | null;
  category_slugs: Array<string>;
  app_tags: Array<string>;
  at_uri: string | null;
  repo_did: string | null;
  rkey: string | null;
  hero_image_url: string | null;
  verification_status: string;
  source_account_did: string | null;
  claimed_by_did: string | null;
  claimed_at: Date | null;
  product_account_did: string | null;
  product_account_handle: string | null;
  migrated_from_at_uri: string | null;
  claim_pending_for_did?: string | null;
  review_count: number;
  average_rating: number | null;
  created_at: Date;
  updated_at: Date;
};

const CONFLICT_UPDATE_COLUMNS = [
  "source_url",
  "name",
  "external_url",
  "icon_url",
  "screenshot_urls",
  "tagline",
  "full_description",
  "category_slugs",
  "app_tags",
  "at_uri",
  "repo_did",
  "rkey",
  "hero_image_url",
  "verification_status",
  "source_account_did",
  "claimed_by_did",
  "claimed_at",
  "product_account_did",
  "product_account_handle",
  "migrated_from_at_uri",
  "claim_pending_for_did",
  "review_count",
  "average_rating",
  "created_at",
  "updated_at",
] as const;

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  const targetUrl =
    process.env.TARGET_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  const pattern = (process.argv[2] ?? "kich").trim();
  if (!pattern) {
    console.error(
      "Usage: pnpm listing:restore-from-backup-db <slug-or-name-substring>",
    );
    process.exitCode = 1;
    return;
  }
  if (!sourceUrl) {
    console.error(
      "Set SOURCE_DATABASE_URL to the DB where you restored the backup.",
    );
    process.exitCode = 1;
    return;
  }
  if (!targetUrl) {
    console.error(
      "Set DATABASE_URL (or TARGET_DATABASE_URL) for the live database.",
    );
    process.exitCode = 1;
    return;
  }

  const source = postgres(sourceUrl, { prepare: false });
  const target = postgres(targetUrl, { prepare: false });

  const like = `%${pattern}%`;
  const rows = await source.unsafe<Array<StoreListingRow>>(
    `select * from store_listings
     where slug ilike $1 or name ilike $1
     order by slug
     limit 20`,
    [like],
  );

  if (rows.length === 0) {
    console.error(
      `No store_listings rows in SOURCE matching slug/name ILIKE ${like}`,
    );
    process.exitCode = 1;
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
    return;
  }

  const setClause = CONFLICT_UPDATE_COLUMNS.map(
    (c) => `${c} = excluded.${c}`,
  ).join(", ");

  for (const row of rows) {
    await target`
      insert into store_listings (
        id,
        source_url,
        name,
        slug,
        external_url,
        icon_url,
        screenshot_urls,
        tagline,
        full_description,
        category_slugs,
        app_tags,
        at_uri,
        repo_did,
        rkey,
        hero_image_url,
        verification_status,
        source_account_did,
        claimed_by_did,
        claimed_at,
        product_account_did,
        product_account_handle,
        migrated_from_at_uri,
        claim_pending_for_did,
        review_count,
        average_rating,
        created_at,
        updated_at
      )
      values (
        ${row.id}::uuid,
        ${row.source_url},
        ${row.name},
        ${row.slug},
        ${row.external_url},
        ${row.icon_url},
        ${row.screenshot_urls},
        ${row.tagline},
        ${row.full_description},
        ${row.category_slugs},
        ${row.app_tags},
        ${row.at_uri},
        ${row.repo_did},
        ${row.rkey},
        ${row.hero_image_url},
        ${row.verification_status},
        ${row.source_account_did},
        ${row.claimed_by_did},
        ${row.claimed_at},
        ${row.product_account_did},
        ${row.product_account_handle},
        ${row.migrated_from_at_uri},
        ${row.claim_pending_for_did ?? null},
        ${row.review_count},
        ${row.average_rating},
        ${row.created_at},
        ${row.updated_at}
      )
      on conflict (slug) do update set ${target.unsafe(setClause)}
    `;
    console.log(`Upserted store_listings slug=${row.slug} id=${row.id}`);
  }

  console.log(`Done (${rows.length} row(s)).`);
  await source.end({ timeout: 5 });
  await target.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
