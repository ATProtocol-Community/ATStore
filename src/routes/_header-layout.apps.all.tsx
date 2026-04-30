import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  useRouter,
} from "@tanstack/react-router";
import { Badge } from "#/design-system/badge";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

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
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { formatAppTagLabel, getAppTagSlug } from "../lib/app-tag-metadata";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { buildRouteOgMeta } from "../lib/og-meta";

const LinkLink = createLink(Link);

const sortOptions = [
  { id: "popular", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/apps/all")({
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
      directoryListingApi.getAllAppsQueryOptions({
        sort: deps.sort,
      }),
    ),
  head: () =>
    buildRouteOgMeta({
      title: "All apps | at-store",
      description:
        "Browse the full Bluesky app catalog and filter by search, popularity, or newest listings.",
    }),
  component: AppsAllPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  searchField: {
    flexGrow: 1,
    maxWidth: "40rem",
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
    gap: gap["xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingLink: {
    gap: gap["4xl"],
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    height: "100%",
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
  listingMainLink: {
    textDecoration: "none",
    color: "inherit",
    display: "flex",
    flexBasis: "0%",
    flexDirection: "column",
    flexGrow: "1",
    flexShrink: "1",
    minHeight: 0,
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
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  listingTagLink: {
    textDecoration: "none",
  },
});

function AppsAllPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { data: apps } = useSuspenseQuery(
    directoryListingApi.getAllAppsQueryOptions({
      sort: search.sort,
    }),
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredApps = useMemo(() => {
    if (!normalizedQuery) {
      return apps;
    }

    return apps.filter((listing) =>
      [
        listing.name,
        listing.tagline,
        listing.category,
        listing.description,
        ...listing.appTags,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [apps, normalizedQuery]);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <LinkLink to="/home">
              <ChevronLeft />
              Home
            </LinkLink>
            <LinkLink to="/apps/tags">Browse by tag</LinkLink>
          </Flex>

          <AppTagHero
            eyebrow={`${apps.length} curated app listings`}
            title="Browse All Apps"
            description="Scan the full Bluesky app catalog in one place, then narrow it down with search or jump into editorial collections by tag."
          />
        </Flex>

        <Flex direction="column" gap="2xl">
          <Flex align="center" gap="sm" style={styles.resultsHeader}>
            <Flex
              direction="row"
              gap="2xl"
              align="center"
              style={styles.searchField}
            >
              <SearchField
                aria-label="Search all apps"
                onChange={setQuery}
                placeholder="Search apps"
                value={query}
                variant="secondary"
                size="lg"
              />
              <SmallBody style={styles.resultCount}>
                {getResultsLabel(
                  filteredApps.length,
                  apps.length,
                  normalizedQuery,
                )}
              </SmallBody>
            </Flex>
            <Flex gap="xl" style={styles.resultsActions}>
              <Select
                aria-label="Sort apps"
                items={sortOptions}
                placeholder="Sort apps"
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
                    to: "/apps/all",
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            </Flex>
          </Flex>

          {filteredApps.length > 0 ? (
            <Grid style={styles.listingGrid}>
              {filteredApps.map((listing) => (
                <AllAppsListingCard key={listing.id} listing={listing} />
              ))}
            </Grid>
          ) : (
            <Flex direction="column" style={styles.emptyState}>
              <Text size="2xl" weight="semibold">
                No apps matched your search
              </Text>
              <Body variant="secondary">
                Try a different keyword, or browse the editorial collections to
                explore by workflow instead.
              </Body>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Page.Root>
  );
}

function AllAppsListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <Card style={styles.listingCard}>
      <Flex direction="column" style={styles.listingCardBody}>
        <RouterLink
          to="/products/$productId"
          params={{ productId: getDirectoryListingSlug(listing) }}
          {...stylex.props(styles.listingLink, styles.listingMainLink)}
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
            {listing.appTags.length > 0 ? (
              listing.appTags.map((tag) => (
                <RouterLink
                  key={tag}
                  to="/apps/$tag"
                  params={{ tag: getAppTagSlug(tag) }}
                  search={{ sort: "popular" }}
                  {...stylex.props(styles.listingTagLink)}
                >
                  <Badge
                    size="sm"
                    variant="primary"
                    style={styles.listingTagLink}
                  >
                    {formatAppTagLabel(tag)}
                  </Badge>
                </RouterLink>
              ))
            ) : (
              <SmallBody variant="secondary">—</SmallBody>
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
  );
}

function getResultsLabel(
  filteredCount: number,
  totalCount: number,
  hasQuery: string,
) {
  if (!hasQuery) {
    return `${totalCount} apps`;
  }

  return `Showing ${filteredCount} of ${totalCount} apps`;
}
