import { publicMediaUrlOrNull } from "./listing-image-url";

type OgMetaInput = {
  title: string;
  description: string;
  image?: string | null;
  /** Shown as `og:image:alt` / `twitter:image:alt` when set (accessibility + some clients use it in previews). */
  imageAlt?: string | null;
  avatar?: string | null;
  ownedProducts?: number;
  reviews?: number;
};

const DEFAULT_OG_WIDTH = "1200";
const DEFAULT_OG_HEIGHT = "630";
const SITE_ORIGIN =
  process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "") ?? "";

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function toAbsoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url) || !url.startsWith("/")) {
    return url;
  }

  if (!SITE_ORIGIN) {
    return url;
  }

  return `${SITE_ORIGIN}${url}`;
}

export function buildFallbackOgImageUrl(input: {
  title: string;
  description: string;
  avatar?: string | null;
  ownedProducts?: number;
  reviews?: number;
}) {
  const params = new URLSearchParams();
  params.set("title", truncate(input.title, 90));
  params.set("description", truncate(input.description, 220));

  if (input.avatar?.trim()) {
    params.set("avatar", input.avatar.trim());
  }

  if (
    typeof input.ownedProducts === "number" &&
    Number.isFinite(input.ownedProducts)
  ) {
    params.set(
      "ownedProducts",
      String(Math.max(0, Math.floor(input.ownedProducts))),
    );
  }

  if (typeof input.reviews === "number" && Number.isFinite(input.reviews)) {
    params.set("reviews", String(Math.max(0, Math.floor(input.reviews))));
  }

  return `/og?${params.toString()}`;
}

/**
 * Dynamic OG image for a single listing review (`/og/review` — server-rendered PNG via Satori).
 * Crawlers load this when the shared URL includes `?review=` on the reviews page.
 */
export function buildListingReviewOgImageUrl(input: {
  listingId: string;
  reviewId: string;
}) {
  const params = new URLSearchParams();
  params.set("listingId", input.listingId);
  params.set("reviewId", input.reviewId);
  return `/og/review?${params.toString()}`;
}

/**
 * Build an OG image URL for the tag-card style preview (`/og/tag`). Used by both app-tag and
 * directory/protocol category routes — pass the `tag` (used for accent + emoji lookup), an
 * optional `label` (for human-friendly title casing like "Account Tool" vs the slug
 * "account-tool"), and an optional `kind` shown as the small uppercase badge in the header
 * (e.g. "App Tag", "Category", "Protocol").
 */
export function buildAppTagOgImageUrl(input: {
  tag: string;
  label?: string;
  kind?: string;
  count?: number;
}) {
  const params = new URLSearchParams();
  params.set("tag", input.tag);
  if (input.label?.trim()) {
    params.set("label", truncate(input.label.trim(), 64));
  }
  if (input.kind?.trim()) {
    params.set("kind", truncate(input.kind.trim(), 24));
  }
  if (typeof input.count === "number" && Number.isFinite(input.count)) {
    params.set("count", String(Math.max(0, Math.floor(input.count))));
  }
  return `/og/tag?${params.toString()}`;
}

export function buildRouteOgMeta(input: OgMetaInput) {
  const title = truncate(input.title.trim(), 90);
  const description = truncate(input.description.trim(), 220);
  const resolvedImage = publicMediaUrlOrNull(input.image);
  const ogImage = toAbsoluteUrl(
    resolvedImage ||
      buildFallbackOgImageUrl({
        title,
        description,
        avatar: input.avatar,
        ownedProducts: input.ownedProducts,
        reviews: input.reviews,
      }),
  );

  const imageAltRaw =
    typeof input.imageAlt === "string" ? input.imageAlt.trim() : "";
  const imageAlt = imageAltRaw ? truncate(imageAltRaw, 420) : "";

  const meta: Array<
    | { title: string }
    | { name: string; content: string }
    | { property: string; content: string }
  > = [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: DEFAULT_OG_WIDTH },
    { property: "og:image:height", content: DEFAULT_OG_HEIGHT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];

  if (imageAlt) {
    meta.push(
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:image:alt", content: imageAlt },
    );
  }

  return { meta };
}
