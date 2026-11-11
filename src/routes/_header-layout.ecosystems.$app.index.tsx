import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";

import {
  EcosystemBranchSection,
  EcosystemJumpLinks,
  EcosystemRootCard,
} from "../components/shelf/discovery/Ecosystem";
import { getEcosystemIntro } from "../components/shelf/discovery/ecosystem-copy";
import { BackLink, MoreLink, PageHero } from "../components/shelf/Section";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getAppEcosystemCategoryIdFromRouteParam,
  getAppSegmentFromEcosystemRootCategoryId,
} from "../lib/directory-categories";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import {
  formatEcosystemListingCount,
  getListingsForCategoryBranch,
  pickListingImageForCategoryBranch,
} from "../lib/ecosystem-listings";
import { buildRouteOgMeta } from "../lib/og-meta";

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
  empty: {
    padding: 32,
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    color: uiColor.text1,
    display: "flex",
    flexDirection: "column",
    rowGap: 12,
    marginTop: 24,
  },
  emptyTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
  },
  emptyText: {
    margin: 0,
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
  const branches = category.children
    .map((child) => ({
      category: child,
      listings: getListingsForCategoryBranch(child.id, listings),
    }))
    .filter((branch) => branch.listings.length > 0);

  // The ecosystem's own app (e.g. Bluesky for apps/bluesky), shown beside the hero.
  const rootListing =
    listings.find(
      (listing) => getDirectoryListingSlug(listing) === appSegment,
    ) ??
    listings.find(
      (listing) =>
        listing.categorySlugs.includes(category.id) &&
        listing.name.toLowerCase() === category.label.toLowerCase(),
    );

  return (
    <>
      <PageHero
        back={
          rootListing ? undefined : (
            <BackLink
              to="/products/$productId"
              params={{ productId: appSegment }}
            >
              {category.label}
            </BackLink>
          )
        }
        eyebrow={formatEcosystemListingCount(category.count)}
        title={`${category.label} ecosystem`}
        description={getEcosystemIntro(category)}
        aside={rootListing ? <EcosystemRootCard listing={rootListing} /> : null}
      />

      {branches.length > 0 ? (
        <>
          <EcosystemJumpLinks
            branches={branches.map((branch) => branch.category)}
            allId={category.id}
          />
          {branches.map((branch, index) => (
            <EcosystemBranchSection
              key={branch.category.id}
              branch={branch.category}
              listings={branch.listings}
              lead={index === 0}
            />
          ))}
        </>
      ) : (
        <div {...stylex.props(styles.empty)}>
          <h2 {...stylex.props(styles.emptyTitle)}>Categories</h2>
          <p {...stylex.props(styles.emptyText)}>
            This ecosystem does not have nested category sections yet.
          </p>
          <MoreLink to="/apps" search={{ in: category.id }}>
            Search all listings in this ecosystem
          </MoreLink>
        </div>
      )}
    </>
  );
}
