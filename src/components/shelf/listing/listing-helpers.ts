import type { ListingLink } from "#/lib/atproto/listing-record";

import { formatAppTagLabel } from "../../../lib/app-tag-metadata";
import { getDataGroupKey } from "../../../lib/browse-listings";
import { getDirectoryCategoryOption } from "../../../lib/directory-categories";
import {
  isRepoLexiconKeyForLexiconHub,
  parseOAuthLexiconKey,
} from "../../../lib/oauth-scope-lexicon-keys";

/** "https://www.mu.social/app" → "mu.social". */
export function getUrlDomain(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Ecosystem tool category (`apps/<app>/<category>`), if the listing has one. */
export function getEcosystemCategorySlug(
  categorySlugs: ReadonlyArray<string>,
): string | null {
  return (
    categorySlugs.find((slug) => {
      const option = getDirectoryCategoryOption(slug);
      return option?.pathIds[0] === "apps" && option.pathIds.length >= 3;
    }) ?? null
  );
}

/**
 * Category worth showing in the sidebar: an ecosystem tool category or a
 * protocol category. Top-level `apps/<name>` categories only repeat the name.
 */
export function getDisplayCategorySlug(
  categorySlugs: ReadonlyArray<string>,
): string | null {
  return (
    getEcosystemCategorySlug(categorySlugs) ??
    categorySlugs.find((slug) => {
      const option = getDirectoryCategoryOption(slug);
      return option != null && option.pathIds[0] !== "apps";
    }) ??
    null
  );
}

/** "Bluesky › Client" for ecosystem tools, "PDS" for protocol categories. */
export function getCategoryDisplayLabel(slug: string): string {
  const option = getDirectoryCategoryOption(slug);
  if (!option) return slug;
  if (option.pathIds[0] === "apps") {
    return option.pathLabels.slice(1).join(" › ");
  }
  return option.pathLabels.length > 1
    ? option.pathLabels.slice(1).join(" › ")
    : option.label;
}

const LISTING_LINK_DEFAULT_LABELS: Record<string, string> = {
  privacy: "Privacy",
  terms: "Terms",
  support: "Support",
  contact: "Contact",
  community: "Community",
  docs: "Docs",
  blog: "Blog",
  changelog: "Changelog",
  source: "Source",
  license: "License",
  status: "Status",
  donate: "Donate",
  other: "Link",
};

export function getListingLinkLabel(link: ListingLink): string {
  const custom = link.label?.trim();
  if (custom) return custom;
  const typed =
    link.type === "other" ? null : LISTING_LINK_DEFAULT_LABELS[link.type];
  if (typed) return typed;
  // Untyped links: guess from the URL rather than showing a row of "Link".
  if (/privacy/i.test(link.url)) return "Privacy";
  if (/terms|\btos\b/i.test(link.url)) return "Terms";
  if (/github\.com|tangled\.|gitlab\.|codeberg\./i.test(link.url)) {
    return "Source";
  }
  return getUrlDomain(link.url) ?? LISTING_LINK_DEFAULT_LABELS.other;
}

/**
 * Lexicon producer groups (`app.bsky`, `site.standard`, …) from the repo
 * collections an app asks OAuth access to: the data it reads and writes.
 */
export function getDataProducerGroups(
  oauthLexiconKeys: ReadonlyArray<string> | null | undefined,
): Array<string> {
  const groups = new Map<string, number>();
  for (const key of oauthLexiconKeys ?? []) {
    if (!isRepoLexiconKeyForLexiconHub(key)) continue;
    const nsid = parseOAuthLexiconKey(key)?.nsid;
    const group = nsid ? getDataGroupKey(nsid) : null;
    if (group) groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  return [...groups.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([group]) => group);
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Jul 14, 2026". */
export function formatListingDate(iso: string | null | undefined) {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : shortDate.format(time);
}

const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Compact review date: "today", "3 days ago", "2 wk ago", "Oct 7", "Oct 7, 2025". */
export function formatReviewDate(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  const date = new Date(time);
  return date.getFullYear() === new Date().getFullYear()
    ? monthDay.format(date)
    : shortDate.format(date);
}

export type ReviewSort = "newest" | "highest" | "lowest";

export function sortReviews<
  T extends { rating: number; reviewCreatedAt: string },
>(reviews: ReadonlyArray<T>, sort: ReviewSort): Array<T> {
  return reviews.toSorted((a, b) => {
    const byRating =
      sort === "highest"
        ? b.rating - a.rating
        : sort === "lowest"
          ? a.rating - b.rating
          : 0;
    return byRating || b.reviewCreatedAt.localeCompare(a.reviewCreatedAt);
  });
}

/** Count of reviews per star value, 5 down to 1. */
export function getRatingDistribution(
  reviews: ReadonlyArray<{ rating: number }>,
): Array<{ stars: number; count: number }> {
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(review.rating) === stars)
      .length,
  }));
}

export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function getPrimaryTagLabel(appTags: ReadonlyArray<string>) {
  return appTags[0] ? formatAppTagLabel(appTags[0]) : null;
}
