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
import { Badge } from "#/design-system/badge";

const LinkLink = createLink(Link);

const sortOptions = [
  { id: "popular", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/protocol/listings")({
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
      directoryListingApi.getAllProtocolListingsQueryOptions({
        sort: deps.sort,
      }),
    ),
  head: () =>
    buildRouteOgMeta({
      title: "All protocol listings | at-store",
      description:
        "Search every protocol listing in the directory: infrastructure, tooling, and services filed under protocol categories.",
      image: getProtocolPageHeroArtSpec("listings")?.assetPath,
    }),
  component: ProtocolListingsPage,
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
  listingGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingLink: {
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    height: "100%",
    textDecoration: "none",
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
  listingMainLink: {
    color: "inherit",
    display: "flex",
    flex: 1,
    flexDirection: "column",
    minHeight: 0,
    textDecoration: "none",
  },
  listingTags: {
    flexWrap: "wrap",
    maxWidth: "100%",
    rowGap: gap.sm,
  },
  listingFooterRating: {
    flexShrink: 0,
  },
  categoryLink: {
    textDecoration: "none",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  searchFieldRow: {
    flexGrow: 1,
    maxWidth: "40rem",
    width: "100%",
  },
});

function ProtocolListingsPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getAllProtocolListingsQueryOptions({
      sort: search.sort,
    }),
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return listings;
    }

    return listings.filter((listing) =>
      [
        listing.name,
        listing.tagline,
        listing.category,
        listing.description,
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
            <LinkLink to="/protocol/tags">Browse by category</LinkLink>
          </Flex>

          <AppTagHero
            description="Search every protocol listing in the directory — infrastructure, tooling, and services filed under protocol/*."
            eyebrow={`${listings.length} protocol listings`}
            imageSrc={getProtocolPageHeroArtSpec("listings")?.assetPath}
            title="Search protocol listings"
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
                aria-label="Search all protocol listings"
                onChange={setQuery}
                placeholder="Search protocol listings"
                value={query}
                variant="secondary"
                size="lg"
              />
              <SmallBody style={styles.resultCount}>
                {getResultsLabel(
                  filtered.length,
                  listings.length,
                  normalizedQuery,
                )}
              </SmallBody>
            </Flex>
            <Flex gap="xl" style={styles.resultsActions}>
              <Select
                aria-label="Sort protocol listings"
                items={sortOptions}
                placeholder="Sort protocol listings"
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
                    to: "/protocol/listings",
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            </Flex>
          </Flex>

          {filtered.length > 0 ? (
            <Grid style={styles.listingGrid}>
              {filtered.map((listing) => (
                <ProtocolListingCard key={listing.id} listing={listing} />
              ))}
            </Grid>
          ) : (
            <Flex direction="column" style={styles.emptyState}>
              <Text size="2xl" weight="semibold">
                No listings matched your search
              </Text>
              <Body variant="secondary">
                Try a different keyword, or browse categories to explore by area
                instead.
              </Body>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Page.Root>
  );
}

function ProtocolListingCard({ listing }: { listing: DirectoryListingCard }) {
  const protocolCategory = getProtocolCategoryLink(listing);

  return (
    <Card style={styles.listingCard}>
      <Flex direction="column" style={styles.listingCardBody}>
        <RouterLink
          params={{ productId: getDirectoryListingSlug(listing) }}
          to="/products/$productId"
          {...stylex.props(styles.listingLink, styles.listingMainLink)}
        >
          <Flex align="center" gap="2xl" style={styles.listingHeader}>
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
              <Flex align="center" gap="lg">
                <SmallBody variant="secondary">
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </SmallBody>
              </Flex>
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
            {protocolCategory ? (
              <RouterLink
                params={{ category: protocolCategory.segment }}
                to="/protocol/$category"
                search={{ sort: "popular" }}
                {...stylex.props(styles.categoryLink)}
              >
                <Badge size="sm" variant="primary">
                  {protocolCategory.label}
                </Badge>
              </RouterLink>
            ) : (
              <SmallBody variant="secondary">—</SmallBody>
            )}
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

/**
 * First `protocol/{segment}` on the listing (two-part slug), for category badge + link.
 */
function getProtocolCategoryLink(
  listing: DirectoryListingCard,
): { segment: string; label: string } | null {
  const slug = listing.categorySlugs.find(
    (s) =>
      s.startsWith("protocol/") && s.split("/").filter(Boolean).length === 2,
  );
  if (!slug) {
    return null;
  }
  const segment = slug.split("/")[1]?.trim();
  if (!segment) {
    return null;
  }
  const option = getDirectoryCategoryOption(slug);
  const label =
    (
      option?.pathLabels.slice(1).join(" ") ||
      option?.label ||
      listing.category
    ).trim() || segment;
  return { segment, label };
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
