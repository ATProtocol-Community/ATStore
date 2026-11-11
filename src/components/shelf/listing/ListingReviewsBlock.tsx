import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { PenLine } from "lucide-react";

import type { DirectoryListingDetail } from "../../../integrations/tanstack-query/api-directory-listings.functions";
import type { StoreListingPageSnapshotPayload } from "../../../lib/listing-page-snapshot.types";

import { Button } from "../../../design-system/button";
import { StarRating } from "../../../design-system/star-rating";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { fontFamily } from "../../../design-system/theme/typography.stylex";
import { user } from "../../../integrations/tanstack-query/api-user.functions";
import { DirectoryListingReviewCard } from "../../DirectoryListingReviewCard";
import { MIN_REVIEWS_FOR_AVERAGE, formatReviewCount } from "../format";
import { MoreLink } from "../Section";
import { BlockHeading } from "./ListingParts";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  head: {
    alignItems: "center",
    columnGap: 20,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 12,
    paddingBottom: 20,
  },
  big: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 48, [breakpoints.md]: 56 },
    fontVariantNumeric: "tabular-nums",
    fontWeight: 750,
    letterSpacing: "-0.05em",
    lineHeight: 1,
  },
  of: {
    color: uiColor.text1,
    fontSize: 14,
    marginTop: 6,
  },
  stars: {
    color: uiColor.text2,
  },
  write: {
    marginLeft: "auto",
  },
  empty: {
    padding: { default: 22, [breakpoints.md]: 28 },
    borderColor: uiColor.border2,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    alignItems: { default: "flex-start", [breakpoints.md]: "center" },
    color: uiColor.text1,
    columnGap: 16,
    display: "flex",
    flexDirection: { default: "column", [breakpoints.md]: "row" },
    justifyContent: "space-between",
    lineHeight: 1.5,
    rowGap: 16,
  },
  showAll: {
    marginTop: 8,
    width: "100%",
  },
});

/** Reviews block on the listing page: summary, a few reviews, then a link to all. */
export function ListingReviewsBlock({
  listing,
  productId,
  productSlug,
  previewReviews,
}: {
  listing: DirectoryListingDetail;
  productId: string;
  productSlug: string;
  previewReviews: StoreListingPageSnapshotPayload["reviewPreview"];
}) {
  const navigate = useNavigate();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const reviewCount = Math.max(listing.reviewCount, previewReviews.length);
  const showAverage =
    reviewCount >= MIN_REVIEWS_FOR_AVERAGE && listing.rating != null;

  const writeButton = (label: string) => (
    <ButtonLink
      to="/products/$productId/reviews/write"
      params={{ productId: productSlug }}
      variant="secondary"
      size="md"
      style={styles.write}
    >
      <PenLine />
      {label}
    </ButtonLink>
  );

  return (
    <section aria-labelledby="listing-reviews-heading">
      <BlockHeading
        id="listing-reviews-heading"
        action={
          reviewCount > 0 ? (
            <MoreLink
              to="/products/$productId/reviews"
              params={{ productId: productSlug }}
            >
              All {reviewCount}
            </MoreLink>
          ) : null
        }
      >
        Reviews
      </BlockHeading>

      {reviewCount === 0 ? (
        <div {...stylex.props(styles.empty)}>
          <span>
            No one has reviewed {listing.name} yet. Yours could be the first.
          </span>
          {writeButton("Write the first review")}
        </div>
      ) : (
        <>
          <div {...stylex.props(styles.head)}>
            {showAverage && listing.rating != null ? (
              <>
                <span {...stylex.props(styles.big)}>
                  {listing.rating.toFixed(1)}
                </span>
                <div>
                  <StarRating
                    rating={listing.rating}
                    showReviewCount={false}
                    size={16}
                    role="img"
                    aria-label={`Rated ${listing.rating.toFixed(1)} out of 5`}
                    style={styles.stars}
                  />
                  <div {...stylex.props(styles.of)}>
                    {formatReviewCount(reviewCount)}
                  </div>
                </div>
              </>
            ) : (
              <span {...stylex.props(styles.of)}>
                {formatReviewCount(reviewCount)}
              </span>
            )}
            {writeButton("Write a review")}
          </div>

          {previewReviews.map((review) => (
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

          {reviewCount > previewReviews.length ? (
            <ButtonLink
              to="/products/$productId/reviews"
              params={{ productId: productSlug }}
              variant="secondary"
              size="lg"
              style={styles.showAll}
            >
              Show all {reviewCount} reviews
            </ButtonLink>
          ) : null}
        </>
      )}
    </section>
  );
}
