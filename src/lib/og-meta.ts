import { resolveBannerRecordUrl } from "./banner-record-url";

type OgMetaInput = {
  title: string;
  description: string;
  image?: string | null;
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

  if (typeof input.ownedProducts === "number" && Number.isFinite(input.ownedProducts)) {
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

export function buildRouteOgMeta(input: OgMetaInput) {
  const title = truncate(input.title.trim(), 90);
  const description = truncate(input.description.trim(), 220);
  const resolvedImage = resolveBannerRecordUrl(input.image);
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

  return {
    meta: [
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
    ],
  };
}
