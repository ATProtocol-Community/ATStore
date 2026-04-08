import type { DirectoryListingDetail } from "../integrations/tanstack-query/api-directory-listings.functions";

export interface ProductReview {
  author: string;
  role: string;
  rating: number;
  quote: string;
  context: string;
}

export const PRODUCT_REVIEW_PREVIEW_COUNT = 2;

export function getPlaceholderReviews(
  listing: Pick<
    DirectoryListingDetail,
    "name" | "rating" | "productType" | "category" | "domain" | "scope"
  >,
): ProductReview[] {
  return [
    {
      author: "Jordan Lee",
      role: "Bluesky power user",
      rating: listing.rating,
      quote: `${listing.name} quickly became part of my daily Bluesky workflow. It feels focused, fast, and polished in a way most side tools do not.`,
      context:
        "Uses it throughout the day for posting, reading, and lightweight workflow management.",
    },
    {
      author: "Mina Patel",
      role: "Indie creator",
      rating: Math.max(4, listing.rating - 0.2),
      quote: `The best part is how approachable it is. I understood the core value in minutes, and the details make it feel considered instead of rushed.`,
      context: `Especially helpful for ${(
        listing.productType || listing.category
      ).toLowerCase()} workflows.`,
    },
    {
      author: "Alex Romero",
      role: "Community builder",
      rating: Math.min(5, listing.rating + 0.1),
      quote: `It still feels early, but this is exactly the kind of tool I want in the ecosystem: opinionated, useful, and easy to recommend to other people.`,
      context: `Strong fit for teams exploring ${(
        listing.domain ||
        listing.scope ||
        "Bluesky"
      ).toLowerCase()}.`,
    },
  ];
}
