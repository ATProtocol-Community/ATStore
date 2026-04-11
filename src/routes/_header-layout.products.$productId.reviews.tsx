import { createFileRoute, Outlet } from "@tanstack/react-router";

import {
  ProductReviewsPageChrome,
  loadProductReviewsRoute,
} from "../lib/product-reviews-route";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews",
)({
  loader: async ({ context, params, location }) => {
    const pathname = location.pathname;
    let slugMismatchRedirectTo:
      | "/products/$productId/reviews"
      | "/products/$productId/reviews/write"
      | "/products/$productId/reviews/$reviewId/edit" = "/products/$productId/reviews";
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

    return loadProductReviewsRoute({
      context,
      params,
      prefetchReviews: true,
      slugMismatchRedirectTo,
      slugMismatchExtraParams,
    });
  },
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
