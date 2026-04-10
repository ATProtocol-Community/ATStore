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
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { StarRating } from "../design-system/star-rating";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getAppTagHeroArtSpec } from "../lib/app-tag-hero-art";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";

const LinkLink = createLink(Link);

const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
] as const;

export const Route = createFileRoute("/apps/all")({
  validateSearch: (search): { sort: "popular" | "newest" } => ({
    sort: search.sort === "newest" ? "newest" : "popular",
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
  searchSection: {
    gap: gap["3xl"],
  },
  searchCopy: {
    maxWidth: "42rem",
  },
  searchField: {
    maxWidth: "40rem",
    width: "100%",
    flexGrow: 1,
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
    display: "block",
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
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
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
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [apps, normalizedQuery]);

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" gap="7xl">
            <Flex direction="column" gap="4xl">
              <Flex gap="xl" justify="between" style={styles.navLinks}>
                <LinkLink to="/">
                  <ChevronLeft />
                  Home
                </LinkLink>
                <LinkLink to="/apps/tags">Browse by tag</LinkLink>
              </Flex>

              <AppTagHero
                eyebrow={`${apps.length} curated app listings`}
                title="Browse All Apps"
                description="Scan the full Bluesky app catalog in one place, then narrow it down with search or jump into editorial collections by tag."
                imageSrc={getAppTagHeroArtSpec("all-apps")?.assetPath}
              />
            </Flex>

            <Flex direction="column" gap="4xl">
              <Flex align="center" gap="2xl" style={styles.resultsHeader}>
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
                      if (key !== "popular" && key !== "newest") {
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
                    Try a different keyword, or browse the editorial collections
                    to explore by workflow instead.
                  </Body>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function AllAppsListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listingLink)}
    >
      <Card style={styles.listingCard}>
        <Flex direction="column" style={styles.listingCardBody}>
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
                <SmallBody variant="secondary">{listing.category}</SmallBody>
                <SmallBody variant="secondary">
                  {listing.rating.toFixed(1)}
                </SmallBody>
                <StarRating rating={listing.rating} />
              </Flex>
            </Flex>
          </Flex>

          <Body variant="secondary" style={styles.listingTagline}>
            {listing.tagline}
          </Body>

          <div />

          <Flex justify="between" gap="xl" style={styles.listingFooter}>
            <Text size="sm" weight="semibold">
              {listing.rating.toFixed(1)} rating
            </Text>
            <Text weight="semibold">{listing.priceLabel}</Text>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
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
  hasQuery: string,
) {
  if (!hasQuery) {
    return `${totalCount} apps`;
  }

  return `Showing ${filteredCount} of ${totalCount} apps`;
}
