#!/usr/bin/env node
/**
 * Re-insert a `store_listings` mirror row by fetching `fyi.atstore.listing.detail` from the network.
 *
 * Use when Postgres lost the row but the ATProto record still exists (e.g. after a bad claim race).
 * This uses the same upsert path as Tap ingest; it does not write to any PDS.
 *
 *   pnpm listing:rehydrate-from-at-uri at://did:plc:…/fyi.atstore.listing.detail/…
 *
 * Requires `DATABASE_URL`. Uses `ATSTORE_IDENTIFIER` + `ATSTORE_APP_PASSWORD` + `ATSTORE_SERVICE`
 * (same as `listing:publish-store`) so the XRPC client can call `com.atproto.repo.getRecord` for any repo.
 *
 * If the record was removed from all PDSes, restore from a DB backup instead:
 * `pnpm listing:restore-from-backup-db …`
 */
import "dotenv/config";

import type { ActorIdentifier } from "@atcute/lexicons";

import { ok } from "@atcute/client";

import { db, dbClient } from "../src/db/index.server";
import { parseAtUriParts } from "../src/lib/atproto/at-uri";
import { COLLECTION } from "../src/lib/atproto/nsids";
import { createAtstorePublishClient } from "../src/lib/atproto/publish-directory-listing";
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

  const { client, repoDid: atstoreDid } = await createAtstorePublishClient();
  const gr = await ok(
    client.get("com.atproto.repo.getRecord", {
      params: {
        repo: parts.repo as ActorIdentifier,
        collection: parts.collection,
        rkey: parts.rkey,
      },
    }),
  );

  const body = gr.value as Record<string, unknown> | undefined;
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
