import type { Client } from "@atcute/client";
import type { StoreListing } from "#/db/schema";

import { ClientResponseError } from "@atcute/client";
import { publishOwnedListingDetail } from "#/lib/atproto/publish-directory-listing";
import {
  fetchListingDetailRecord,
  putListingDetailRecord,
} from "#/lib/atproto/repo-records";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/atproto/repo-records", () => ({
  createListingDetailRecord: vi.fn(),
  fetchListingDetailRecord: vi.fn(),
  putListingDetailRecord: vi.fn(),
}));

vi.mock("#/lib/atproto/blob-upload", () => ({
  uploadImageBlob: vi.fn(async () => blob(NEW_ICON_CID)),
}));

const OWNER = "did:plc:owner";
const NEW_ICON_CID = "bafkreinewicon";
const OLD_ICON_CID = "bafkreioldicon";
const MISSING_HERO_CID = "bafkreimissinghero";
const SHOT_CID = "bafkreishot";

function blob(cid: string) {
  return {
    $type: "blob",
    ref: { $link: cid },
    mimeType: "image/jpeg",
    size: 1,
  } as never;
}

const row = {
  id: "00000000-0000-0000-0000-000000000000",
  repoDid: OWNER,
  rkey: "3mknwssundkoj",
  slug: "airglow",
  name: "Airglow",
  tagline: "Automations",
  externalUrl: "https://airglow.run",
  iconUrl: null,
  heroImageUrl: null,
  screenshotUrls: [],
  createdAt: new Date("2026-04-01T00:00:00Z"),
  updatedAt: new Date("2026-07-07T00:00:00Z"),
} as unknown as StoreListing;

describe("publishOwnedListingDetail", () => {
  beforeEach(() => {
    vi.mocked(fetchListingDetailRecord).mockResolvedValue({
      cid: "bafyprior",
      value: {
        icon: blob(OLD_ICON_CID),
        heroImage: blob(MISSING_HERO_CID),
        screenshots: [blob(SHOT_CID)],
      } as never,
    });
    vi.mocked(putListingDetailRecord).mockReset();
  });

  it("drops a prior blob ref the PDS no longer has and republishes", async () => {
    vi.mocked(putListingDetailRecord)
      .mockRejectedValueOnce(
        new ClientResponseError({
          status: 400,
          data: {
            error: "BlobNotFound",
            message: `Could not find blob: ${MISSING_HERO_CID}`,
          },
        }),
      )
      .mockResolvedValueOnce({ uri: "at://ok" });

    const { uri } = await publishOwnedListingDetail(
      {} as Client,
      OWNER,
      row,
      undefined,
      { icon: { bytes: new Uint8Array([1]), mimeType: "image/png" } },
    );

    expect(uri).toBe("at://ok");
    expect(putListingDetailRecord).toHaveBeenCalledTimes(2);
    const record = vi.mocked(putListingDetailRecord).mock.calls[1]?.[3];
    expect(record?.heroImage).toBeUndefined();
    expect(record?.icon).toEqual(blob(NEW_ICON_CID));
    expect(record?.screenshots).toEqual([blob(SHOT_CID)]);
  });

  it("rethrows BlobNotFound for a blob the prior record didn't reference", async () => {
    vi.mocked(putListingDetailRecord).mockRejectedValue(
      new ClientResponseError({
        status: 400,
        data: {
          error: "BlobNotFound",
          message: "Could not find blob: bafkreiunrelated",
        },
      }),
    );

    await expect(
      publishOwnedListingDetail({} as Client, OWNER, row),
    ).rejects.toThrow("BlobNotFound");
    expect(putListingDetailRecord).toHaveBeenCalledTimes(1);
  });
});
