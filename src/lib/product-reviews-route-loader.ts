import type { QueryClient } from "@tanstack/react-query";

import { notFound, redirect } from "@tanstack/react-router";

import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "./directory-listing-slugs";

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
        ...(slugMismatchExtraParams?.reviewId == null
          ? {}
          : { reviewId: slugMismatchExtraParams.reviewId }),
      },
      search: reviewSearch,
      replace: true,
    });
  }

  return { productId: listing.id, productSlug };
}
