import { formatAppTagLabel, getAppTagSlug } from "./app-tag-metadata";
import { getDirectoryCategoryOption } from "./directory-categories";
import { getLexiconProducerSiteFromRepoNsid } from "./lexicon-producer-site";

/** Card projection for `/apps` — everything the sidebar facets and sorts need, client-side. */
export interface BrowseListing {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  tagline: string;
  /** Truncated full description; only used for text search. */
  searchText: string;
  categorySlugs: Array<string>;
  appTags: Array<string>;
  rating: number | null;
  reviewCount: number;
  favoriteCount: number;
  productAccountHandle: string | null;
  createdAt: string;
  updatedAt: string;
  /** Position in the server's "popular" ordering (trending score). */
  popularRank: number;
  /** Repo collection NSIDs requested in the listing's OAuth scopes. */
  dataNsids: Array<string>;
  hasSourceLink: boolean;
  acceptsDonations: boolean;
}

export const BROWSE_SORTS = [
  "popular",
  "rating",
  "reviews",
  "favorites",
  "newest",
  "updated",
  "alphabetical",
] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export const BROWSE_SORT_LABELS: Record<BrowseSort, string> = {
  popular: "Trending",
  rating: "Top rated",
  reviews: "Most reviewed",
  favorites: "Most favorited",
  newest: "Newest",
  updated: "Recently updated",
  alphabetical: "A–Z",
};

export const BROWSE_EXTRAS = ["open-source", "donations", "official"] as const;
export type BrowseExtra = (typeof BROWSE_EXTRAS)[number];

export const BROWSE_EXTRA_LABELS: Record<BrowseExtra, string> = {
  "open-source": "Open source",
  donations: "Accepts donations",
  official: "Has official account",
};

export const BROWSE_MIN_RATINGS = [4.5, 4, 3] as const;

export const BROWSE_PAGE_SIZE = 24;

/**
 * `/apps` URL state. Multi-value params are comma-joined strings so URLs stay readable
 * (`?tag=social,games&in=apps/bluesky`) instead of JSON-encoded arrays.
 */
export interface BrowseSearch {
  q?: string;
  /** Category ids; `apps` means top-level apps (`apps/<name>` exactly). */
  in?: string;
  /** App tag slugs from `getAppTagSlug`. */
  tag?: string;
  /** Lexicon producer group keys, e.g. `app.bsky`. */
  data?: string;
  rating?: number;
  has?: string;
  sort?: BrowseSort;
  page?: number;
}

export interface BrowseFilters {
  query: string;
  categories: Array<string>;
  tags: Array<string>;
  data: Array<string>;
  minRating: number | null;
  extras: Array<BrowseExtra>;
}

export type BrowseFacet =
  | "categories"
  | "tags"
  | "data"
  | "minRating"
  | "extras";

