import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useFocusRing } from "react-aria";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { AppTagHero } from "../components/AppTagHero";
import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Card } from "../design-system/card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import { StarRating } from "../design-system/star-rating";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { formatAppTagLabel } from "../lib/app-tag-metadata";
import { getDirectoryCategoryOption } from "../lib/directory-categories";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { buildRouteOgMeta } from "../lib/og-meta";

const LinkLink = createLink(Link);

const sortOptions = [
  { id: "popular", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/search")({
  validateSearch: (
    search,
  ): { sort: "popular" | "newest" | "alphabetical" } => ({
    sort:
      search.sort === "newest"
        ? "newest"
        : search.sort === "alphabetical"
          ? "alphabetical"
          : "popular",
  }),
  loaderDeps: ({ search }) => ({
    sort: search.sort,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAllListingsQueryOptions({
        sort: deps.sort,
      }),
    ),
  head: () =>
    buildRouteOgMeta({
      title: "Search all listings | at-store",
      description:
        "Search across the full at-store directory in one place, including app and protocol listings.",
    }),
  component: SearchPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  resultsHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resultsActions: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  resultCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  sortSelect: {
    minWidth: "12rem",
  },
  searchFieldRow: {
    flexGrow: 1,
    maxWidth: "44rem",
  },
  listingGrid: {
    gap: gap["xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingCard: {
    contentVisibility: "auto",
    height: "100%",
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listingLink: {
    gap: gap["4xl"],
    outline: "none",
    textDecoration: "none",
    color: "inherit",
    display: "flex",
    flexBasis: "0%",
    flexDirection: "column",
    flexGrow: "1",
    flexShrink: "1",
    minHeight: 0,
  },
  listingCardFocus: {
    borderColor: blue.border3,
  },
  content: {
    gap: gap["4xl"],
    display: "flex",
    flexBasis: "0%",
    flexDirection: "column",
    flexGrow: "1",
    flexShrink: "1",
    minHeight: 0,
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingInfo: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  listingTagline: {
    flexGrow: 1,
  },
  listingFooter: {
    alignItems: "center",
  },
  listingTags: {
    flexWrap: "wrap",
    rowGap: gap.sm,
    maxWidth: "100%",
  },
  listingFooterRating: {
    flexShrink: 0,
  },
  emptyState: {
    padding: verticalSpace["10xl"],
  },
});

function SearchPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getAllListingsQueryOptions({
      sort: search.sort,
    }),
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredListings = useMemo(() => {
    if (!normalizedQuery) {
      return listings;
    }

    return listings.filter((listing) =>
      [
        listing.name,
        listing.tagline,
        listing.category,
        listing.description,
        ...listing.appTags,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [listings, normalizedQuery]);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <LinkLink to="/home">
              <ChevronLeft />
              Home
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow={`${listings.length} total listings`}
            title="Search all listings"
            description="Find any listing in one place, across apps and protocol tools."
          />
        </Flex>

        <Flex direction="column" gap="2xl">
          <Flex align="center" gap="sm" style={styles.resultsHeader}>
            <Flex
              align="center"
              direction="row"
              gap="2xl"
              style={styles.searchFieldRow}
            >
              <SearchField
                aria-label="Search all listings"
                onChange={setQuery}
                placeholder="Search listings"
                value={query}
                variant="secondary"
                size="lg"
              />
              <SmallBody style={styles.resultCount}>
                {getResultsLabel(
                  filteredListings.length,
                  listings.length,
                  normalizedQuery,
                )}
              </SmallBody>
            </Flex>
            <Flex gap="xl" style={styles.resultsActions}>
              <Select
                aria-label="Sort all listings"
                items={sortOptions}
                placeholder="Sort listings"
                size="lg"
                style={styles.sortSelect}
                value={search.sort}
                variant="secondary"
                onChange={(key) => {
                  if (
                    key !== "popular" &&
                    key !== "newest" &&
                    key !== "alphabetical"
                  ) {
                    return;
                  }

                  void router.navigate({
                    to: "/search",
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            </Flex>
          </Flex>

          {filteredListings.length > 0 ? (
            <Grid style={styles.listingGrid}>
              {filteredListings.map((listing) => (
                <ListingSearchCard key={listing.id} listing={listing} />
              ))}
            </Grid>
          ) : (
            <EmptyState size="lg" style={styles.emptyState}>
              <EmptyStateImage>
                <SearchX size={64} strokeWidth={2} />
              </EmptyStateImage>
              <EmptyStateTitle>No listings matched your search</EmptyStateTitle>
              <EmptyStateDescription>
                Try a different keyword to search across the full directory.
              </EmptyStateDescription>
            </EmptyState>
          )}
        </Flex>
      </Flex>
    </Page.Root>
  );
}

function ListingSearchCard({ listing }: { listing: DirectoryListingCard }) {
  const listingPathLabel = getDirectoryCategoryOption(
    listing.categorySlug,
  )?.pathLabel;
  const categorySegments = (listing.categorySlug ?? "")
    .split("/")
    .filter(Boolean);
  const isProtocolListing = categorySegments[0] === "protocol";
  const isAppListing =
    categorySegments[0] === "apps" || categorySegments[0] === "app";
  const isTopLevelAppListing = isAppListing && categorySegments.length === 2;
  const appSubpathLabel =
    isAppListing && categorySegments.length >= 3
      ? categorySegments.slice(1).join("/")
      : null;

  const { focusProps, isFocusVisible } = useFocusRing({});

  return (
    <RouterLink
      {...stylex.props(styles.listingLink)}
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...focusProps}
    >
      <Card
        style={[styles.listingCard, isFocusVisible && styles.listingCardFocus]}
      >
        <Flex direction="column" style={styles.listingCardBody}>
          <div {...stylex.props(styles.content)}>
            <Flex gap="2xl" align="center" style={styles.listingHeader}>
              <Avatar
                alt={listing.name}
                fallback={getInitials(listing.name)}
                size="xl"
                src={listing.iconUrl || undefined}
              />
              <Flex direction="column" gap="xl" style={styles.listingInfo}>
                <Text size="xl" weight="semibold">
                  {listing.name}
                </Text>
                <SmallBody variant="secondary">
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </SmallBody>
              </Flex>
            </Flex>

            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>
          </div>

          <Flex
            justify="between"
            gap="xl"
            align="start"
            style={styles.listingFooter}
          >
            <Flex align="center" gap="sm" style={styles.listingTags}>
              {isTopLevelAppListing && listing.appTags.length > 0 ? (
                listing.appTags.map((tag) => (
                  <Badge key={tag} size="sm" variant="primary">
                    {formatAppTagLabel(tag)}
                  </Badge>
                ))
              ) : (
                <Badge size="sm" variant="primary">
                  {isProtocolListing
                    ? (listingPathLabel ?? listing.category)
                    : (appSubpathLabel ?? listingPathLabel ?? listing.category)}
                </Badge>
              )}
            </Flex>
            <Flex align="center" gap="sm" style={styles.listingFooterRating}>
              <SmallBody variant="secondary">
                {listing.rating == null ? "—" : listing.rating.toFixed(1)}
              </SmallBody>
              <StarRating
                rating={listing.rating}
                reviewCount={listing.reviewCount}
                showReviewCount
              />
            </Flex>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function getResultsLabel(
  filteredCount: number,
  totalCount: number,
  normalizedQuery: string,
) {
  if (!normalizedQuery) {
    return `${totalCount} listings`;
  }

  return `Showing ${filteredCount} of ${totalCount} listings`;
}
