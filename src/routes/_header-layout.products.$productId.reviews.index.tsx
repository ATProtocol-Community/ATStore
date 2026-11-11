import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { PenLine, Star } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { z } from "zod";

import type { ReviewSort } from "../components/shelf/listing/listing-helpers";

import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import {
  MIN_REVIEWS_FOR_AVERAGE,
  formatReviewCount,
} from "../components/shelf/format";
import {
  getRatingDistribution,
  sortReviews,
} from "../components/shelf/listing/listing-helpers";
import { Button } from "../design-system/button";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontFamily } from "../design-system/theme/typography.stylex";
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

const ButtonLink = createLink(Button);

const SORT_OPTIONS: Array<{ id: ReviewSort; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "highest", label: "Highest" },
  { id: "lowest", label: "Lowest" },
];

const styles = stylex.create({
  summary: {
    padding: { default: 20, [breakpoints.md]: 28 },
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: uiColor.bg,
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "auto minmax(0, 1fr) auto",
    },
    rowGap: 20,
  },
  big: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 52, [breakpoints.md]: 64 },
    fontVariantNumeric: "tabular-nums",
    fontWeight: 750,
    letterSpacing: "-0.05em",
    lineHeight: 1,
    marginBottom: 6,
  },
  bigEmpty: {
    color: uiColor.text1,
  },
  of: {
    color: uiColor.text1,
    fontSize: 14,
    marginTop: 6,
  },
  dist: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  distRow: {
    paddingBlock: 3,
    alignItems: "center",
    color: uiColor.text2,
    columnGap: 8,
    display: "grid",
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    gridTemplateColumns: "12px 12px minmax(0, 1fr) 28px",
  },
  distStar: {
    fill: "currentColor",
    color: uiColor.text1,
  },
  bar: {
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: uiColor.component1,
    height: 8,
  },
  barFill: {
    borderRadius: 999,
    backgroundColor: uiColor.text2,
    display: "block",
    height: "100%",
  },
  barWidth: (percent: number) => ({
    width: `${percent}%`,
  }),
  distCount: {
    color: uiColor.text1,
    textAlign: "right",
  },
  write: {
    justifySelf: { default: "start", [breakpoints.md]: "auto" },
  },
  sort: {
    display: "inline-flex",
    marginBottom: 8,
    marginTop: 32,
  },
  empty: {
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingBlock: 64,
    paddingInline: 24,
    textAlign: "center",
    marginTop: 24,
  },
  emptyTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    marginBottom: 6,
    marginTop: 0,
  },
  emptyText: {
    color: uiColor.text1,
    marginBottom: 20,
    marginTop: 0,
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
  const [sort, setSort] = useState<ReviewSort>("newest");

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

  const reviewCount = Math.max(listing.reviewCount, reviews.length);
  const showAverage =
    reviewCount >= MIN_REVIEWS_FOR_AVERAGE && listing.rating != null;
  const distribution = getRatingDistribution(reviews);
  const maxBucket = Math.max(1, ...distribution.map((bucket) => bucket.count));
  const sorted = sortReviews(reviews, sort);

  const writeButton = (
    <ButtonLink
      to="/products/$productId/reviews/write"
      params={{ productId: productSlug }}
      variant="primary"
      size="lg"
      style={styles.write}
    >
      <PenLine />
      Write a review
    </ButtonLink>
  );

  return (
    <div>
      <section aria-label="Rating summary" {...stylex.props(styles.summary)}>
        <div>
          {showAverage && listing.rating != null ? (
            <>
              <div {...stylex.props(styles.big)}>
                {listing.rating.toFixed(1)}
              </div>
              <StarRating
                rating={listing.rating}
                showReviewCount={false}
                size={18}
                role="img"
                aria-label={`Rated ${listing.rating.toFixed(1)} out of 5`}
              />
            </>
          ) : (
            <div aria-hidden {...stylex.props(styles.big, styles.bigEmpty)}>
              —
            </div>
          )}
          <div {...stylex.props(styles.of)}>
            {reviewCount > 0
              ? formatReviewCount(reviewCount)
              : "No reviews yet"}
          </div>
        </div>
        <ul aria-label="Rating distribution" {...stylex.props(styles.dist)}>
          {distribution.map(({ stars, count }) => (
            <li
              key={stars}
              aria-label={`${String(stars)} stars: ${String(count)}`}
              {...stylex.props(styles.distRow)}
            >
              <span aria-hidden>{stars}</span>
              <Star size={11} aria-hidden {...stylex.props(styles.distStar)} />
              <span aria-hidden {...stylex.props(styles.bar)}>
                <span
                  {...stylex.props(
                    styles.barFill,
                    styles.barWidth((100 * count) / maxBucket),
                  )}
                />
              </span>
              <span aria-hidden {...stylex.props(styles.distCount)}>
                {count}
              </span>
            </li>
          ))}
        </ul>
        {writeButton}
      </section>

      {reviews.length > 0 ? (
        <>
          <SegmentedControl
            aria-label="Sort reviews"
            size="md"
            selectedKeys={[sort]}
            style={styles.sort}
            onSelectionChange={(keys) => {
              const [key] = keys;
              const next = SORT_OPTIONS.find((option) => option.id === key);
              if (next) setSort(next.id);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <SegmentedControlItem key={option.id} id={option.id}>
                {option.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          <div>
            {sorted.map((review) => (
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
          </div>
        </>
      ) : (
        <div {...stylex.props(styles.empty)}>
          <h2 {...stylex.props(styles.emptyTitle)}>No reviews yet</h2>
          <p {...stylex.props(styles.emptyText)}>
            Be the first to tell people what you think of {listing.name}.
          </p>
          <ButtonLink
            to="/products/$productId/reviews/write"
            params={{ productId: productSlug }}
            variant="primary"
            size="lg"
          >
            Write the first review
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
