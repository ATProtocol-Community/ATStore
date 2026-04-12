import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { BlueskyMentionCard } from "../components/BlueskyMentionCard";
import { Flex } from "../design-system/flex";
import { Body } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";
import { ProductReviewsPageChrome } from "../lib/product-reviews-route";

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

function ListingMentionsPage() {
  const { productId, productSlug } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingMentionsQueryOptions(
      productId,
      LISTING_MENTIONS_FULL_PAGE_LIMIT,
    ),
  );

  return (
    <ProductReviewsPageChrome productId={productId} productSlug={productSlug}>
      <Flex direction="column" gap="4xl">
        <Body variant="secondary">
          Posts that mention this listing (matched by product handle, link, or
          name). Showing up to {LISTING_MENTIONS_FULL_PAGE_LIMIT} most recent.
        </Body>
        <Flex direction="column">
          {data.mentions.map((mention) => (
            <BlueskyMentionCard key={mention.id} mention={mention} />
          ))}
        </Flex>
      </Flex>
    </ProductReviewsPageChrome>
  );
}
