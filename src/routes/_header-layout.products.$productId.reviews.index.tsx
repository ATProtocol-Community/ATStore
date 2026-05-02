import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { z } from "zod";

import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getLegacyDirectoryListingId } from "../lib/directory-listing-slugs";
import { buildListingReviewOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";
import { Route as ProductReviewsRoute } from "./_header-layout.products.$productId.reviews";

const reviewsIndexSearchSchema = z.object({
  review: z.string().uuid().optional(),
  reply: z.string().uuid().optional(),
});

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews/",
)({
  validateSearch: reviewsIndexSearchSchema,
  loaderDeps: ({ search }) => ({ reviewFromSearch: search.review }),
  loader: async ({ context, params, deps }) => {
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

    const reviews = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
    );

    let ogTitle = `${listing.name} reviews | at-store`;
    let ogDescription =
      listing.tagline || "Read and write reviews for products on at-store.";
    let ogImage: string | null = listing.heroImageUrl || null;
    let ogImageAlt: string | null = null;

    const reviewParam = deps.reviewFromSearch;
    if (reviewParam) {
      const hit = reviews.find((r) => r.id === reviewParam);
      if (hit) {
        ogImage = buildListingReviewOgImageUrl({
          listingId: listing.id,
          reviewId: hit.id,
        });
        const author = hit.authorDisplayName?.trim() || "Someone";
        /** “Read” surfaces in link previews (Slack, Discord, iMessage) via og:title / description. */
        ogTitle = `Read · ${author}'s “${listing.name}” review | at-store`;
        ogDescription = `${String(hit.rating)}/5 — Open to read the full review on at-store.`;
        ogImageAlt = `Read ${author}'s review of ${listing.name} on AT Store`;
      }
    }

    return {
      ogTitle,
      ogDescription,
      ogImage,
      ogImageAlt,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Product reviews | at-store",
      description:
        loaderData?.ogDescription ||
        "Read and write reviews for products on at-store.",
      image: loaderData?.ogImage,
      imageAlt: loaderData?.ogImageAlt ?? null,
    }),
  component: ProductReviewsListPage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  headerCopy: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  ratingRow: {
    alignItems: "center",
    color: uiColor.text1,
  },
});

function ProductReviewsListPage() {
  const navigate = useNavigate();
  const { review: reviewSearchId, reply: replySearchId } = Route.useSearch();
  const { productId, productSlug } = ProductReviewsRoute.useLoaderData();
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const reviewsQuery =
    directoryListingApi.getDirectoryListingReviewsQueryOptions(productId);

  const { data: listing } = useSuspenseQuery(detailQuery);
  const { data: reviews } = useSuspenseQuery(reviewsQuery);
  const { data: session } = useQuery(user.getSessionQueryOptions);

  useLayoutEffect(() => {
    if (replySearchId) {
      requestAnimationFrame(() => {
        document
          .querySelector(`#listing-review-reply-${replySearchId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    if (!reviewSearchId) {
      return;
    }

    const el = document.querySelector(`#listing-review-${reviewSearchId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reviewSearchId, replySearchId]);

  if (!listing) {
    throw notFound();
  }

  return (
    <Flex direction="column" gap="2xl">
      <Flex direction="column" gap="4xl">
        <Flex align="center" gap="2xl" justify="between" wrap>
          <Flex gap="2xl" align="center" style={styles.headerCopy}>
            <Text weight="semibold" size="3xl">
              Reviews
            </Text>
            <Flex gap="md" align="center" style={styles.ratingRow}>
              <Flex gap="xs">
                <Text weight="semibold">
                  {listing.rating == null ? "—" : listing.rating.toFixed(1)}
                </Text>
                <Text size="sm" variant="secondary">
                  ({listing.reviewCount})
                </Text>
              </Flex>
              <StarRating
                rating={listing.rating}
                reviewCount={listing.reviewCount}
                showReviewCount={false}
              />
            </Flex>
          </Flex>
          <AppLink
            to="/products/$productId/reviews/write"
            params={{ productId: productSlug }}
          >
            Write a review
          </AppLink>
        </Flex>
      </Flex>

      <Flex direction="column" gap="2xl">
        {reviews.map((review) => (
          <DirectoryListingReviewCard
            key={review.id}
            listingId={productId}
            review={review}
            viewerDid={session?.user?.did ?? null}
            anchorId={`listing-review-${review.id}`}
            shareProductSlug={productSlug}
            listingRepoDid={listing.repoDid}
            listingProductAccountDid={listing.productAccountDid}
            onEditReview={() => {
              void navigate({
                to: "/products/$productId/reviews/$reviewId/edit",
                params: {
                  productId: productSlug,
                  reviewId: review.id,
                },
              });
            }}
          />
        ))}
      </Flex>
    </Flex>
  );
}
