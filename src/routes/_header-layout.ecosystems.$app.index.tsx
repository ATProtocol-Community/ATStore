import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { EcosystemListingCard } from "../components/EcosystemListingCard";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  type DirectoryCategoryTreeNode,
  getAppEcosystemCategoryIdFromRouteParam,
  getAppSegmentFromEcosystemRootCategoryId,
  getEcosystemAllPathFromAppSegment,
} from "../lib/directory-categories";
import {
  formatEcosystemListingCount,
  getListingsForCategoryBranch,
  pickListingImageForCategoryBranch,
} from "../lib/ecosystem-listings";
import { buildRouteOgMeta } from "../lib/og-meta";
import { breakpoints } from "../design-system/theme/media-queries.stylex";

const ButtonLink = createLink(Button);
const AppLink = createLink(Link);
const INITIAL_SECTION_LISTING_COUNT = 6;

export const Route = createFileRoute("/_header-layout/ecosystems/$app/")({
  loader: async ({ context, params }) => {
    const categoryId = getAppEcosystemCategoryIdFromRouteParam(params.app);
    if (!categoryId) {
      throw notFound();
    }

    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId,
        sort: "popular",
      }),
    );

    if (!data) {
      throw notFound();
    }

    const { category, listings } = data;
    const heroImage = pickListingImageForCategoryBranch(category.id, listings);

    return {
      app: params.app,
      ogTitle: `${category.label} ecosystem | at-store`,
      ogDescription: category.description,
      ogImage: heroImage,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Ecosystem | at-store",
      description:
        loaderData?.ogDescription ||
        "Explore products and tools inside this ecosystem category.",
      image: loaderData?.ogImage,
    }),
  component: EcosystemIndexPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  sectionList: {
    gap: gap["8xl"],
  },
  section: {
    gap: gap["3xl"],
  },
  sectionHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sectionTitle: {
    flexGrow: 1,
  },
  sectionEyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  sectionDescription: {
    maxWidth: "44rem",
  },
  sectionGrid: {
    gap: gap["lg"],
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  searchButton: {
    marginTop: `calc(${verticalSpace["2xl"]} * -1)`,
    marginBottom: `calc(${verticalSpace["2xl"]} * -1)`,
  },
  pageContent: {
    gap: {
      default: 40,
      [breakpoints.sm]: 64,
    },
  },
});

function EcosystemIndexPage() {
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
      sort: "popular",
    }),
  );

  if (!data) {
    throw notFound();
  }

  const { category, listings } = data;
  const heroImage = pickListingImageForCategoryBranch(category.id, listings);
  const categorySections = category.children
    .map((child) => ({
      category: child,
      listings: getListingsForCategoryBranch(child.id, listings).slice(
        0,
        INITIAL_SECTION_LISTING_COUNT,
      ),
    }))
    .filter((section) => section.listings.length > 0);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <AppLink
              to="/products/$productId"
              params={{ productId: appSegment }}
            >
              <ChevronLeft />
              {category.label}
            </AppLink>

            <AppLink
              to="/ecosystems/$app/all"
              params={{ app: appSegment }}
              search={{ sort: "popular" }}
            >
              All tools
            </AppLink>
          </Flex>

          <AppTagHero
            description={category.description}
            eyebrow={formatEcosystemListingCount(category.count)}
            imageSrc={heroImage}
            title={`${category.label} ecosystem`}
          />
        </Flex>

        {categorySections.length > 0 ? (
          <Flex direction="column" style={styles.sectionList}>
            {categorySections.map((section, index) => (
              <EcosystemCategorySection
                key={section.category.id}
                category={section.category}
                listings={section.listings}
                sectionIndex={index}
              />
            ))}
          </Flex>
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Heading1>Categories</Heading1>
            <Body variant="secondary">
              This ecosystem does not have nested category sections yet.
            </Body>
            <AppLink to={getEcosystemAllPathFromAppSegment(appSegment)}>
              Search all listings in this ecosystem
            </AppLink>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}

function EcosystemCategorySection({
  category,
  listings,
  sectionIndex,
}: {
  category: DirectoryCategoryTreeNode;
  listings: ReturnType<typeof getListingsForCategoryBranch>;
  sectionIndex: number;
}) {
  return (
    <Flex direction="column" style={styles.section}>
      <Flex direction="column" gap="4xl" style={styles.sectionHeader}>
        <Flex justify="between" align="end" gap="2xl">
          <Flex direction="column" gap="2xl" style={styles.sectionTitle}>
            <Text size="sm" style={styles.sectionEyebrow}>
              {formatEcosystemListingCount(category.count)}
            </Text>
            <Text size="3xl" weight="semibold">
              {category.label}
            </Text>
            <Body variant="secondary" style={styles.sectionDescription}>
              {category.description}
            </Body>
          </Flex>
          <ButtonLink
            to="/categories/$categoryId"
            params={{ categoryId: category.id }}
            search={{ sort: "popular" }}
            size="lg"
            variant="secondary"
          >
            View all
          </ButtonLink>
        </Flex>
      </Flex>

      <FeaturedListingGrid
        hasFeatured={sectionIndex === 0}
        items={listings}
        getKey={(listing) => `${category.id}-${listing.id}`}
        canFeature={(listing) => Boolean(listing.heroImageUrl)}
        style={styles.sectionGrid}
        renderItem={(listing, { featured }) => (
          <EcosystemListingCard listing={listing} featured={featured} />
        )}
      />
    </Flex>
  );
}
