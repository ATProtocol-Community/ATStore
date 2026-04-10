import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { StarRating, StarRatingInput } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingReview,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews",
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

    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
    );

    const productSlug = getDirectoryListingSlug(listing);

    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId/reviews",
        params: { productId: productSlug },
        replace: true,
      });
    }

    return { productId: listing.id, productSlug };
  },
  component: ProductReviewsPage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
  },
  backLinkRow: {
    alignItems: "center",
  },
  header: {
    paddingTop: verticalSpace["2xl"],
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  ratingRow: {
    alignItems: "center",
    color: uiColor.text1,
  },
  reviewCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  reviewCardBody: {
    gap: gap["5xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  reviewHeader: {
    alignItems: "center",
  },
  reviewAuthor: {
    flex: 1,
    minWidth: 0,
  },
  reviewMeta: {
    color: uiColor.text1,
  },
  reviewQuote: {
    fontSize: fontSize["lg"],
  },
});

function ProductReviewsPage() {
  const { productId, productSlug } = Route.useLoaderData();
  const navigate = useNavigate();
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const reviewsQuery =
    directoryListingApi.getDirectoryListingReviewsQueryOptions(productId);

  const { data: listing } = useSuspenseQuery(detailQuery);
  const { data: reviews } = useSuspenseQuery(reviewsQuery);
  const { data: session } = useQuery(user.getSessionQueryOptions);

  const [draftRating, setDraftRating] = useState(5);
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitReview = useMutation({
    mutationFn: async () => {
      setFormError(null);
      await directoryListingApi.createDirectoryListingReview({
        data: {
          listingId: productId,
          rating: draftRating,
          text: draftText.trim() === "" ? null : draftText.trim(),
        },
      });
    },
    onSuccess: () => {
      navigate({
        to: "/products/$productId",
        params: { productId: productSlug },
      });
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not publish review.",
      );
    },
  });

  if (!listing) {
    throw notFound();
  }

  return (
    <HeaderLayout.Page>
      <Page.Root variant="small" style={styles.page}>
        <Flex direction="column" gap="7xl">
          <Flex style={styles.backLinkRow}>
            <AppLink
              to="/products/$productId"
              params={{ productId: productSlug }}
            >
              <ChevronLeft />
              Back to product
            </AppLink>
          </Flex>

          <Flex gap="2xl" align="center">
            <Avatar
              alt={listing.name}
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="2xl">
              <Text
                font="title"
                size={{ default: "4xl", sm: "4xl" }}
                weight="semibold"
              >
                {listing.name}
              </Text>
              <Body>{listing.tagline}</Body>
            </Flex>
          </Flex>

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
                        {listing.rating != null
                          ? listing.rating.toFixed(1)
                          : "—"}
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
              </Flex>
            </Flex>

            <Flex direction="column" gap="3xl" id="write-review">
              {session?.user ? (
                listing.atUri ? (
                  <Card style={styles.reviewCard}>
                    <Flex direction="column" style={styles.reviewCardBody}>
                      <Text weight="semibold" size="lg">
                        Write a review
                      </Text>
                      <Flex gap="2xl" align="center">
                        <Text size="sm" variant="secondary">
                          Rating
                        </Text>
                        <StarRatingInput
                          value={draftRating}
                          onChange={setDraftRating}
                          aria-label="Your star rating"
                        />
                      </Flex>
                      <label htmlFor="review-body">
                        <Text size="sm" variant="secondary">
                          Review (optional)
                        </Text>
                      </label>
                      <textarea
                        id="review-body"
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={4}
                        style={{
                          width: "100%",
                          maxWidth: "100%",
                          resize: "vertical",
                          padding: horizontalSpace["2xl"],
                          borderRadius: 8,
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderColor: "var(--color-ui-border, #ccc)",
                          fontFamily: "inherit",
                          fontSize: "1rem",
                        }}
                      />
                      {formError ? (
                        <Text size="sm" variant="secondary">
                          {formError}
                        </Text>
                      ) : null}
                      <Button
                        size="lg"
                        variant="secondary"
                        isPending={submitReview.isPending}
                        onPress={() => submitReview.mutate()}
                      >
                        Publish review
                      </Button>
                    </Flex>
                  </Card>
                ) : (
                  <Body variant="secondary">
                    This listing is not linked to an AT Protocol record yet, so
                    reviews cannot be published.
                  </Body>
                )
              ) : (
                <AppLink
                  to="/login"
                  search={{
                    redirect: `/products/${productSlug}/reviews#write-review`,
                  }}
                >
                  Sign in to write a review
                </AppLink>
              )}
            </Flex>

            <Flex direction="column" gap="2xl">
              {reviews.map((review) => (
                <ReviewListCard key={review.id} review={review} />
              ))}
            </Flex>
          </Flex>
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}

function ReviewListCard({ review }: { review: DirectoryListingReview }) {
  const authorLabel =
    review.authorDisplayName?.trim() ||
    (review.authorDid.length > 16
      ? `${review.authorDid.slice(0, 10)}…`
      : review.authorDid);

  return (
    <Card style={styles.reviewCard}>
      <Flex direction="column" style={styles.reviewCardBody}>
        <Flex gap="2xl" style={styles.reviewHeader}>
          <Avatar
            alt={authorLabel}
            fallback={getInitials(authorLabel)}
            size="lg"
            src={review.authorAvatarUrl || undefined}
          />
          <Flex direction="column" gap="lg" style={styles.reviewAuthor}>
            <Text weight="semibold">{authorLabel}</Text>
          </Flex>
          <StarRating rating={review.rating} showReviewCount={false} />
        </Flex>
        {review.text ? (
          <Body style={styles.reviewQuote}>{review.text}</Body>
        ) : null}
        <Text size="sm" variant="secondary" style={styles.reviewMeta}>
          {new Date(review.reviewCreatedAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </Text>
      </Flex>
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
