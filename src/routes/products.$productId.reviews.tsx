import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { StarRating } from "../design-system/star-rating";
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
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getPlaceholderReviews } from "../lib/product-reviews";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";

export const Route = createFileRoute("/products/$productId/reviews")({
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
  const { data: listing } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId),
  );

  if (!listing) {
    throw notFound();
  }

  const reviews = getPlaceholderReviews(listing);

  return (
    <HeaderLayout.Root>
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
                          {listing.rating.toFixed(1)}
                        </Text>
                        <Text size="sm" variant="secondary">
                          ({reviews.length})
                        </Text>
                      </Flex>
                      <StarRating
                        rating={listing.rating}
                        showReviewCount={false}
                      />
                    </Flex>
                  </Flex>
                  <Button isDisabled size="lg" variant="secondary">
                    Create review
                  </Button>
                </Flex>
              </Flex>

              <Flex direction="column" gap="2xl">
                {reviews.map((review) => (
                  <Card
                    key={`${listing.id}-review-page-${review.author}`}
                    style={styles.reviewCard}
                  >
                    <Flex direction="column" style={styles.reviewCardBody}>
                      <Flex gap="2xl" style={styles.reviewHeader}>
                        <Avatar
                          alt={review.author}
                          fallback={getInitials(review.author)}
                          size="lg"
                        />
                        <Flex
                          direction="column"
                          gap="lg"
                          style={styles.reviewAuthor}
                        >
                          <Text weight="semibold">{review.author}</Text>
                          <Text size="sm" variant="secondary">
                            {review.role}
                          </Text>
                        </Flex>
                        <StarRating
                          rating={review.rating}
                          showReviewCount={false}
                        />
                      </Flex>
                      <Body style={styles.reviewQuote}>{review.quote}</Body>
                      <Text
                        size="sm"
                        variant="secondary"
                        style={styles.reviewMeta}
                      >
                        {review.context}
                      </Text>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            </Flex>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
