/**
 * On-demand backfill for `fund.at.*` records — mirrors `standard-site-verify-backfill.ts`.
 *
 * Crawls a single product DID's PDS for the six at.fund collections we mirror and upserts
 * each row directly (skipping the Tap-side product-DID gate, since by definition we only
 * ever call this for a known listing's `productAccountDid`). Used in two places:
 *   1. Admin verification approval — `setListingVerification` schedules a backfill so
 *      previously-published fund.at.* records arrive even before Tap relays them live.
 *   2. The owner-claim flow in `api-directory-listings.functions.ts` schedules a backfill
 *      when a listing's productAccountDid is set/changed.
 *
 * Limitation: `resolveAtprotoPdsBaseUrl` only handles `did:plc:`. `did:web:` DIDs (which the
 * at.fund spec explicitly accepts) are silently skipped today; resolving them is left for a
 * follow-up alongside the existing TODO in `resolve-atproto-pds.ts`.
 */
import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import {
  paginateListRecords,
  rkeyFromCollectionAtUri,
} from "#/lib/atproto/list-records";
import { COLLECTION } from "#/lib/atproto/nsids";
import { resolveAtprotoPdsBaseUrl } from "#/lib/atproto/resolve-atproto-pds";
import {
  tryParseFundActorDeclarationRecord,
  upsertFundActorDeclarationIntoDb,
} from "#/lib/atproto/tap-fund-actor-declaration-sync";
import {
  tryParseFundFundingChannelRecord,
  upsertFundFundingChannelIntoDb,
} from "#/lib/atproto/tap-fund-funding-channel-sync";
import {
  tryParseFundFundingContributeRecord,
  upsertFundFundingContributeIntoDb,
} from "#/lib/atproto/tap-fund-funding-contribute-sync";
import {
  tryParseFundFundingPlanRecord,
  upsertFundFundingPlanIntoDb,
} from "#/lib/atproto/tap-fund-funding-plan-sync";
import {
  tryParseFundGraphDependencyRecord,
  upsertFundGraphDependencyIntoDb,
} from "#/lib/atproto/tap-fund-graph-dependency-sync";
import { refreshListingPageSnapshot } from "#/lib/listing-page-snapshot";
import { eq } from "drizzle-orm";

async function backfillCollection<T>(
  db: Database,
  pds: string,
  did: string,
  collection: string,
  parseRecord: (
    body: Record<string, unknown> | undefined,
  ) => { ok: true; record: T } | { ok: false; reason: string },
  upsert: (input: {
    db: Database;
    repoDid: string;
    rkey: string;
    record: T;
    recordSource?: Record<string, unknown>;
  }) => Promise<void>,
): Promise<void> {
  for await (const row of paginateListRecords(pds, did, collection)) {
    const body = row.value as Record<string, unknown> | null | undefined;
    if (!body || typeof body !== "object") continue;
    const rkey = rkeyFromCollectionAtUri(row.uri, collection);
    if (!rkey) continue;
    const parsed = parseRecord(body);
    if (!parsed.ok) {
      console.warn(
        `[fund-backfill] skip ${collection} did=${did} rkey=${rkey}: ${parsed.reason}`,
      );
      continue;
    }
    await upsert({
      db,
      repoDid: did,
      rkey,
      record: parsed.record,
      recordSource: body,
    });
  }
}

export async function backfillFundForProductDid(
  db: Database,
  productDid: string,
): Promise<void> {
  const did = productDid.trim();
  if (!did.startsWith("did:")) return;

  const pds = await resolveAtprotoPdsBaseUrl(did);
  if (!pds) {
    // did:web: support is a TODO in resolveAtprotoPdsBaseUrl — currently only did:plc:.
    console.warn(
      `[fund-backfill] no PDS for ${did}; skip listRecords backfill (did:web: not yet supported)`,
    );
    return;
  }

  await backfillCollection(
    db,
    pds,
    did,
    COLLECTION.fundActorDeclaration,
    tryParseFundActorDeclarationRecord,
    upsertFundActorDeclarationIntoDb,
  );
  await backfillCollection(
    db,
    pds,
    did,
    COLLECTION.fundFundingContribute,
    tryParseFundFundingContributeRecord,
    upsertFundFundingContributeIntoDb,
  );
  await backfillCollection(
    db,
    pds,
    did,
    COLLECTION.fundFundingChannel,
    tryParseFundFundingChannelRecord,
    upsertFundFundingChannelIntoDb,
  );
  await backfillCollection(
    db,
    pds,
    did,
    COLLECTION.fundFundingPlan,
    tryParseFundFundingPlanRecord,
    upsertFundFundingPlanIntoDb,
  );
  await backfillCollection(
    db,
    pds,
    did,
    COLLECTION.fundGraphDependency,
    tryParseFundGraphDependencyRecord,
    upsertFundGraphDependencyIntoDb,
  );

  const listings = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.productAccountDid, did));

  for (const row of listings) {
    try {
      await refreshListingPageSnapshot(db, row.id);
    } catch {
      // Non-fatal after fund crawl.
    }
  }
}

/**
 * Fire-and-forget PDS crawl after a listing becomes verified or its productAccountDid changes.
 * Matches the shape of `scheduleStandardSiteBackfillForProductDid`.
 */
export function scheduleFundBackfillForProductDid(
  db: Database,
  productDid: string,
): void {
  const did = productDid.trim();
  if (!did.startsWith("did:")) return;
  void backfillFundForProductDid(db, did).catch((error) => {
    console.error(`[fund-backfill] failed productDid=${did}`, error);
  });
}
