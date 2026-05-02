import { createFileRoute, Outlet } from "@tanstack/react-router";

import {
  ProductReviewsPageChrome,
  loadProductReviewsRoute,
} from "../lib/product-reviews-route";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute(
  "/$locale/_header-layout/products/$productId/reviews",
)({
  loader: async ({ context, params, location }) => {
    const pathname = location.pathname;
    let slugMismatchRedirectTo:
      | "/products/$productId/reviews"
      | "/products/$productId/reviews/write"
      | "/products/$productId/reviews/$reviewId/edit" =
      "/products/$productId/reviews";
    let slugMismatchExtraParams: { reviewId: string } | undefined;

    if (pathname.endsWith("/write") || pathname.includes("/reviews/write")) {
      slugMismatchRedirectTo = "/products/$productId/reviews/write";
    } else {
      const editMatch = /\/reviews\/([^/]+)\/edit\/?$/.exec(pathname);
      if (editMatch) {
        slugMismatchRedirectTo = "/products/$productId/reviews/$reviewId/edit";
        slugMismatchExtraParams = { reviewId: editMatch[1] };
      }
    }

    const routeData = await loadProductReviewsRoute({
      context,
      params,
      prefetchReviews: true,
      slugMismatchRedirectTo,
      slugMismatchExtraParams,
    });

    const listing = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingDetailQueryOptions(
        routeData.productId,
      ),
    );

    return {
      ...routeData,
      ogTitle: `${listing?.name || "Product"} reviews | at-store`,
      ogDescription:
        listing?.tagline || "Read and write reviews for products on at-store.",
      ogImage: listing?.heroImageUrl || null,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Product reviews | at-store",
      description:
        loaderData?.ogDescription ||
        "Read and write reviews for products on at-store.",
      image: loaderData?.ogImage,
    }),
  component: ProductReviewsLayout,
});

function ProductReviewsLayout() {
  const { productId, productSlug } = Route.useLoaderData();

  return (
    <ProductReviewsPageChrome productId={productId} productSlug={productSlug}>
      <Outlet />
    </ProductReviewsPageChrome>
  );
}
