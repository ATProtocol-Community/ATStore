import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { AppTagHero } from "../components/AppTagHero";
import {
  EcosystemListingCard,
  ecosystemListingGridStyles,
} from "../components/EcosystemListingCard";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
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

const AppLink = createLink(Link);

export const Route = createFileRoute("/_header-layout/ecosystems/$app/all")({
  loader: async ({ context, params }) => {
    const categoryId = getAppEcosystemCategoryIdFromRouteParam(params.app);
    if (!categoryId) {
      throw notFound();
    }

    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({ categoryId }),
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

function EcosystemAllPage() {
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
    directoryListingApi.getDirectoryCategoryPageQueryOptions({ categoryId }),
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
    <HeaderLayout.Page>
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

          <Flex direction="column" gap="4xl" style={styles.searchSection}>
            <Flex align="center" gap="2xl" style={styles.resultsHeader}>
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
            </Flex>

            {filteredListings.length > 0 ? (
              <Grid style={ecosystemListingGridStyles.grid}>
                {filteredListings.map((listing) => (
                  <EcosystemListingCard key={listing.id} listing={listing} />
                ))}
              </Grid>
            ) : (
              <Flex direction="column" style={styles.emptyState}>
                <Text size="2xl" weight="semibold">
                  No listings matched your search
                </Text>
                <Body variant="secondary">
                  Try a different keyword or browse categories from the
                  ecosystem home page.
                </Body>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
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
