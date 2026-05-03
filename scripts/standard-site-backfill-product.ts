#!/usr/bin/env node
/**
 * One-off Standard.site ingest: `listRecords` for `site.standard.publication`
 * and `site.standard.document` on a product DID (or Bluesky handle).
 *
 * Usage:
 *   pnpm exec tsx -r dotenv/config scripts/standard-site-backfill-product.ts did:plc:...
 *   pnpm exec tsx -r dotenv/config scripts/standard-site-backfill-product.ts leaflet.pub
 *
 * Requires DATABASE_URL (same as tap consumer).
 */
import "dotenv/config";
import { backfillStandardSiteForProductDid } from "#/lib/atproto/standard-site-verify-backfill";
import { resolveBlueskyHandleToDid } from "#/lib/bluesky-public-profile";

import { db } from "../src/db/index.server";

async function main() {
  const raw = process.argv.slice(2).join(" ").trim();
  if (!raw) {
    console.error(
      "Usage: standard-site-backfill-product.ts <did:plc:...|handle.example.com>",
    );
    process.exit(1);
  }

  let did = raw.replace(/^@/, "");
  if (!did.startsWith("did:")) {
    const resolved = await resolveBlueskyHandleToDid(did);
    if (!resolved) {
      console.error(`Could not resolve handle to DID: ${did}`);
      process.exit(1);
    }
    did = resolved;
    console.log(`Resolved handle → ${did}`);
  }

  console.log(`Backfilling Standard.site for ${did}…`);
  await backfillStandardSiteForProductDid(db, did);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
