import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  BrowseFacet,
  BrowseFacets,
  BrowseFilters,
  BrowseSearch,
  BrowseSort,
} from "../lib/browse-listings";

import { BrowseFilterPanel } from "../components/BrowseFilterPanel";
import { ListingRow } from "../components/shelf/ListingRow";
import { BackLink, PageHero } from "../components/shelf/Section";
import { Button } from "../design-system/button";
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
} from "../design-system/drawer";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { Pagination } from "../design-system/pagination";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagLabel,
  getAppTagDescription,
} from "../lib/app-tag-metadata";
import {
  BROWSE_SORTS,
  BROWSE_SORT_LABELS,
  TOP_LEVEL_APPS_CATEGORY,
  clearBrowseFilters,
  countActiveBrowseFilters,
  getBrowseCategoryLabel,
  getBrowseFilterValueLabel,
  getBrowseFilters,
  toggleBrowseFilter,
  validateBrowseSearch,
} from "../lib/browse-listings";
import { getDirectoryCategoryOption } from "../lib/directory-categories";
import { GAMES_APP_TAG_SLUG } from "../lib/game-listing";
import { buildAppTagOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

const QUERY_DEBOUNCE_MS = 250;

const sortOptions = BROWSE_SORTS.map((id) => ({
  id,
  label: BROWSE_SORT_LABELS[id],
}));

/** When the only filter is a single tag, recover its stored (lowercase) text and count. */
function getSingleTagPreset(search: BrowseSearch, facets: BrowseFacets) {
  const filters = getBrowseFilters(search);
  if (
    filters.query ||
    filters.tags.length !== 1 ||
    countActiveBrowseFilters(filters) !== 1
  ) {
    return null;
  }
  const option = facets.tags.find((tag) => tag.id === filters.tags[0]);
  return option
    ? { tag: option.label.toLowerCase(), count: option.count }
    : null;
}

function getSingleCategoryPreset(search: BrowseSearch) {
  const filters = getBrowseFilters(search);
  if (
    filters.query ||
    filters.categories.length !== 1 ||
    countActiveBrowseFilters(filters) !== 1
  ) {
    return null;
  }
  const id = filters.categories[0];
  if (!id || id === TOP_LEVEL_APPS_CATEGORY) {
    return null;
  }
  return getDirectoryCategoryOption(id);
}

/** `/apps?tag=games` on its own is the games section, which lives at `/games`. */
function isGamesTagOnly(search: BrowseSearch) {
  const filters = getBrowseFilters(search);
  return (
    !filters.query &&
    countActiveBrowseFilters(filters) === 1 &&
    filters.tags[0] === GAMES_APP_TAG_SLUG
  );
}

export const Route = createFileRoute("/_header-layout/apps/")({
  validateSearch: validateBrowseSearch,
  beforeLoad: ({ search }) => {
    if (isGamesTagOnly(search)) {
      throw redirect({ to: "/games", statusCode: 301 });
    }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const { facets } = await context.queryClient.ensureQueryData(
      directoryListingApi.getBrowsePageQueryOptions(deps),
    );

    const tagPreset = getSingleTagPreset(deps, facets);
    if (tagPreset) {
      const label = formatAppTagLabel(tagPreset.tag);
      return {
        ogTitle: `${label} apps | at-store`,
        ogDescription: getAppTagDescription(tagPreset.tag),
        ogImage: buildAppTagOgImageUrl({
          tag: tagPreset.tag,
          label,
          kind: "App Tag",
          count: tagPreset.count,
        }),
      };
    }

    const categoryPreset = getSingleCategoryPreset(deps);
    if (categoryPreset) {
      return {
        ogTitle: `${categoryPreset.label} | at-store`,
        ogDescription: categoryPreset.description,
        ogImage: undefined,
      };
    }

    return {
      ogTitle: "Browse apps | at-store",
      ogDescription:
        "Every app, client, feed and developer tool on the Atmosphere in one list. Filter by category, tag, shared data, rating and more.",
      ogImage: undefined,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Browse apps | at-store",
      description:
        loaderData?.ogDescription ??
        "Browse every app on the Atmosphere with filters.",
      image: loaderData?.ogImage,
    }),
  component: BrowseAppsPage,
});

const styles = stylex.create({
  root: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
    paddingBottom: { default: 48, [breakpoints.md]: 72 },
  },
  layout: {
    alignItems: "start",
    columnGap: { default: 36, [breakpoints.xl]: 56 },
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "220px minmax(0, 1fr)",
      [breakpoints.xl]: "248px minmax(0, 1fr)",
    },
  },
  sidebar: {
    display: { default: "none", [breakpoints.lg]: "block" },
    position: "sticky",
    scrollbarWidth: "thin",
    maxHeight: "calc(100vh - 110px)",
    overflowY: "auto",
    paddingRight: 8,
    top: 88,
  },
  toolbar: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    rowGap: 10,
  },
  searchField: {
    flexBasis: { default: "100%", [breakpoints.md]: "auto" },
    flexGrow: 1,
    minWidth: 0,
  },
  mobileFilters: {
    display: { default: "block", [breakpoints.lg]: "none" },
  },
  sortSelect: {
    minWidth: "11rem",
  },
  chips: {
    alignItems: "center",
    columnGap: 8,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
    marginTop: 16,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: uiColor.text2,
    color: uiColor.bg,
    columnGap: 6,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: fontWeight.medium,
    opacity: { default: 1, ":hover": 0.88 },
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 6,
    transitionDuration: animationDuration.fast,
    transitionProperty: "opacity",
    whiteSpace: "nowrap",
    height: 30,
    paddingLeft: 12,
    paddingRight: 10,
  },
  clearAll: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
    marginLeft: 4,
  },
  resultCount: {
    color: uiColor.text1,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    marginBottom: 6,
    marginTop: 20,
  },
  results: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  emptyState: {
    marginTop: 16,
  },
  pagination: {
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    marginTop: 32,
    paddingTop: 24,
  },
  drawerFooter: {
    columnGap: 8,
    display: "flex",
    rowGap: 8,
  },
  drawerButton: {
    flexBasis: 0,
    flexGrow: 1,
  },
});

function BrowseAppsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const {
    data: { results, total, totalListings, page, totalPages, facets },
  } = useSuspenseQuery(directoryListingApi.getBrowsePageQueryOptions(search));

  const filters = useMemo(() => getBrowseFilters(search), [search]);
  const sort: BrowseSort = search.sort ?? "popular";

  const toggleFilter = (facet: BrowseFacet, value: string) => {
    void navigate({
      search: (prev) => toggleBrowseFilter(prev, facet, value),
      resetScroll: false,
    });
  };
  const clearFilters = () => {
    void navigate({
      search: (prev) => clearBrowseFilters(prev),
      resetScroll: false,
    });
  };

  const activeFilterCount = countActiveBrowseFilters(filters);
  const filterPanel = (
    <BrowseFilterPanel
      facets={facets}
      filters={filters}
      onToggle={toggleFilter}
    />
  );
  const showLabel = `Show ${total} ${total === 1 ? "app" : "apps"}`;

  return (
    <div {...stylex.props(styles.root)}>
      <BrowseHero search={search} facets={facets} total={total} />

      <div {...stylex.props(styles.layout)}>
        <aside aria-label="Filters" {...stylex.props(styles.sidebar)}>
          {filterPanel}
        </aside>

        <div>
          <div {...stylex.props(styles.toolbar)}>
            <div {...stylex.props(styles.searchField)}>
              <BrowseQueryField query={search.q ?? ""} />
            </div>
            <div {...stylex.props(styles.mobileFilters)}>
              <Drawer
                direction="left"
                trigger={
                  <Button variant="secondary" size="lg">
                    <SlidersHorizontal size={16} />
                    {activeFilterCount > 0
                      ? `Filters (${activeFilterCount})`
                      : "Filters"}
                  </Button>
                }
              >
                <DrawerHeader>Filters</DrawerHeader>
                <DrawerBody>{filterPanel}</DrawerBody>
                <DrawerFooter>
                  <div {...stylex.props(styles.drawerFooter)}>
                    <Button
                      variant="secondary"
                      isDisabled={activeFilterCount === 0}
                      onPress={clearFilters}
                      style={styles.drawerButton}
                    >
                      Clear all
                    </Button>
                    <Button slot="close" style={styles.drawerButton}>
                      {showLabel}
                    </Button>
                  </div>
                </DrawerFooter>
              </Drawer>
            </div>
            <Select
              aria-label="Sort apps"
              items={sortOptions}
              size="lg"
              style={styles.sortSelect}
              value={sort}
              variant="secondary"
              onChange={(key) => {
                const next = BROWSE_SORTS.find((id) => id === key);
                if (!next) return;
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    sort: next === "popular" ? undefined : next,
                    page: undefined,
                  }),
                  resetScroll: false,
                });
              }}
            >
              {(item) => <SelectItem>{item.label}</SelectItem>}
            </Select>
          </div>

          <ActiveFilterChips
            filters={filters}
            facets={facets}
            onRemove={toggleFilter}
            onClear={clearFilters}
          />

          <p {...stylex.props(styles.resultCount)}>
            {total === totalListings
              ? `${totalListings} apps`
              : `${total} of ${totalListings} apps`}
          </p>

          {results.length > 0 ? (
            <ul role="list" {...stylex.props(styles.results)}>
              {results.map((listing) => (
                <li key={listing.id}>
                  <ListingRow listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState size="lg" style={styles.emptyState}>
              <EmptyStateImage>
                <SearchX size={20} />
              </EmptyStateImage>
              <EmptyStateTitle>No apps match these filters</EmptyStateTitle>
              <EmptyStateDescription>
                Try removing a filter or searching for something broader.
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button
                  variant="secondary"
                  onPress={() =>
                    void navigate({ search: {}, resetScroll: false })
                  }
                >
                  Clear search and filters
                </Button>
              </EmptyStateActions>
            </EmptyState>
          )}

          {totalPages > 1 ? (
            <Pagination
              totalPages={totalPages}
              selectedPage={page}
              style={styles.pagination}
              onSelectedPageChange={(next) => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    page: next > 1 ? next : undefined,
                  }),
                });
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatApps(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "app" : "apps"}`;
}

/**
 * The heading follows what you're looking at: search results, a single tag,
 * a single category, or everything.
 */
function BrowseHero({
  search,
  facets,
  total,
}: {
  search: BrowseSearch;
  facets: BrowseFacets;
  total: number;
}) {
  const query = search.q?.trim();
  if (query) {
    return (
      <PageHero
        eyebrow="Search"
        title={`Results for “${query}”`}
        description={`${formatApps(total)} ${total === 1 ? "matches" : "match"} your search.`}
      />
    );
  }

  const tagPreset = getSingleTagPreset(search, facets);
  if (tagPreset) {
    return (
      <PageHero
        back={<BackLink to="/apps/tags">All tags</BackLink>}
        eyebrow={`Tag · ${formatApps(total)}`}
        title={formatAppTagLabel(tagPreset.tag)}
        description={getAppTagDescription(tagPreset.tag)}
      />
    );
  }

  const category = getSingleCategoryPreset(search);
  if (category) {
    // Only app ecosystems with tool categories have an ecosystem page.
    const ecosystem =
      category.pathIds[0] === "apps" &&
      facets.categories.some(
        (option) =>
          option.id === `apps/${category.pathIds[1]}` &&
          (option.children?.length ?? 0) > 0,
      )
        ? category.pathIds[1]
        : undefined;
    const ecosystemLabel = ecosystem
      ? getDirectoryCategoryOption(`apps/${ecosystem}`)?.label
      : undefined;
    return (
      <PageHero
        back={
          ecosystem && ecosystemLabel ? (
            <BackLink to="/ecosystems/$app" params={{ app: ecosystem }}>
              {`${ecosystemLabel} ecosystem`}
            </BackLink>
          ) : undefined
        }
        eyebrow={`Category · ${formatApps(total)}`}
        title={getBrowseCategoryLabel(category.id)}
        description={category.description}
      />
    );
  }

  return (
    <PageHero
      title="Browse apps"
      description="Every app, client and feed on the Atmosphere in one list. Narrow it down with the filters."
    />
  );
}

/** Text search kept in the URL (`?q=`), debounced so typing doesn't spam history. */
function BrowseQueryField({ query }: { query: string }) {
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const next = draft.trim();
    if (next === query) return;
    const timeout = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: next || undefined, page: undefined }),
        replace: true,
        resetScroll: false,
      });
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draft, query, navigate]);

  return (
    <SearchField
      aria-label="Search apps"
      placeholder="Search apps, tags, developers…"
      value={draft}
      onChange={setDraft}
      size="lg"
      variant="secondary"
    />
  );
}

function ActiveFilterChips({
  filters,
  facets,
  onRemove,
  onClear,
}: {
  filters: BrowseFilters;
  facets: BrowseFacets;
  onRemove: (facet: BrowseFacet, value: string) => void;
  onClear: () => void;
}) {
  const chips: Array<{ facet: BrowseFacet; value: string }> = [
    ...filters.categories.map((value) => ({
      facet: "categories" as const,
      value,
    })),
    ...filters.tags.map((value) => ({ facet: "tags" as const, value })),
    ...filters.data.map((value) => ({ facet: "data" as const, value })),
    ...(filters.minRating == null
      ? []
      : [{ facet: "minRating" as const, value: String(filters.minRating) }]),
    ...filters.extras.map((value) => ({ facet: "extras" as const, value })),
  ];

  if (chips.length === 0) {
    return null;
  }

  return (
    <div {...stylex.props(styles.chips)}>
      {chips.map(({ facet, value }) => {
        const label = getBrowseFilterValueLabel(facet, value, facets);
        return (
          <button
            key={`${facet}:${value}`}
            type="button"
            aria-label={`Remove filter: ${label}`}
            onClick={() => onRemove(facet, value)}
            {...stylex.props(styles.chip)}
          >
            {label}
            <X size={12} strokeWidth={2.4} aria-hidden />
          </button>
        );
      })}
      <button
        type="button"
        onClick={onClear}
        {...stylex.props(styles.clearAll)}
      >
        Clear all
      </button>
    </div>
  );
}
