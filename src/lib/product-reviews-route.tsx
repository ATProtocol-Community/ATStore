import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createLink, notFound, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar } from "../design-system/avatar";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "./directory-listing-slugs";
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";
import { size } from "../design-system/theme/semantic-spacing.stylex";

const AppLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
  },
  backLinkRow: {
    alignItems: "center",
  },
  avatar: {
    height: size["6xl"],
    width: size["6xl"],
    flexShrink: 0,
  },
});

export type ProductReviewsSlugRedirect =
  | "/products/$productId/reviews"
  | "/products/$productId/reviews/write"
  | "/products/$productId/reviews/$reviewId/edit";

export async function loadProductReviewsRoute({
  context,
  params,
  prefetchReviews,
  slugMismatchRedirectTo,
  slugMismatchExtraParams,
  preserveReviewId,
}: {
  context: { queryClient: QueryClient };
  params: { productId: string };
  prefetchReviews: boolean;
  slugMismatchRedirectTo: ProductReviewsSlugRedirect;
  slugMismatchExtraParams?: { reviewId: string };
  /** Keep `?review=` when correcting the listing slug (share links). */
  preserveReviewId?: string;
}) {
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

  if (prefetchReviews) {
    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
    );
  }

  const productSlug = getDirectoryListingSlug(listing);

  if (params.productId !== productSlug) {
    const reviewSearch =
      preserveReviewId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        preserveReviewId,
      )
        ? { review: preserveReviewId }
        : undefined;

    throw redirect({
      to: slugMismatchRedirectTo,
      params: {
        productId: productSlug,
        ...(slugMismatchExtraParams?.reviewId != null
          ? { reviewId: slugMismatchExtraParams.reviewId }
          : {}),
      },
      search: reviewSearch,
      replace: true,
    });
  }

  return { productId: listing.id, productSlug };
}

export function ProductReviewsPageChrome({
  productId,
  productSlug,
  children,
}: {
  productId: string;
  productSlug: string;
  children: ReactNode;
}) {
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const { data: listing } = useSuspenseQuery(detailQuery);

  if (!listing) {
    throw notFound();
  }

  return (
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
            style={styles.avatar}
          />
          <Flex direction="column" gap="2xl">
            <Text
              font="title"
              size={{ default: "4xl", sm: "4xl" }}
              weight="semibold"
            >
              {listing.name}
            </Text>
            <SmallBody variant="secondary">{listing.tagline}</SmallBody>
          </Flex>
        </Flex>

        {children}
      </Flex>
    </Page.Root>
  );
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
