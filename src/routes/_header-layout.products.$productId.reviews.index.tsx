import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";

import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { Route as ProductReviewsRoute } from "./_header-layout.products.$productId.reviews";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews/",
)({
  component: ProductReviewsListPage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  ratingRow: {
    alignItems: "center",
    color: uiColor.text1,
  },
});

function ProductReviewsListPage() {
  const navigate = useNavigate();
  const { productId, productSlug } = ProductReviewsRoute.useLoaderData();
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const reviewsQuery =
    directoryListingApi.getDirectoryListingReviewsQueryOptions(productId);

  const { data: listing } = useSuspenseQuery(detailQuery);
  const { data: reviews } = useSuspenseQuery(reviewsQuery);
  const { data: session } = useQuery(user.getSessionQueryOptions);

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
                  {listing.rating != null ? listing.rating.toFixed(1) : "—"}
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
