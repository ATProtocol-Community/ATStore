import { describe, expect, it } from "vitest";

import {
  listingSlugBaseFromCategorySlug,
  resolveStoreListingSlugBase,
  slugifyDirectoryListingName,
} from "./directory-listing-slugs";

describe("listingSlugBaseFromCategorySlug", () => {
  it("returns the app segment for apps/* categories", () => {
    expect(listingSlugBaseFromCategorySlug("apps/lemma")).toBe("lemma");
    expect(listingSlugBaseFromCategorySlug("apps/lemma/tools")).toBe("lemma");
  });

  it("normalizes the app segment", () => {
    expect(listingSlugBaseFromCategorySlug("apps/Lemma Pub")).toBe("lemma-pub");
  });

  it("returns null for protocol categories", () => {
    expect(listingSlugBaseFromCategorySlug("protocol/pds")).toBeNull();
  });
});

describe("resolveStoreListingSlugBase", () => {
  it("prefers the app slug for app listings", () => {
    expect(
      resolveStoreListingSlugBase({
        categorySlug: "apps/lemma",
        name: "Lemma",
        sourceUrl: "https://lemma.pub",
      }),
    ).toBe("lemma");
  });

  it("falls back to the name slug for protocol listings", () => {
    expect(
      resolveStoreListingSlugBase({
        categorySlug: "protocol/pds",
        name: "My PDS",
        sourceUrl: "https://example.com",
      }),
    ).toBe(slugifyDirectoryListingName("My PDS"));
  });
});
