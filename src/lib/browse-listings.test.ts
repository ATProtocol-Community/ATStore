import { describe, expect, it } from "vitest";

import type { BrowseListing } from "./browse-listings";

import {
  buildBrowseFacets,
  getBrowseFilters,
  listingMatchesFilters,
  sortBrowseListings,
  toggleBrowseFilter,
  validateBrowseSearch,
} from "./browse-listings";

function listing(overrides: Partial<BrowseListing>): BrowseListing {
  return {
    id: overrides.name ?? "id",
    name: "Listing",
    slug: "listing",
    iconUrl: null,
    tagline: "",
    searchText: "",
    categorySlugs: [],
    appTags: [],
    rating: null,
    reviewCount: 0,
    favoriteCount: 0,
    productAccountHandle: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    popularRank: 0,
    dataNsids: [],
    hasSourceLink: false,
    acceptsDonations: false,
    ...overrides,
  };
}

const graysky = listing({
  name: "Graysky",
  categorySlugs: ["apps/bluesky/client"],
  appTags: ["social"],
  rating: 4.7,
  reviewCount: 10,
  popularRank: 1,
  dataNsids: ["app.bsky.feed.post"],
});
const smokeSignal = listing({
  name: "Smoke Signal",
  categorySlugs: ["apps/smoke-signal"],
  appTags: ["events", "community"],
  rating: 4.2,
  reviewCount: 3,
  popularRank: 0,
  dataNsids: ["events.smokesignal.calendar.event", "app.bsky.feed.post"],
  hasSourceLink: true,
});
const pds = listing({
  name: "Stratos",
  categorySlugs: ["protocol/pds"],
  appTags: ["developer tool"],
  popularRank: 2,
});
const all = [graysky, smokeSignal, pds];

describe("validateBrowseSearch", () => {
  it("drops defaults and invalid values", () => {
    expect(
      validateBrowseSearch({
        sort: "popular",
        page: "1",
        rating: "2",
        has: "open-source,nope",
        tag: " social , social,games ",
      }),
    ).toEqual({
      q: undefined,
      in: undefined,
      tag: "social,games",
      data: undefined,
      rating: undefined,
      has: "open-source",
      sort: undefined,
      page: undefined,
    });
  });

  it("keeps non-default sort, rating and page", () => {
    const search = validateBrowseSearch({ sort: "rating", rating: 4, page: 3 });
    expect(search.sort).toBe("rating");
    expect(search.rating).toBe(4);
    expect(search.page).toBe(3);
  });
});

describe("listingMatchesFilters", () => {
  const match = (search: Record<string, unknown>) =>
    all
      .filter((l) =>
        listingMatchesFilters(
          l,
          getBrowseFilters(validateBrowseSearch(search)),
        ),
      )
      .map((l) => l.name);

  it("treats `apps` as top-level apps only", () => {
    expect(match({ in: "apps" })).toEqual(["Smoke Signal"]);
  });

  it("matches a category and its descendants", () => {
    expect(match({ in: "apps/bluesky" })).toEqual(["Graysky"]);
    expect(match({ in: "protocol" })).toEqual(["Stratos"]);
  });

  it("ORs within a facet and ANDs across facets", () => {
    expect(match({ tag: "social,events" })).toEqual([
      "Graysky",
      "Smoke Signal",
    ]);
    expect(match({ tag: "social,events", has: "open-source" })).toEqual([
      "Smoke Signal",
    ]);
  });

  it("matches tags by slug", () => {
    expect(match({ tag: "developer" })).toEqual(["Stratos"]);
  });

  it("groups data by producer", () => {
    expect(match({ data: "app.bsky" })).toEqual(["Graysky", "Smoke Signal"]);
    expect(match({ data: "events.smokesignal" })).toEqual(["Smoke Signal"]);
  });

  it("searches name, tags and category labels", () => {
    expect(match({ q: "client" })).toEqual(["Graysky"]);
    expect(match({ q: "COMMUNITY" })).toEqual(["Smoke Signal"]);
  });

  it("filters by minimum rating", () => {
    expect(match({ rating: 4.5 })).toEqual(["Graysky"]);
  });
});

describe("sortBrowseListings", () => {
  it("sorts by popular rank by default", () => {
    expect(sortBrowseListings(all, "popular").map((l) => l.name)).toEqual([
      "Smoke Signal",
      "Graysky",
      "Stratos",
    ]);
  });

  it("puts unrated listings last when sorting by rating", () => {
    expect(sortBrowseListings(all, "rating").map((l) => l.name)).toEqual([
      "Graysky",
      "Smoke Signal",
      "Stratos",
    ]);
  });
});

describe("buildBrowseFacets", () => {
  it("counts each facet ignoring its own selection", () => {
    const facets = buildBrowseFacets(all, getBrowseFilters({ tag: "social" }));
    expect(facets.tags.find((t) => t.id === "events")?.count).toBe(1);
    expect(facets.categories.find((c) => c.id === "apps")?.count).toBe(0);
  });

  it("builds ecosystem branches without protocol tooling", () => {
    const facets = buildBrowseFacets(all, getBrowseFilters({}));
    const bluesky = facets.categories.find((c) => c.id === "apps/bluesky");
    expect(bluesky?.children?.map((c) => c.id)).toEqual([
      "apps/bluesky/client",
    ]);
    expect(facets.categories.map((c) => c.id)).toEqual([
      "apps",
      "apps/bluesky",
    ]);
  });

  it("only offers data producers shared by two or more listings", () => {
    const facets = buildBrowseFacets(all, getBrowseFilters({}));
    expect(facets.data.map((d) => d.id)).toEqual(["app.bsky"]);
    expect(facets.data[0]?.label).toBe("bsky.app");
  });
});

describe("toggleBrowseFilter", () => {
  it("adds and removes values and resets the page", () => {
    const added = toggleBrowseFilter(
      { tag: "social", page: 3 },
      "tags",
      "games",
    );
    expect(added).toEqual({ tag: "social,games", page: undefined });
    expect(toggleBrowseFilter(added, "tags", "social").tag).toBe("games");
    expect(toggleBrowseFilter({ rating: 4 }, "minRating", "4").rating).toBe(
      undefined,
    );
  });
});
