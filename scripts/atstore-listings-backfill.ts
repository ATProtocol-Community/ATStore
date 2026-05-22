#!/usr/bin/env node
/**
 * Bulk backfill `store_listings` from every `fyi.atstore.listing.detail` on the @store repo.
 *
 * Local Tap with `TAP_SIGNAL_COLLECTION` only discovers owner repos over the firehose; it does
 * not reliably mirror the full @store publisher catalog. Run this after `pnpm tap:consumer` setup
 * when Postgres is missing most directory rows.
 *
 *   pnpm listing:backfill-atstore
 *
 * Requires `DATABASE_URL`. Uses `ATSTORE_IDENTIFIER` + `ATSTORE_APP_PASSWORD` (or
 * `ATSTORE_REPO_DID`) like `listing:rehydrate-from-at-uri`.
 */
import "dotenv/config";

import {
  paginateListRecords,
  rkeyFromCollectionAtUri,
} from "#/lib/atproto/list-records";
import { COLLECTION } from "#/lib/atproto/nsids";
import {
  getAtstoreRepoDid,
} from "#/lib/atproto/publish-directory-listing";
import { resolveAtprotoPdsBaseUrl } from "#/lib/atproto/resolve-atproto-pds";
import {
  tryParseListingDetailRecord,
  upsertDirectoryListingFromTap,
} from "#/lib/atproto/tap-listing-sync";

import { db, dbClient } from "../src/db/index.server";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[atstore-listings-backfill] DATABASE_URL is required");
    process.exit(1);
  }

  const did = await getAtstoreRepoDid();
  const pds = await resolveAtprotoPdsBaseUrl(did);
  if (!pds) {
    console.error(
      `[atstore-listings-backfill] no PDS for ${did}; cannot listRecords`,
    );
    process.exit(1);
  }

  console.log(
    `[atstore-listings-backfill] listing.detail on ${did} via ${pds}…`,
  );

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for await (const row of paginateListRecords(
    pds,
    did,
    COLLECTION.listingDetail,
  )) {
    const rkey = rkeyFromCollectionAtUri(row.uri, COLLECTION.listingDetail);
    if (!rkey) {
      skipped++;
      continue;
    }
    const body = row.value as Record<string, unknown> | null | undefined;
    if (!body || typeof body !== "object") {
      skipped++;
      continue;
    }
    const parsed = tryParseListingDetailRecord(body);
    if (!parsed.ok) {
      console.warn(
        `[atstore-listings-backfill] skip rkey=${rkey}: ${parsed.stage} ${parsed.reason}`,
      );
      skipped++;
      continue;
    }
    try {
      await upsertDirectoryListingFromTap({
        db,
        did,
        rkey,
        record: parsed.record,
        trustedPublisher: true,
      });
      ok++;
      if (ok % 50 === 0) {
        console.log(`[atstore-listings-backfill] … ${String(ok)} upserted`);
      }
    } catch (error) {
      failed++;
      console.error(
        `[atstore-listings-backfill] failed rkey=${rkey} slug=${parsed.record.slug}`,
        error,
      );
    }
  }

  console.log(
    `[atstore-listings-backfill] done ok=${String(ok)} failed=${String(failed)} skipped=${String(skipped)}`,
  );
  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => dbClient.end({ timeout: 5 }));
