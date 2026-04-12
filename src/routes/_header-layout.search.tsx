import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { AppTagHero } from "../components/AppTagHero";
import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import { StarRating } from "../design-system/star-rating";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryCategoryOption } from "../lib/directory-categories";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";
import { getProtocolPageHeroArtSpec } from "../lib/protocol-page-hero-art";

const LinkLink = createLink(Link);

const sortOptions = [
  { id: "trending", label: "Trending" },
  { id: "newest", label: "Newest" },
] as const;

export const Route = createFileRoute("/_header-layout/search")({
  validateSearch: (search): { sort: "trending" | "newest" } => ({
    sort: search.sort === "newest" ? "newest" : "trending",
  }),
  loaderDeps: ({ search }) => ({
    sort: search.sort,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAllListingsQueryOptions({
        sort: deps.sort === "newest" ? "newest" : "popular",
      }),
    ),
  head: () =>
    buildRouteOgMeta({
      title: "Search all listings | at-store",
      description:
        "Search across the full at-store directory in one place, including app and protocol listings.",
      image: getProtocolPageHeroArtSpec("search")?.assetPath,
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
    width: "100%",
  },
  listingGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingCard: {
    contentVisibility: "auto",
    height: "100%",
    minHeight: "15rem",
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
    color: "inherit",
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: gap["4xl"],
    minHeight: 0,
    textDecoration: "none",
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingInfo: {
    flex: 1,
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
    maxWidth: "100%",
    rowGap: gap.sm,
  },
  listingTagLink: {
    textDecoration: "none",
  },
  listingFooterRating: {
    flexShrink: 0,
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
});

function SearchPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getAllListingsQueryOptions({
      sort: search.sort === "newest" ? "newest" : "popular",
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
            imageSrc={getProtocolPageHeroArtSpec("search")?.assetPath}
          />
        </Flex>

        <Flex direction="column" gap="4xl">
          <Flex align="center" gap="2xl" style={styles.resultsHeader}>
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
                  if (key !== "trending" && key !== "newest") {
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
            <Flex direction="column" style={styles.emptyState}>
              <Text size="2xl" weight="semibold">
                No listings matched your search
              </Text>
              <Body variant="secondary">
                Try a different keyword to search across the full directory.
              </Body>
            </Flex>
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

  return (
    <Card style={styles.listingCard}>
      <Flex direction="column" style={styles.listingCardBody}>
        <RouterLink
          to="/products/$productId"
          params={{ productId: getDirectoryListingSlug(listing) }}
          {...stylex.props(styles.listingLink)}
        >
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
                @{listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
              </SmallBody>
            </Flex>
          </Flex>

          <Body variant="secondary" style={styles.listingTagline}>
            {listing.tagline}
          </Body>
        </RouterLink>

        <Flex
          justify="between"
          gap="xl"
          align="start"
          style={styles.listingFooter}
        >
          <Flex align="center" gap="sm" style={styles.listingTags}>
            <Badge size="sm" variant="primary">
              {listingPathLabel ?? listing.category}
            </Badge>
          </Flex>
          <Flex align="center" gap="sm" style={styles.listingFooterRating}>
            <SmallBody variant="secondary">
              {listing.rating != null ? listing.rating.toFixed(1) : "—"}
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
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
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
