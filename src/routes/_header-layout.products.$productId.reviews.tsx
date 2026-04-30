import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ProductReviewsPageChrome } from "../lib/product-reviews-route";
import { loadProductReviewsRoute } from "../lib/product-reviews-route-loader";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews",
)({
  loader: async ({ context, params, location }) => {
    const pathname = location.pathname;
    let preserveReviewId: string | undefined;
    try {
      const href =
        location.href ??
        (typeof location.pathname === "string"
          ? `${location.pathname}${location.searchStr ?? ""}`
          : "");
      const raw = href
        ? new URL(href, "http://localhost").searchParams.get("review")
        : null;
      if (
        raw &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          raw,
        )
      ) {
        preserveReviewId = raw;
      }
    } catch {
      preserveReviewId = undefined;
    }

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
      preserveReviewId,
    });

    return {
      ...routeData,
    };
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
