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

describe("slugifyDirectoryListingName as a custom-URL normalizer", () => {
  it("normalizes free-form owner input to a URL slug", () => {
    expect(slugifyDirectoryListingName("My Cool App!")).toBe("my-cool-app");
    expect(slugifyDirectoryListingName("  Spaces & Symbols  ")).toBe(
      "spaces-and-symbols",
    );
  });

  it("is idempotent, so the previewed slug survives being re-slugified", () => {
    // The editor previews `slugify(input)`, the server stores `slugify(input)`,
    // and the read loaders redirect to `slugify(stored)`. If this weren't
    // idempotent the owner could land in a redirect loop.
    for (const input of ["My Cool App!", "already-a-slug", "Café Münchén"]) {
      const once = slugifyDirectoryListingName(input);
      expect(slugifyDirectoryListingName(once)).toBe(once);
    }
  });

  it("falls back to a non-empty slug for input with no slug characters", () => {
    expect(slugifyDirectoryListingName("!!!")).toBe("product");
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