export const TOP_LEVEL_APPS_CATEGORY = "apps";

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function splitList(value: string | undefined): Array<string> {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function joinList(values: Iterable<string>): string | undefined {
  const joined = [...values].join(",");
  return joined || undefined;
}

function isOneOf<T extends string>(
  values: ReadonlyArray<T>,
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function validateBrowseSearch(
  search: Record<string, unknown>,
): BrowseSearch {
  const rating = Number(search.rating);
  const page = Number(search.page);

  return {
    q: asTrimmedString(search.q),
    in: joinList(splitList(asTrimmedString(search.in))),
    tag: joinList(splitList(asTrimmedString(search.tag))),
    data: joinList(splitList(asTrimmedString(search.data))),
    rating: (BROWSE_MIN_RATINGS as ReadonlyArray<number>).includes(rating)
      ? rating
      : undefined,
    has: joinList(
      splitList(asTrimmedString(search.has)).filter((v) =>
        isOneOf(BROWSE_EXTRAS, v),
      ),
    ),
    sort:
      isOneOf(BROWSE_SORTS, search.sort) && search.sort !== "popular"
        ? search.sort
        : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

export function getBrowseFilters(search: BrowseSearch): BrowseFilters {
  return {
    query: search.q?.trim().toLowerCase() ?? "",
    categories: splitList(search.in),
    tags: splitList(search.tag),
    data: splitList(search.data),
    minRating: search.rating ?? null,
    extras: splitList(search.has).filter((v): v is BrowseExtra =>
      isOneOf(BROWSE_EXTRAS, v),
    ),
  };
}

export function countActiveBrowseFilters(filters: BrowseFilters): number {
  return (
    filters.categories.length +
    filters.tags.length +
    filters.data.length +
    (filters.minRating == null ? 0 : 1) +
    filters.extras.length
  );
}

function isTopLevelAppSlug(slug: string) {
  const parts = slug.split("/");
  return parts[0] === "apps" && parts.length === 2;
}

export function listingMatchesCategory(
  listing: Pick<BrowseListing, "categorySlugs">,
  categoryId: string,
): boolean {
  if (categoryId === TOP_LEVEL_APPS_CATEGORY) {
    return listing.categorySlugs.some(isTopLevelAppSlug);
  }
  return listing.categorySlugs.some(
    (slug) => slug === categoryId || slug.startsWith(`${categoryId}/`),
  );
}

export function getDataGroupKey(nsid: string): string | null {
  return getLexiconProducerSiteFromRepoNsid(nsid)?.groupKey ?? null;
}

function listingDataGroups(listing: Pick<BrowseListing, "dataNsids">) {
  const groups = new Set<string>();
  for (const nsid of listing.dataNsids) {
    const key = getDataGroupKey(nsid);
    if (key) groups.add(key);
  }
  return groups;
}

function matchesQuery(listing: BrowseListing, query: string) {
  if (!query) return true;
  return [
    listing.name,
    listing.tagline,
    listing.searchText,
    listing.productAccountHandle ?? "",
    ...listing.appTags,
    ...listing.categorySlugs.map(
      (slug) => getDirectoryCategoryOption(slug)?.pathLabel ?? slug,
    ),
  ].some((value) => value.toLowerCase().includes(query));
}

function matchesFacet(
  listing: BrowseListing,
  filters: BrowseFilters,
  facet: BrowseFacet,
): boolean {
  switch (facet) {
    case "categories": {
      return (
        filters.categories.length === 0 ||
        filters.categories.some((id) => listingMatchesCategory(listing, id))
      );
    }
    case "tags": {
      return (
        filters.tags.length === 0 ||
        listing.appTags.some((tag) => filters.tags.includes(getAppTagSlug(tag)))
      );
    }
    case "data": {
      if (filters.data.length === 0) return true;
      const groups = listingDataGroups(listing);
      return filters.data.some((key) => groups.has(key));
    }
    case "minRating": {
      return (
        filters.minRating == null ||
        (listing.rating != null && listing.rating >= filters.minRating)
      );
    }
    case "extras": {
      return filters.extras.every((extra) => listingHasExtra(listing, extra));
    }
    default: {
      const _exhaustive: never = facet;
      return _exhaustive;
    }
  }
}

export function listingHasExtra(
  listing: BrowseListing,
  extra: BrowseExtra,
): boolean {
  switch (extra) {
    case "open-source": {
      return listing.hasSourceLink;
    }
    case "donations": {
      return listing.acceptsDonations;
    }
    case "official": {
      return Boolean(listing.productAccountHandle);
    }
    default: {
      const _exhaustive: never = extra;
      return _exhaustive;
    }
  }
}

const FACETS: Array<BrowseFacet> = [
  "categories",
  "tags",
  "data",
  "minRating",
  "extras",
];

/** Within a facet values are OR'd; across facets they are AND'd. `except` skips one facet (for counts). */
export function listingMatchesFilters(
  listing: BrowseListing,
  filters: BrowseFilters,
  except?: BrowseFacet,
): boolean {
  if (!matchesQuery(listing, filters.query)) return false;
  return FACETS.every(
    (facet) => facet === except || matchesFacet(listing, filters, facet),
  );
}

function compareNullableDesc(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function byPopular(a: BrowseListing, b: BrowseListing) {
  return a.popularRank - b.popularRank;
}

function byCountThenLabel(a: BrowseFacetOption, b: BrowseFacetOption) {
  return b.count - a.count || a.label.localeCompare(b.label);
}

export function sortBrowseListings(
  listings: ReadonlyArray<BrowseListing>,
  sort: BrowseSort,
): Array<BrowseListing> {
  return listings.toSorted((a, b) => {
    switch (sort) {
      case "popular": {
        return byPopular(a, b);
      }
      case "rating": {
        return (
          compareNullableDesc(a.rating, b.rating) ||
          b.reviewCount - a.reviewCount ||
          byPopular(a, b)
        );
      }
      case "reviews": {
        return b.reviewCount - a.reviewCount || byPopular(a, b);
      }
      case "favorites": {
        return b.favoriteCount - a.favoriteCount || byPopular(a, b);
      }
      case "newest": {
        return b.createdAt.localeCompare(a.createdAt) || byPopular(a, b);
      }
      case "updated": {
        return b.updatedAt.localeCompare(a.updatedAt) || byPopular(a, b);
      }
      case "alphabetical": {
        return a.name.localeCompare(b.name);
      }
      default: {
        const _exhaustive: never = sort;
        return _exhaustive;
      }
    }
  });
}

export interface BrowseFacetOption {
  id: string;
  label: string;
  count: number;
  /** Secondary text, e.g. the producer host for data groups. */
  detail?: string;
  iconUrl?: string | null;
  children?: Array<BrowseFacetOption>;
}

export interface BrowseFacets {
  categories: Array<BrowseFacetOption>;
  tags: Array<BrowseFacetOption>;
  data: Array<BrowseFacetOption>;
  minRating: Array<BrowseFacetOption>;
  extras: Array<BrowseFacetOption>;
}

function tally<T>(
  listings: ReadonlyArray<BrowseListing>,
  keysOf: (listing: BrowseListing) => Iterable<T>,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const listing of listings) {
    for (const key of new Set(keysOf(listing))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function categoryLabel(id: string) {
  return getDirectoryCategoryOption(id)?.label ?? id;
}

/** Category tree: top-level apps, then each app ecosystem with its tool categories. */
function buildCategoryOptions(
  all: ReadonlyArray<BrowseListing>,
  scoped: ReadonlyArray<BrowseListing>,
): Array<BrowseFacetOption> {
  const ecosystems = new Map<string, Set<string>>();
  const iconByCategory = new Map<string, string | null>();

  for (const listing of all) {
    for (const slug of listing.categorySlugs) {
      const parts = slug.split("/");
      if (parts[0] === "apps" && parts.length === 2) {
        iconByCategory.set(slug, listing.iconUrl);
      } else if (parts[0] === "apps" && parts.length >= 3) {
        const root = parts.slice(0, 2).join("/");
        const children = ecosystems.get(root) ?? new Set();
        children.add(parts.slice(0, 3).join("/"));
        ecosystems.set(root, children);
      }
    }
  }

  const count = (id: string) =>
    scoped.filter((listing) => listingMatchesCategory(listing, id)).length;
  const toOption = (id: string): BrowseFacetOption => ({
    id,
    label: categoryLabel(id),
    count: count(id),
  });
  const options: Array<BrowseFacetOption> = [
    {
      id: TOP_LEVEL_APPS_CATEGORY,
      label: "Standalone apps",
      count: count(TOP_LEVEL_APPS_CATEGORY),
    },
  ];

  const ecosystemOptions = [...ecosystems.entries()].map(
    ([root, children]) => ({
      ...toOption(root),
      iconUrl: iconByCategory.get(root) ?? null,
      children: [...children]
        .map((id) => toOption(id))
        .toSorted(byCountThenLabel),
    }),
  );
  options.push(...ecosystemOptions.toSorted(byCountThenLabel));

  return options;
}

export function buildBrowseFacets(
  listings: ReadonlyArray<BrowseListing>,
  filters: BrowseFilters,
): BrowseFacets {
  const scopedFor = (facet: BrowseFacet) =>
    listings.filter((listing) =>
      listingMatchesFilters(listing, filters, facet),
    );

  const tagScoped = scopedFor("tags");
  const tagLabels = new Map<string, string>();
  for (const listing of listings) {
    for (const tag of listing.appTags) {
      tagLabels.set(getAppTagSlug(tag), tag);
    }
  }
  const tagCounts = tally(tagScoped, (listing) =>
    listing.appTags.map(getAppTagSlug),
  );
  const tags = [...tagLabels.entries()]
    .map(([slug, tag]) => ({
      id: slug,
      label: formatAppTagLabel(tag),
      count: tagCounts.get(slug) ?? 0,
    }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Only producers whose data is used by 2+ listings: that's what makes it "shared".
  const allDataCounts = tally(listings, listingDataGroups);
  const dataCounts = tally(scopedFor("data"), listingDataGroups);
  const data = [...allDataCounts.entries()]
    .filter(([, total]) => total >= 2)
    .map(([key]) => {
      const site = getLexiconProducerSiteFromRepoNsid(key);
      return {
        id: key,
        label: site?.siteLabel ?? key,
        count: dataCounts.get(key) ?? 0,
      };
    })
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const ratingScoped = scopedFor("minRating");
  const minRating = BROWSE_MIN_RATINGS.map((min) => ({
    id: String(min),
    label: `${min}★ & up`,
    count: ratingScoped.filter(
      (listing) => listing.rating != null && listing.rating >= min,
    ).length,
  }));

  const extrasScoped = scopedFor("extras");
  const extras = BROWSE_EXTRAS.map((extra) => ({
    id: extra,
    label: BROWSE_EXTRA_LABELS[extra],
    count: extrasScoped.filter((listing) => listingHasExtra(listing, extra))
      .length,
  }));

  return {
    categories: buildCategoryOptions(listings, scopedFor("categories")),
    tags,
    data,
    minRating,
    extras,
  };
}

/** `apps/bluesky/client` → `Bluesky › Client`; protocol paths keep their root. */
export function getBrowseCategoryLabel(categoryId: string): string {
  if (categoryId === TOP_LEVEL_APPS_CATEGORY) return "Standalone apps";
  const option = getDirectoryCategoryOption(categoryId);
  if (!option) return categoryId;
  const labels =
    option.pathIds[0] === "apps"
      ? option.pathLabels.slice(1)
      : option.pathLabels;
  return labels.join(" › ");
}

/** Human label for a selected filter value (active-filter chips). */
export function getBrowseFilterValueLabel(
  facet: BrowseFacet,
  value: string,
  listings: ReadonlyArray<BrowseListing>,
): string {
  switch (facet) {
    case "categories": {
      return getBrowseCategoryLabel(value);
    }
    case "tags": {
      for (const listing of listings) {
        for (const tag of listing.appTags) {
          if (getAppTagSlug(tag) === value) return formatAppTagLabel(tag);
        }
      }
      return formatAppTagLabel(value.replaceAll("-", " "));
    }
    case "data": {
      return getLexiconProducerSiteFromRepoNsid(value)?.siteLabel ?? value;
    }
    case "minRating": {
      return `${value}★ & up`;
    }
    case "extras": {
      return isOneOf(BROWSE_EXTRAS, value) ? BROWSE_EXTRA_LABELS[value] : value;
    }
    default: {
      const _exhaustive: never = facet;
      return _exhaustive;
    }
  }
}

/** Search params for `/apps` with one facet value toggled; resets pagination. */
export function toggleBrowseFilter(
  search: BrowseSearch,
  facet: BrowseFacet,
  value: string,
): BrowseSearch {
  const toggleIn = (current: string | undefined) => {
    const values = splitList(current);
    return joinList(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  const next: BrowseSearch = { ...search, page: undefined };
  switch (facet) {
    case "categories": {
      next.in = toggleIn(search.in);
      break;
    }
    case "tags": {
      next.tag = toggleIn(search.tag);
      break;
    }
    case "data": {
      next.data = toggleIn(search.data);
      break;
    }
    case "minRating": {
      const rating = Number(value);
      next.rating = search.rating === rating ? undefined : rating;
      break;
    }
    case "extras": {
      next.has = toggleIn(search.has);
      break;
    }
    default: {
      const _exhaustive: never = facet;
      return _exhaustive;
    }
  }
  return next;
}

export function clearBrowseFilters(search: BrowseSearch): BrowseSearch {
  return { q: search.q, sort: search.sort };
}
