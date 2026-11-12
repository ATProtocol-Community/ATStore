import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { BlueskyMentionCard } from "../components/BlueskyMentionCard";
import { BackLink, PageHero } from "../components/shelf/Section";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";

const LISTING_MENTIONS_FULL_PAGE_LIMIT = 50;

export const Route = createFileRoute(
  "/_header-layout/products/$productId/mentions",
)({
  loader: async ({ context, params }) => {
    const legacyListingId = getLegacyDirectoryListingId(params.productId);
    const listing = await context.queryClient.ensureQueryData(
      legacyListingId
        ? directoryListingApi.getDirectoryListingDetailQueryOptions(
            legacyListingId,
          )
        : directoryListingApi.getDirectoryListingDetailBySlugQueryOptions(
            params.productId,
          ),
    );

    if (!listing) {
      throw notFound();
    }

    const productSlug = getDirectoryListingSlug(listing);

    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId/mentions",
        params: { productId: productSlug },
        replace: true,
      });
    }

    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingMentionsQueryOptions(
        listing.id,
        LISTING_MENTIONS_FULL_PAGE_LIMIT,
      ),
    );

    return {
      productId: listing.id,
      productSlug,
      listingName: listing.name,
      ogTitle: `${listing.name} — Bluesky mentions | at-store`,
      ogDescription:
        listing.tagline ||
        "Posts on Bluesky that mention this listing on at-store.",
      ogImage: listing.heroImageUrl || null,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Bluesky mentions | at-store",
      description:
        loaderData?.ogDescription ||
        "Posts on Bluesky that mention this product listing.",
      image: loaderData?.ogImage,
    }),
  component: ListingMentionsPage,
});

const styles = stylex.create({
  page: {
    marginInline: "auto",
    maxWidth: 820,
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  list: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  empty: {
    color: uiColor.text1,
  },
});

function ListingMentionsPage() {
  const { productId, productSlug, listingName } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingMentionsQueryOptions(
      productId,
      LISTING_MENTIONS_FULL_PAGE_LIMIT,
    ),
  );

  return (
    <div {...stylex.props(styles.page)}>
      <PageHero
        back={
          <BackLink
            to="/products/$productId"
            params={{ productId: productSlug }}
          >
            Back to {listingName}
          </BackLink>
        }
        eyebrow="Mentions"
        title={`${listingName} on Bluesky`}
        description={`Posts that mention this listing (matched by product handle, link, or name). Showing up to ${String(LISTING_MENTIONS_FULL_PAGE_LIMIT)} most recent.`}
      />
      {data.mentions.length > 0 ? (
        <div {...stylex.props(styles.list)}>
          {data.mentions.map((mention) => (
            <BlueskyMentionCard key={mention.id} mention={mention} />
          ))}
        </div>
      ) : (
        <p {...stylex.props(styles.empty)}>
          No one has mentioned {listingName} on Bluesky yet.
        </p>
      )}
    </div>
  );
}
