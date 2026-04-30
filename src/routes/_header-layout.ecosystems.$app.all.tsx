import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { AppTagHero } from "../components/AppTagHero";
import {
  EcosystemListingCard,
  ecosystemListingGridStyles,
} from "../components/EcosystemListingCard";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import { Select, SelectItem } from "../design-system/select";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { SmallBody } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getAppEcosystemCategoryIdFromRouteParam,
  getAppSegmentFromEcosystemRootCategoryId,
} from "../lib/directory-categories";
import {
  formatEcosystemListingCount,
  pickListingImageForCategoryBranch,
} from "../lib/ecosystem-listings";
import { buildRouteOgMeta } from "../lib/og-meta";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";

const AppLink = createLink(Link);
const sortOptions = [
  { id: "popular", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/ecosystems/$app/all")({
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
  loader: async ({ context, params, deps }) => {
    const categoryId = getAppEcosystemCategoryIdFromRouteParam(params.app);
    if (!categoryId) {
      throw notFound();
    }

    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId,
        sort: deps.sort,
      }),
    );

    if (!data) {
      throw notFound();
    }

    const { category, listings } = data;
    const heroImage = pickListingImageForCategoryBranch(category.id, listings);

    return {
      app: params.app,
      ogTitle: `${category.label} ecosystem listings | at-store`,
      ogDescription: `Search every listing filed under ${category.pathLabels.join(" / ")}.`,
      ogImage: heroImage,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Ecosystem listings | at-store",
      description:
        loaderData?.ogDescription ||
        "Search listings within this ecosystem on at-store.",
      image: loaderData?.ogImage,
    }),
  component: EcosystemAllPage,
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
  resultsHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resultCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  resultsActions: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  sortSelect: {
    minWidth: "12rem",
  },
  emptyState: {
    padding: verticalSpace["10xl"],
  },
  searchFieldRow: {
    flexGrow: 1,
    maxWidth: "40rem",
  },
});

function EcosystemAllPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { app } = Route.useLoaderData();
  const categoryId = getAppEcosystemCategoryIdFromRouteParam(app);
  if (!categoryId) {
    throw notFound();
  }

  const appSegment = getAppSegmentFromEcosystemRootCategoryId(categoryId);
  if (!appSegment) {
    throw notFound();
  }

  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId,
      sort: search.sort,
    }),
  );

  if (!data) {
    throw notFound();
  }

  const { category, listings } = data;
  const heroImage = pickListingImageForCategoryBranch(category.id, listings);

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
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [listings, normalizedQuery]);

  const [, AppName] = category.pathLabels;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            <AppLink to="/ecosystems/$app" params={{ app: appSegment }}>
              <ChevronLeft />
              Back to {AppName} Ecosystem
            </AppLink>
          </Flex>

          <AppTagHero
            description={`Search every listing filed under ${category.pathLabels.join(" / ")} — clients, tools, and more.`}
            eyebrow={formatEcosystemListingCount(listings.length)}
            imageSrc={heroImage}
            title={`Search ${category.label} ecosystem`}
          />
        </Flex>

        <Flex direction="column" gap="2xl" style={styles.searchSection}>
          <Flex align="center" gap="md" style={styles.resultsHeader}>
            <Flex
              align="center"
              direction="row"
              gap="2xl"
              style={styles.searchFieldRow}
            >
              <SearchField
                aria-label={`Search listings in ${category.label}`}
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
                aria-label="Sort ecosystem listings"
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
                    to: "/ecosystems/$app/all",
                    params: { app },
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            </Flex>
          </Flex>

          {filteredListings.length > 0 ? (
            <Grid style={ecosystemListingGridStyles.grid}>
              {filteredListings.map((listing) => (
                <EcosystemListingCard key={listing.id} listing={listing} />
              ))}
            </Grid>
          ) : (
            <EmptyState size="lg" style={styles.emptyState}>
              <EmptyStateImage>
                <SearchX size={64} strokeWidth={2} />
              </EmptyStateImage>
              <EmptyStateTitle>No listings matched your search</EmptyStateTitle>
              <EmptyStateDescription>
                Try a different keyword or browse categories from the ecosystem
                home page.
              </EmptyStateDescription>
            </EmptyState>
          )}
        </Flex>
      </Flex>
    </Page.Root>
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
