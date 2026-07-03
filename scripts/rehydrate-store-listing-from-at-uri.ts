#!/usr/bin/env node
/**
 * Re-insert a `store_listings` mirror row by fetching `fyi.atstore.listing.detail` from the network.
 *
 * Use when Postgres lost the row but the ATProto record still exists (e.g. after a bad claim race).
 * This uses the same upsert path as Tap ingest; it does not write to any PDS.
 *
 *   pnpm listing:rehydrate-from-at-uri at://did:plc:…/fyi.atstore.listing.detail/…
 *
 * Requires `DATABASE_URL`. Fetches the record from the repo owner's PDS (via PLC/DID resolution).
 * Optional `ATSTORE_REPO_DID` (or `ATSTORE_IDENTIFIER` login) marks @store publisher rows as trusted.
 *
 * If the record was removed from all PDSes, restore from a DB backup instead:
 * `pnpm listing:restore-from-backup-db …`
 */
import "dotenv/config";

import { db, dbClient } from "../src/db/index.server";
import { parseAtUriParts } from "../src/lib/atproto/at-uri";
import { fetchRepoRecord } from "../src/lib/atproto/list-records";
import { COLLECTION } from "../src/lib/atproto/nsids";
import { getAtstoreRepoDid } from "../src/lib/atproto/publish-directory-listing";
import { resolveAtprotoPdsBaseUrl } from "../src/lib/atproto/resolve-atproto-pds";
import {
  tryParseListingDetailRecord,
  upsertDirectoryListingFromTap,
} from "../src/lib/atproto/tap-listing-sync";

async function main() {
  const raw = (process.argv[2] ?? "").trim();
  if (!raw.startsWith("at://")) {
    console.error(
      "Usage: pnpm listing:rehydrate-from-at-uri at://<did>/<collection>/<rkey>",
    );
    process.exitCode = 1;
    return;
  }

  let parts: { repo: string; collection: string; rkey: string };
  try {
    parts = parseAtUriParts(raw);
  } catch (error) {
    console.error("Invalid at-uri:", error);
    process.exitCode = 1;
    return;
  }

  if (parts.collection !== COLLECTION.listingDetail) {
    console.error(
      `Expected collection ${COLLECTION.listingDetail}, got ${parts.collection}`,
    );
    process.exitCode = 1;
    return;
  }

  const pds = await resolveAtprotoPdsBaseUrl(parts.repo);
  if (!pds) {
    console.error(`No PDS resolved for repo ${parts.repo}`);
    process.exitCode = 1;
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await fetchRepoRecord(pds, parts.repo, parts.collection, parts.rkey);
  } catch (error) {
    console.error(`getRecord via ${pds} failed:`, error);
    process.exitCode = 1;
    return;
  }

  const atstoreDid = await getAtstoreRepoDid();
  const parsed = tryParseListingDetailRecord(body);
  if (!parsed.ok) {
    console.error(
      `Record did not parse as listing.detail (${parsed.stage}): ${parsed.reason}`,
    );
    process.exitCode = 1;
    return;
  }

  const trustedPublisher = parts.repo.trim() === atstoreDid.trim();

  await upsertDirectoryListingFromTap({
    db,
    did: parts.repo,
    rkey: parts.rkey,
    record: parsed.record,
    trustedPublisher,
  });

  console.log(
    `Upserted store_listings slug=${parsed.record.slug} from ${raw} (trusted=${String(trustedPublisher)})`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 });
  });
