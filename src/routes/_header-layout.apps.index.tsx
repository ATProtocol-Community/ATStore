import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
} from "@tanstack/react-router";
import { Heart, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  BrowseFacet,
  BrowseFacets,
  BrowseFilters,
  BrowseListingCard,
  BrowseSearch,
  BrowseSort,
} from "../lib/browse-listings";

import { BrowseFilterPanel } from "../components/BrowseFilterPanel";
import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
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
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { Pagination } from "../design-system/pagination";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagLabel,
  getAppTagDescription,
  getAppTagSlug,
} from "../lib/app-tag-metadata";
import { getAppTagEmoji } from "../lib/app-tag-visuals";
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
import { getInitials } from "../lib/get-initials";
import { buildAppTagOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

const BadgeLink = createLink(Badge);

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

export const Route = createFileRoute("/_header-layout/apps/")({
  validateSearch: validateBrowseSearch,
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
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  layout: {
    alignItems: "start",
    columnGap: gap["7xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "16rem minmax(0, 1fr)",
    },
    rowGap: gap["4xl"],
  },
  sidebar: {
    display: {
      default: "none",
      [breakpoints.lg]: "block",
    },
    position: "sticky",
    maxHeight: "calc(100vh - 6rem)",
    overflowY: "auto",
    top: verticalSpace["6xl"],
  },
  mobileFilters: {
    display: {
      default: "block",
      [breakpoints.lg]: "none",
    },
  },
  toolbar: {
    flexWrap: "wrap",
  },
  searchField: {
    flexBasis: "16rem",
    flexGrow: 1,
  },
  sortSelect: {
    minWidth: "12rem",
  },
  chips: {
    flexWrap: "wrap",
  },
  resultCount: {
    color: uiColor.text1,
  },
  row: {
    contentVisibility: "auto",
  },
  rowBody: {
    alignItems: "flex-start",
    columnGap: gap["3xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr)",
      [breakpoints.md]: "auto minmax(0, 1fr) auto",
    },
    rowGap: gap["md"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  rowLink: {
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    color: "inherit",
  },
  rowMeta: {
    flexWrap: "wrap",
    rowGap: gap["sm"],
  },
  badgeLink: {
    textDecoration: "none",
  },
  rowStats: {
    alignItems: {
      default: "center",
      [breakpoints.md]: "flex-end",
    },
    columnGap: gap["2xl"],
    display: "flex",
    flexDirection: {
      default: "row",
      [breakpoints.md]: "column",
    },
    flexWrap: "wrap",
    gridColumnEnd: {
      default: "span 2",
      [breakpoints.md]: "auto",
    },
    gridColumnStart: {
      default: "1",
      [breakpoints.md]: "auto",
    },
    rowGap: gap["sm"],
    whiteSpace: "nowrap",
  },
  statLine: {
    gap: gap["xs"],
    alignItems: "center",
    color: uiColor.text1,
    display: "inline-flex",
  },
  emptyState: {
    padding: verticalSpace["10xl"],
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

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <BrowseHeader />

        <div {...stylex.props(styles.layout)}>
          <aside aria-label="Filters" {...stylex.props(styles.sidebar)}>
            {filterPanel}
          </aside>

          <Flex direction="column" gap="2xl">
            <Flex align="center" gap="xl" style={styles.toolbar}>
              <div {...stylex.props(styles.searchField)}>
                <BrowseQueryField query={search.q ?? ""} />
              </div>
              <div {...stylex.props(styles.mobileFilters)}>
                <Drawer
                  direction="left"
                  trigger={
                    <Button variant="secondary" size="lg">
                      <SlidersHorizontal />
                      {activeFilterCount > 0
                        ? `Filters (${activeFilterCount})`
                        : "Filters"}
                    </Button>
                  }
                >
                  <DrawerHeader>Filters</DrawerHeader>
                  <DrawerBody>{filterPanel}</DrawerBody>
                  <DrawerFooter>
                    <Flex gap="md" justify="between">
                      <Button
                        variant="tertiary"
                        isDisabled={activeFilterCount === 0}
                        onPress={clearFilters}
                      >
                        Clear all
                      </Button>
                      <Button slot="close">
                        {`Show ${total} ${total === 1 ? "app" : "apps"}`}
                      </Button>
                    </Flex>
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
            </Flex>

            <ActiveFilterChips
              filters={filters}
              facets={facets}
              onRemove={toggleFilter}
              onClear={clearFilters}
            />

            <SmallBody style={styles.resultCount}>
              {total === totalListings
                ? `${totalListings} apps`
                : `${total} of ${totalListings} apps`}
            </SmallBody>

            {results.length > 0 ? (
              <Flex direction="column" gap="xl">
                {results.map((listing) => (
                  <BrowseListingRow key={listing.id} listing={listing} />
                ))}
              </Flex>
            ) : (
              <EmptyState size="lg" style={styles.emptyState}>
                <EmptyStateImage>
                  <SearchX size={64} strokeWidth={2} />
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
          </Flex>
        </div>
      </Flex>
    </Page.Root>
  );
}

function BrowseHeader() {
  return (
    <Flex direction="column" gap="2xl">
      <Heading1>Browse apps</Heading1>
      <Body variant="secondary">
        Every app, client and feed on the Atmosphere in one list. Narrow it down
        with the filters.
      </Body>
    </Flex>
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
    <Flex align="center" gap="md" style={styles.chips}>
      {chips.map(({ facet, value }) => {
        const label = getBrowseFilterValueLabel(facet, value, facets);
        return (
          <Button
            key={`${facet}:${value}`}
            size="sm"
            variant="secondary"
            aria-label={`Remove filter: ${label}`}
            onPress={() => onRemove(facet, value)}
          >
            {label}
            <X />
          </Button>
        );
      })}
      <Button size="sm" variant="tertiary" onPress={onClear}>
        Clear all
      </Button>
    </Flex>
  );
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatUpdatedAgo(iso: string) {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > -30) return relativeTimeFormat.format(days, "day");
  if (days > -365) {
    return relativeTimeFormat.format(Math.round(days / 30), "month");
  }
  return relativeTimeFormat.format(Math.round(days / 365), "year");
}

function addFilter(search: BrowseSearch, facet: BrowseFacet, value: string) {
  const filters = getBrowseFilters(search);
  const selected =
    facet === "categories"
      ? filters.categories
      : facet === "tags"
        ? filters.tags
        : [];
  return selected.includes(value)
    ? search
    : toggleBrowseFilter(search, facet, value);
}

function BrowseListingRow({ listing }: { listing: BrowseListingCard }) {
  const productParams = { productId: listing.slug };
  const handle = listing.productAccountHandle?.replace(/^@/, "");
  // Top-level apps are their own `apps/<name>` category, so only badge ecosystem tools and protocol.
  const category = listing.categorySlugs.find(
    (slug) => !(slug.startsWith("apps/") && slug.split("/").length === 2),
  );

  return (
    <Card style={styles.row}>
      <div {...stylex.props(styles.rowBody)}>
        <RouterLink to="/products/$productId" params={productParams}>
          <Avatar
            alt={listing.name}
            fallback={getInitials(listing.name)}
            size="xl"
            src={listing.iconUrl || undefined}
          />
        </RouterLink>

        <Flex direction="column" gap="md">
          <Flex align="center" gap="md" style={styles.rowMeta}>
            <RouterLink
              to="/products/$productId"
              params={productParams}
              {...stylex.props(styles.rowLink)}
            >
              <Text size="lg" weight="semibold">
                {listing.name}
              </Text>
            </RouterLink>
            {handle ? (
              <SmallBody variant="secondary">@{handle}</SmallBody>
            ) : null}
          </Flex>
          <Body variant="secondary">{listing.tagline}</Body>
          <Flex align="center" gap="sm" style={styles.rowMeta}>
            {category ? (
              <BadgeLink
                to="/apps"
                search={(prev: BrowseSearch) =>
                  addFilter(prev, "categories", category)
                }
                size="sm"
                style={styles.badgeLink}
              >
                {getBrowseCategoryLabel(category)}
              </BadgeLink>
            ) : null}
            {listing.appTags.map((tag) => (
              <BadgeLink
                key={tag}
                to="/apps"
                search={(prev: BrowseSearch) =>
                  addFilter(prev, "tags", getAppTagSlug(tag))
                }
                size="sm"
                variant="primary"
                style={styles.badgeLink}
              >
                {getAppTagEmoji(tag)} {formatAppTagLabel(tag)}
              </BadgeLink>
            ))}
          </Flex>
        </Flex>

        <div {...stylex.props(styles.rowStats)}>
          <StarRating
            rating={listing.rating}
            reviewCount={listing.reviewCount}
            showReviewCount
          />
          <SmallBody style={styles.statLine}>
            <Heart size={12} aria-hidden />
            {`${listing.favoriteCount} ${listing.favoriteCount === 1 ? "favorite" : "favorites"}`}
          </SmallBody>
          <SmallBody variant="secondary">
            Updated {formatUpdatedAgo(listing.updatedAt)}
          </SmallBody>
        </div>
      </div>
    </Card>
  );
}
