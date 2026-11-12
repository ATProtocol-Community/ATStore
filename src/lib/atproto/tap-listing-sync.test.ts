import type { FyiAtstoreListingDetail } from "#/lib/atproto/listing-record";

import { COLLECTION } from "#/lib/atproto/nsids";
import { resolveListingVerificationStatus } from "#/lib/atproto/tap-listing-sync";
import { describe, expect, it } from "vitest";

const STORE = "did:plc:store";
const OLD_OWNER = "did:plc:oldowner";
const NEW_OWNER = "did:plc:newowner";

const storeRecordUri = `at://${STORE}/${COLLECTION.listingDetail}/store1`;
const oldOwnerRecordUri = `at://${OLD_OWNER}/${COLLECTION.listingDetail}/old1`;

type Input = Parameters<typeof resolveListingVerificationStatus>[0];

/** Ingest of NEW_OWNER's record carrying `migratedFromAtUri`, against a row pending for NEW_OWNER. */
function resolve(migratedFromAtUri: string, overrides: Partial<Input>) {
  return resolveListingVerificationStatus({
    trustedPublisher: false,
    record: { migratedFromAtUri } as FyiAtstoreListingDetail,
    ingestRepoDid: NEW_OWNER,
    ingestRkey: "new1",
    existingClaimPendingForDid: NEW_OWNER,
    existingPriorAtUri: null,
    existingRepoDid: OLD_OWNER,
    existingRkey: "old1",
    existingVerificationStatus: "verified",
    atstoreDid: STORE,
    ...overrides,
  });
}

describe("resolveListingVerificationStatus", () => {
  it("verifies a store claim whose lineage matches the pinned store record", () => {
    expect(
      resolve(storeRecordUri, {
        existingRepoDid: STORE,
        existingPriorAtUri: storeRecordUri,
        existingVerificationStatus: "verified",
      }),
    ).toBe("verified");
  });

  it("keeps a verified listing verified across an owner-to-owner transfer", () => {
    expect(
      resolve(oldOwnerRecordUri, { existingPriorAtUri: oldOwnerRecordUri }),
    ).toBe("verified");
  });

  it("does not verify an unverified listing just because it was transferred", () => {
    expect(
      resolve(oldOwnerRecordUri, {
        existingPriorAtUri: oldOwnerRecordUri,
        existingVerificationStatus: "unverified",
      }),
    ).toBe("unverified");
  });

  it("rejects transfer lineage the server never pinned", () => {
    expect(resolve(oldOwnerRecordUri, { existingPriorAtUri: null })).toBe(
      "unverified",
    );
  });

  it("rejects lineage that doesn't match the pinned record", () => {
    expect(
      resolve(`at://${OLD_OWNER}/${COLLECTION.listingDetail}/other`, {
        existingPriorAtUri: oldOwnerRecordUri,
      }),
    ).toBe("unverified");
  });

  it("rejects lineage from an account the transfer wasn't offered to", () => {
    expect(
      resolve(oldOwnerRecordUri, {
        ingestRepoDid: "did:plc:someoneelse",
        existingPriorAtUri: oldOwnerRecordUri,
      }),
    ).toBe("unverified");
  });
});
