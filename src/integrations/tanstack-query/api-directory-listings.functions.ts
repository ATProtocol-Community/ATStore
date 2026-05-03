import type { Database } from "#/db/index.server";
import type { StoreListing } from "#/db/schema";
import type { ListingLink } from "#/lib/atproto/listing-record";
import type { SummaryScopeHumanRow } from "#/lib/oauth-listing-auth-probe";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import * as dbSchema from "#/db/schema";
import { parseAtUriParts } from "#/lib/atproto/at-uri";
import {
  LISTING_LINK_LABEL_MAX_LENGTH,
  LISTING_LINK_MAX_COUNT,
  LISTING_LINK_URL_MAX_LENGTH,
  buildListingDetailRecordWithBlobs,
  normalizeListingLinks,
} from "#/lib/atproto/listing-record";
import { COLLECTION, NSID } from "#/lib/atproto/nsids";
import {
  createAtstorePublishClient,
  getAtstoreRepoDid,
  publishDirectoryListingDetail,
  publishOwnedListingDetail,
} from "#/lib/atproto/publish-directory-listing";
import {
  createListingDetailRecord,
  createListingReviewRecord,
  createListingReviewReplyRecord,
  deleteRecord,
  fetchListingDetailRecord,
  putListingFavoriteRecord,
  putListingReviewRecord,
  putListingReviewReplyRecord,
} from "#/lib/atproto/repo-records";
import { resolveUrlToImageBytes } from "#/lib/atproto/resolve-image-bytes";
import {
  sqlReplyAuthorAllowedPredicate,
  upsertListingReviewReplyFromTap,
} from "#/lib/atproto/tap-review-reply-sync";
import { upsertListingReviewFromTap } from "#/lib/atproto/tap-review-sync";
import {
  fetchBlueskyHandleForDid,
  fetchBlueskyPublicProfileFields,
  resolveBlueskyHandleToDid,
} from "#/lib/bluesky-public-profile";
import { bskyAppPostUrlFromAtUri } from "#/lib/bsky-app-urls";
import {
  httpsListingImageUrlOrNull,
  publicMediaUrlOrNull,
} from "#/lib/listing-image-url";
import {
  oauthClientDistinctTokensFromPublishedScopeLine,
  probeOAuthListingAuth,
} from "#/lib/oauth-listing-auth-probe";
import { findEligibleProductClaimsForDid } from "#/lib/product-claim-eligibility";
import { trendingScoreSortEnabled } from "#/lib/trending/config";
import {
  adminFnMiddleware,
  getAtprotoSessionForRequest,
} from "#/middleware/auth";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type {
  DirectoryCategoryAccent,
  DirectoryCategoryTreeNode,
} from "../../lib/directory-categories";

import {
  findAppTagBySlug,
  formatAppTagLabel,
} from "../../lib/app-tag-metadata";
import {
  normalizeAppTags,
  popularTagsFromAllAssignments,
  suggestAppTagsFromListing,
  suggestedTagsForListing,
} from "../../lib/app-tags";
import {
  buildDirectoryCategoryTree,
  findDirectoryCategoryNode,
  flattenDirectoryCategoryTree,
  getDirectoryCategoryDescendantIds,
  getDirectoryCategoryOption,
  primaryCategorySlug,
  shouldOmitUrlMentionsForBlueskyPlatformListing,
} from "../../lib/directory-categories";
import {
  buildDirectoryListingSlug,
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../../lib/directory-listing-slugs";
import {
  discoverOgImageUrlFromPage,
  getListingExternalPageUrl,
} from "../../lib/discover-external-og-image";
import {
  sanitizeListingDescription,
  sanitizeListingTagline,
} from "../../lib/listing-copy";
import { buildFallbackOgImageUrl } from "../../lib/og-meta";
import { dbMiddleware } from "./db-middleware";

/** Columns only on legacy `directory_listings`; absent on `store_listings` — selected as null for UI types. */
const storeListingLegacyDetailColumns = {
  rawCategoryHint: sql<string | null>`null::text`.as("rawCategoryHint"),
  scope: sql<string | null>`null::text`.as("scope"),
  productType: sql<string | null>`null::text`.as("productType"),
  domain: sql<string | null>`null::text`.as("domain"),
  vertical: sql<string | null>`null::text`.as("vertical"),
  classificationReason: sql<string | null>`null::text`.as(
    "classificationReason",
  ),
};

function listingPublicWhere(table: typeof dbSchema.storeListings, extra?: SQL) {
  const pub = eq(table.verificationStatus, "verified");
  return extra ? and(pub, extra) : pub;
}

function viewerMayReplyOnListingReview(opts: {
  viewerDid?: string | null;
  reviewAuthorDid: string;
  listingRepoDid: string | null;
  listingProductAccountDid: string | null;
}) {
  const viewer = opts.viewerDid?.trim();
  if (!viewer) return false;
  if (viewer === opts.reviewAuthorDid) return true;
  const rd = opts.listingRepoDid?.trim();
  if (rd && viewer === rd) return true;
  const pd = opts.listingProductAccountDid?.trim();
  if (pd && viewer === pd) return true;
  return false;
}

/** "Popular" / trending ordering — uses `trending_score` when enabled, else legacy `updatedAt`. */
function orderByPopularListingSort(table: typeof dbSchema.storeListings) {
  if (!trendingScoreSortEnabled()) {
    return [desc(table.updatedAt), desc(table.createdAt)];
  }
  return [
    sql`${table.trendingScore} DESC NULLS LAST`,
    desc(table.updatedAt),
    desc(table.createdAt),
  ];
}

/** Listing has a two-segment path under `apps/…` (e.g. `apps/bluesky`). */
function sqlCategorySlugsHasRootTwoSegment(
  col: AnyPgColumn,
  prefix: "apps",
): SQL {
  const pattern = `${prefix}/%`;
  return sql<boolean>`exists (
    select 1 from unnest(${col}) as u(slug)
    where cardinality(string_to_array(trim(both from u.slug::text), '/')) = 2
      and trim(both from u.slug::text) like ${pattern}
  )`;
}

function sqlCategorySlugsMatchesLike(col: AnyPgColumn, pattern: string): SQL {
  return sql<boolean>`exists (
    select 1 from unnest(${col}) as u(slug) where trim(both from u.slug::text) like ${pattern}
  )`;
}

function categorySlugsOverlap(a: Array<string>, b: Array<string>): boolean {
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  const bs = new Set(b);
  for (const x of a) {
    if (bs.has(x)) {
      return true;
    }
  }
  return false;
}

type DirectoryListingRow = {
  id: string;
  name: string;
  slug: string | null;
  iconUrl: string | null;
  /** Dedicated hero/cover from `store_listings.hero_image_url` (Tap / publish). */
  heroImageUrl: string | null;
  screenshotUrls: Array<string>;
  tagline: string | null;
  fullDescription: string | null;
  scope: string | null;
  productType: string | null;
  domain: string | null;
  categorySlugs: Array<string>;
  /** Present when selected from DB; omitted in some test/mocked rows. */
  appTags?: string[] | null;
  reviewCount: number;
  averageRating: number | null;
  productAccountHandle: string | null;
};

type CategoryAccent = DirectoryCategoryAccent;

export interface DirectoryListingCard {
  id: string;
  name: string;
  slug?: string | null;
  tagline: string;
  description: string;
  iconUrl: string | null;
  /** Resolved hero for cards: `store_listings.hero_image_url`, else first screenshot. */
  heroImageUrl: string | null;
  /** Primary path (first of `categorySlugs`); used for ecosystem/category UI. */
  categorySlug: string | null;
  categorySlugs: Array<string>;
  category: string;
  accent: CategoryAccent;
  /** Mean star rating when there is at least one review; otherwise null. */
  rating: number | null;
  reviewCount: number;
  priceLabel: string;
  /** Official product Bluesky handle when set (Postgres mirror of resolved DID). */
  productAccountHandle: string | null;
  /** Editorial app tags (e.g. developer tool, social). */
  appTags: Array<string>;
}

export interface DirectoryListingDetail extends DirectoryListingCard {
  /** Canonical AT URI for `fyi.atstore.listing.detail` when Tap-synced; needed to publish reviews. */
  atUri: string | null;
  /**
   * True when the listing record is hosted on the at-store publisher repo (or
   * is not yet on AT proto at all). False once an account other than at-store
   * has claimed the listing and now hosts the record themselves.
   */
  isStoreManaged: boolean;
  /** Official product Bluesky DID (`fyi.atstore.listing.detail`). */
  productAccountDid: string | null;
  /** Repo DID hosting `fyi.atstore.listing.detail` — used client-side for review-reply UX. */
  repoDid: string | null;
  /** Raw `store_listings.tagline` for owner edit forms (display tagline may fall back to description). */
  sourceTagline: string | null;
  /** Raw `store_listings.full_description` for owner edit forms (display `description` is sanitized). */
  sourceFullDescription: string | null;
  screenshots: Array<string>;
  externalUrl: string | null;
  sourceUrl: string | null;
  rawCategoryHint: string | null;
  scope: string | null;
  productType: string | null;
  domain: string | null;
  vertical: string | null;
  classificationReason: string | null;
  categoryPathLabel: string | null;
  appTags: Array<string>;
  createdAt: string | null;
  updatedAt: string | null;
  /** Trust/compliance/support/project links (see `fyi.atstore.listing.detail#link`). */
  links: Array<ListingLink>;
  /** OAuth / authorization metadata sampled from storefront link (see cron sync). Null if never probed. */
  oauthProbe: DirectoryListingOAuthProbe | null;
  /**
   * Only set by `getDirectoryListingDetailForOwnerEdit` — sync with Postgres
   * `verification_status` for routing (e.g. back to Manage when not live).
   */
  verificationStatus?: string;
}

/** Public-safe snapshot from `store_listing_oauth_probes` (+ optional human-readable scopes from report). */
export interface DirectoryListingOAuthProbe {
  status: string;
  probedAt: string | null;
  probedUrl: string | null;
  probeError: string | null;
  oauthScopesDistinct: Array<string>;
  transitionalScopes: Array<string>;
  publishesAtprotoScope: boolean | null;
  clientScopeRawLine: string | null;
  clientScopeSyntaxOk: boolean | null;
  /**
   * Tokens from OAuth client_metadata only. When non-empty, storefront UI prefers this over
   * {@link oauthScopesDistinct} (merged with AS `scopes_supported` / resource metadata).
   */
  oauthClientScopesDistinct: Array<string>;
  hasProtectedResourceMetadata: boolean;
  hasAuthorizationServerMetadata: boolean;
  successfulClientMetadataUrl: string | null;
  scopeHumanReadable: Array<SummaryScopeHumanRow>;
}

export interface DirectoryListingReviewReply {
  id: string;
  authorDid: string;
  text: string;
  replyCreatedAt: string;
  authorDisplayName: string | null;
  /** Resolved Bluesky handle (no leading @); null if profile lookup failed. */
  authorHandle: string | null;
  authorAvatarUrl: string | null;
}

export interface DirectoryListingReview {
  id: string;
  authorDid: string;
  rating: number;
  text: string | null;
  reviewCreatedAt: string;
  authorDisplayName: string | null;
  /** Resolved Bluesky handle (no leading @); null if profile lookup failed. */
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  /** Mirrored reply rows for this review. */
  replyCount: number;
  /** True when the viewer may post in the reply thread for this listing. */
  canReply: boolean;
}

/** Bluesky post stored from Jetstream mention matching. */
export interface DirectoryListingMention {
  id: string;
  postUri: string;
  bskyPostUrl: string | null;
  authorDid: string;
  /** Resolved from DB and/or public Bluesky profile API. */
  authorHandle: string | null;
  /** From `app.bsky.actor.getProfile` when available. */
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  postText: string | null;
  postFacets: DirectoryListingPostFacet[] | null;
  postCreatedAt: string;
  matchType: string;
  matchConfidence: number;
  matchEvidence: Record<string, {}> | null;
  postEmbed: DirectoryListingPostEmbed | null;
}

export interface DirectoryListingMentionsResult {
  mentions: Array<DirectoryListingMention>;
  total: number;
}

export interface DirectoryListingPostEmbed {
  type: "external_link";
  uri: string;
  title: string | null;
  description: string | null;
  thumbUrl: string | null;
}

export interface DirectoryListingPostFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{
    $type: string;
    uri?: string;
    did?: string;
    tag?: string;
  }>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function extractExternalEmbedFromUnknown(
  node: unknown,
): DirectoryListingPostEmbed | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const ext = obj.external;
  if (ext && typeof ext === "object" && !Array.isArray(ext)) {
    const extObj = ext as Record<string, unknown>;
    const uri = asNonEmptyString(extObj.uri);
    if (uri) {
      return {
        type: "external_link",
        uri,
        title: asNonEmptyString(extObj.title),
        description: asNonEmptyString(extObj.description),
        thumbUrl: asNonEmptyString(extObj.thumb),
      };
    }
  }
  return (
    extractExternalEmbedFromUnknown(obj.media) ??
    extractExternalEmbedFromUnknown(obj.embed) ??
    null
  );
}

async function fetchBlueskyPostEmbedsByUri(postUris: Array<string>): Promise<
  Map<
    string,
    {
      embed: DirectoryListingPostEmbed | null;
      text: string | null;
      facets: DirectoryListingPostFacet[] | null;
    }
  >
> {
  const uniqueUris = [
    ...new Set(postUris.map((u) => u.trim()).filter(Boolean)),
  ];
  if (uniqueUris.length === 0) return new Map();
  const chunks: Array<Array<string>> = [];
  for (let i = 0; i < uniqueUris.length; i += 25) {
    chunks.push(uniqueUris.slice(i, i + 25));
  }
  const out = new Map<
    string,
    {
      embed: DirectoryListingPostEmbed | null;
      text: string | null;
      facets: DirectoryListingPostFacet[] | null;
    }
  >();
  try {
    for (const chunk of chunks) {
      const url = new URL(
        "xrpc/app.bsky.feed.getPosts",
        "https://public.api.bsky.app",
      );
      for (const uri of chunk) {
        url.searchParams.append("uris", uri);
      }
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const json = (await response.json()) as {
        posts?: Array<{ uri?: string; embed?: unknown; record?: unknown }>;
      };
      for (const post of json.posts ?? []) {
        const uri = asNonEmptyString(post.uri);
        if (!uri) continue;
        const embed = extractExternalEmbedFromUnknown(post.embed);
        const record =
          post.record && typeof post.record === "object"
            ? (post.record as Record<string, unknown>)
            : null;
        const text = asNonEmptyString(record?.text) ?? null;
        const facetsRaw = Array.isArray(record?.facets)
          ? (record.facets as Array<unknown>)
          : null;
        const facets =
          facetsRaw
            ?.map((facet) => {
              if (!facet || typeof facet !== "object") return null;
              const f = facet as Record<string, unknown>;
              const idx =
                f.index && typeof f.index === "object"
                  ? (f.index as Record<string, unknown>)
                  : null;
              const byteStart =
                typeof idx?.byteStart === "number" ? idx.byteStart : null;
              const byteEnd =
                typeof idx?.byteEnd === "number" ? idx.byteEnd : null;
              const featuresRaw = Array.isArray(f.features)
                ? (f.features as Array<unknown>)
                : null;
              if (byteStart == null || byteEnd == null || !featuresRaw)
                return null;
              const features = featuresRaw
                .map((feature) => {
                  if (!feature || typeof feature !== "object") return null;
                  const x = feature as Record<string, unknown>;
                  const $type = asNonEmptyString(x.$type);
                  if (!$type) return null;
                  return {
                    $type,
                    uri: asNonEmptyString(x.uri) ?? undefined,
                    did: asNonEmptyString(x.did) ?? undefined,
                    tag: asNonEmptyString(x.tag) ?? undefined,
                  };
                })
                .filter((v): v is NonNullable<typeof v> => v != null);
              if (features.length === 0) return null;
              return { index: { byteStart, byteEnd }, features };
            })
            .filter((v): v is NonNullable<typeof v> => v != null) ?? null;
        out.set(uri, {
          embed,
          text,
          facets: facets && facets.length > 0 ? facets : null,
        });
      }
    }
    return out;
  } catch {
    return out;
  }
}

/** Listing summary embedded in a review shown on a user profile. */
export interface DirectoryUserReviewListing {
  id: string;
  name: string;
  slug: string;
  sourceUrl: string;
  iconUrl: string | null;
  tagline: string | null;
  repoDid: string | null;
  productAccountDid: string | null;
}

export interface DirectoryUserReview extends DirectoryListingReview {
  listing: DirectoryUserReviewListing;
}

export interface UserProfileReviewsPageData {
  did: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  reviews: Array<DirectoryUserReview>;
}

export interface DirectoryUserFavoriteListing {
  id: string;
  name: string;
  slug: string | null;
  iconUrl: string | null;
  tagline: string | null;
  favoritedAt: string;
}

export interface DirectoryListingFavoriteStatus {
  isFavorited: boolean;
}

export interface DirectoryCategorySummary {
  id: string;
  label: string;
  description: string;
  accent: CategoryAccent;
  count: number;
  pathLabels: Array<string>;
}

export interface DirectoryCategoryPageData {
  category: DirectoryCategoryTreeNode;
  listings: Array<DirectoryListingCard>;
}

export interface DirectoryAppTagGroup {
  tag: string;
  count: number;
  listings: Array<DirectoryListingCard>;
}

export interface DirectoryAppTagSummary {
  tag: string;
  count: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export interface DirectoryListingCategoryAssignment {
  id: string;
  name: string;
  iconUrl: string | null;
  tagline: string;
  description: string;
  externalUrl: string | null;
  categorySlug: string | null;
  categorySlugs: Array<string>;
  categoryPathLabel: string | null;
  legacyCategoryHint: string;
}

export interface DirectoryListingAppTagAssignment {
  id: string;
  name: string;
  iconUrl: string | null;
  tagline: string;
  description: string;
  externalUrl: string | null;
  appTags: Array<string>;
  suggestedTags: Array<string>;
  categorySlug: string | null;
  categorySlugs: Array<string>;
  scope: string | null;
  productType: string | null;
  domain: string | null;
  vertical: string | null;
  rawCategoryHint: string | null;
}

export interface DirectoryHomePageData {
  featured: DirectoryListingCard;
  spotlights: Array<DirectoryListingCard>;
  popular: Array<DirectoryListingCard>;
  fresh: Array<DirectoryListingCard>;
  promo: DirectoryListingCard | null;
  tags: Array<DirectoryAppTagSummary>;
}

const CATEGORY_ACCENTS: Array<CategoryAccent> = [
  "blue",
  "pink",
  "purple",
  "green",
];

const listDirectoryListingsInput = z.object({
  limit: z.number().int().min(1).max(24).default(12),
  query: z.string().trim().min(1).optional(),
  /**
   * When true, only listings with no `product_account_handle` (e.g. manual claim picker).
   */
  withoutProductAccountHandleOnly: z.boolean().optional().default(false),
  /**
   * When true, exclude listings the current session already “owns” (same `product_account_did`
   * or listing record lives in the user’s repo). Used by `/product/claim` manual search.
   */
  excludeOwnedListingsForSession: z.boolean().optional().default(false),
});

const listingSortInput = z
  .enum(["popular", "newest", "alphabetical"])
  .default("popular");

const getDirectoryCategoryPageInput = z.object({
  categoryId: z.string().trim().min(1),
  sort: listingSortInput,
});

const updateDirectoryListingCategoryAssignmentInput = z.object({
  id: z.string().min(1),
  categorySlug: z.string().trim().min(1).nullable(),
});

const deleteDirectoryListingInput = z.object({
  id: z.string().min(1),
});

const regenerateDirectoryListingContentInput = z.object({
  id: z.string().min(1),
});

const updateDirectoryListingAppTagsInput = z.object({
  id: z.string().min(1),
  appTags: z.array(z.string()).max(64),
});

const getAppsByTagPageInput = z.object({
  tag: z.string().trim().min(1),
  sort: listingSortInput,
});

const getRelatedDirectoryListingsInput = z.object({
  id: z.string().trim().min(1),
  limit: z.number().int().min(1).max(8).default(4),
});

const getDirectoryListingReviewsInput = z.object({
  id: z.string().min(1),
});

const getDirectoryListingMentionsInput = z.object({
  id: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(12),
});

const createDirectoryListingReviewInput = z.object({
  listingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(8000).optional().nullable(),
});

const updateDirectoryListingReviewInput = z.object({
  reviewId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(8000).optional().nullable(),
});

const deleteDirectoryListingReviewInput = z.object({
  reviewId: z.string().uuid(),
});

const getDirectoryListingReviewRepliesInput = z.object({
  reviewId: z.string().uuid(),
});

const createDirectoryListingReviewReplyInput = z.object({
  reviewId: z.string().uuid(),
  text: z.string().min(1).max(8000),
});

const updateDirectoryListingReviewReplyInput = z.object({
  replyId: z.string().uuid(),
  text: z.string().min(1).max(8000),
});

const deleteDirectoryListingReviewReplyInput = z.object({
  replyId: z.string().uuid(),
});

const getUserProfileReviewsPageDataInput = z.object({
  did: z.string().trim().min(1).max(2048),
});

const getProfileFavoriteListingsInput = z.object({
  did: z.string().trim().min(1).max(2048),
});

const listingFavoriteInput = z.object({
  listingId: z.string().uuid(),
});

function isPlausiblePublicDid(value: string) {
  const s = value.trim();
  return s.startsWith("did:") && s.length >= 12 && s.length <= 2048;
}

const fallbackCategoryIds = ["apps"];

function formatMetadataLabel(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ");
  if (normalized.length === 0) {
    return "Utility";
  }

  const shouldTitleCase =
    /[_-]/.test(value) ||
    value === value.toLowerCase() ||
    value === value.toUpperCase();

  if (!shouldTitleCase) {
    return normalized;
  }

  return normalized
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function toDirectoryCategorySummary(input: {
  id: string;
  label: string;
  description: string;
  accent: CategoryAccent;
  count: number;
  pathLabels: Array<string>;
}) {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    accent: input.accent,
    count: input.count,
    pathLabels: input.pathLabels,
  } satisfies DirectoryCategorySummary;
}

function getListingCategory(row: Pick<DirectoryListingRow, "categorySlugs">) {
  return getDirectoryCategoryOption(primaryCategorySlug(row.categorySlugs));
}

function getCategoryLabel(
  row: Pick<
    DirectoryListingRow,
    "scope" | "productType" | "domain" | "categorySlugs"
  >,
) {
  const assignedCategory = getListingCategory(row);
  if (assignedCategory) {
    return (
      assignedCategory.pathLabels.slice(1).join(" ") || assignedCategory.label
    );
  }

  return formatMetadataLabel(
    row.productType || row.domain || row.scope || "Utility",
  );
}

function getCardAccent(input: string): CategoryAccent {
  const index =
    [...input].reduce(
      (sum, character) => sum + (character.codePointAt(0) ?? 0),
      0,
    ) % CATEGORY_ACCENTS.length;

  return CATEGORY_ACCENTS[index];
}

function getListingAccent(
  row: Pick<
    DirectoryListingRow,
    "name" | "categorySlugs" | "scope" | "productType" | "domain"
  >,
) {
  const assignedCategory = getListingCategory(row);
  if (assignedCategory) {
    return assignedCategory.accent;
  }

  return getCardAccent(`${row.name}-${getCategoryLabel(row)}`);
}

function getListingDescription(row: DirectoryListingRow) {
  return (
    sanitizeListingDescription(row.fullDescription) ||
    sanitizeListingTagline(row.tagline) ||
    "Discover a polished tool for your Bluesky workflow."
  );
}

function toListingCard(row: DirectoryListingRow): DirectoryListingCard {
  const category = getCategoryLabel(row);
  const tagline =
    sanitizeListingTagline(row.tagline) ||
    sanitizeListingTagline(row.fullDescription) ||
    "Discover a polished Bluesky tool.";
  const slugs = row.categorySlugs ?? [];
  const reviewCount = row.reviewCount ?? 0;
  const averageRating = row.averageRating;
  const rating =
    reviewCount > 0 &&
    averageRating != null &&
    !Number.isNaN(Number(averageRating))
      ? Number(Number(averageRating).toFixed(1))
      : null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug || buildDirectoryListingSlug({ name: row.name }),
    tagline,
    description: getListingDescription(row),
    iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
    heroImageUrl: httpsListingImageUrlOrNull(row.heroImageUrl),
    categorySlugs: slugs,
    categorySlug: primaryCategorySlug(slugs),
    category,
    accent: getListingAccent(row),
    rating,
    reviewCount,
    priceLabel: "GET",
    productAccountHandle: row.productAccountHandle ?? null,
    appTags: normalizeAppTags(row.appTags ?? []),
  };
}

type DirectoryListingDetailRow = DirectoryListingRow & {
  atUri: string | null;
  repoDid: string | null;
  productAccountDid: string | null;
  productAccountHandle: string | null;
  sourceUrl: string;
  externalUrl: string | null;
  rawCategoryHint: string | null;
  vertical: string | null;
  classificationReason: string | null;
  appTags: Array<string>;
  links: ListingLink[] | null;
  createdAt: Date;
  updatedAt: Date;
};

type DirectoryListingGenerationCandidate = {
  id: string;
  name: string;
  sourceUrl: string;
  externalUrl: string | null;
  screenshotUrls: Array<string>;
  tagline: string | null;
  fullDescription: string | null;
  rawCategoryHint: string | null;
  scope: string | null;
  productType: string | null;
  domain: string | null;
};

type ExtractedPageCopy = {
  finalUrl: string;
  title: string | null;
  metaDescription: string | null;
  ogDescription: string | null;
  headings: Array<string>;
  paragraphs: Array<string>;
};

async function fetchStoreListingOAuthProbe(
  listingId: string,
  ctx: {
    db: Database;
    schema: typeof dbSchema;
  },
): Promise<DirectoryListingOAuthProbe | null> {
  const probes = ctx.schema.storeListingOAuthProbes;
  const [row] = await ctx.db
    .select({
      status: probes.status,
      probeError: probes.probeError,
      probedUrl: probes.probedUrl,
      probedAt: probes.probedAt,
      oauthScopesDistinct: probes.oauthScopesDistinct,
      transitionalScopes: probes.transitionalScopes,
      publishesAtprotoScope: probes.publishesAtprotoScope,
      clientScopeRawLine: probes.clientScopeRawLine,
      clientScopeSyntaxOk: probes.clientScopeSyntaxOk,
      hasProtectedResourceMetadata: probes.hasProtectedResourceMetadata,
      hasAuthorizationServerMetadata: probes.hasAuthorizationServerMetadata,
      successfulClientMetadataUrl: probes.successfulClientMetadataUrl,
      reportJson: probes.reportJson,
    })
    .from(probes)
    .where(eq(probes.storeListingId, listingId))
    .limit(1);

  if (!row) {
    return null;
  }

  const reportValue = row.reportJson;
  const scopeHumanReadable: Array<SummaryScopeHumanRow> =
    reportValue?.summary?.scopeHumanReadable != null &&
    Array.isArray(reportValue.summary.scopeHumanReadable)
      ? reportValue.summary.scopeHumanReadable
      : [];

  const oauthClientDistinctFromSummary =
    reportValue?.summary?.oauthClientScopesDistinct;

  const oauthClientScopesDistinct = Array.isArray(
    oauthClientDistinctFromSummary,
  )
    ? oauthClientDistinctFromSummary
    : oauthClientDistinctTokensFromPublishedScopeLine(row.clientScopeRawLine);

  return {
    status: row.status,
    probedAt: row.probedAt.toISOString(),
    probedUrl: row.probedUrl,
    probeError: row.probeError,
    oauthScopesDistinct: row.oauthScopesDistinct ?? [],
    transitionalScopes: row.transitionalScopes ?? [],
    publishesAtprotoScope: row.publishesAtprotoScope,
    clientScopeRawLine: row.clientScopeRawLine,
    clientScopeSyntaxOk: row.clientScopeSyntaxOk,
    oauthClientScopesDistinct,
    hasProtectedResourceMetadata: row.hasProtectedResourceMetadata,
    hasAuthorizationServerMetadata: row.hasAuthorizationServerMetadata,
    successfulClientMetadataUrl: row.successfulClientMetadataUrl,
    scopeHumanReadable,
  };
}

const rescanListingOAuthProbeDevInput = z.object({
  listingId: z.string().uuid(),
});

/**
 * Re-run `probeOAuthListingAuth` against the listing's storefront URL and upsert
 * `store_listing_oauth_probes` — mirrors `scripts/sync-listing-oauth-probes.ts`.
 * Development only.
 */
const rescanListingOAuthProbeDev = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(rescanListingOAuthProbeDevInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();

    const listings = context.schema.storeListings;
    const probes = context.schema.storeListingOAuthProbes;

    const [listingRow] = await context.db
      .select({
        id: listings.id,
        slug: listings.slug,
        name: listings.name,
        sourceUrl: listings.sourceUrl,
        externalUrl: listings.externalUrl,
      })
      .from(listings)
      .where(eq(listings.id, data.listingId))
      .limit(1);

    if (!listingRow) {
      throw new Error("Listing not found.");
    }

    const slugText = getDirectoryListingSlug({
      name: listingRow.name,
      slug: listingRow.slug,
      sourceUrl: listingRow.sourceUrl,
    });

    const storefrontUrl = listingRow.externalUrl?.trim() ?? "";
    const now = new Date();

    async function upsertProbe(
      payload: typeof dbSchema.storeListingOAuthProbes.$inferInsert,
    ): Promise<void> {
      const { storeListingId: _listingPk, ...rest } = payload;
      void _listingPk;
      await context.db.insert(probes).values(payload).onConflictDoUpdate({
        target: probes.storeListingId,
        set: rest,
      });
    }

    if (!storefrontUrl) {
      await upsertProbe({
        storeListingId: listingRow.id,
        slug: slugText,
        status: "skipped_no_url",
        probeError: null,
        probedUrl: null,
        probedAt: now,
        oauthScopesDistinct: [],
        transitionalScopes: [],
        publishesAtprotoScope: null,
        clientScopeRawLine: null,
        clientScopeSyntaxOk: null,
        hasProtectedResourceMetadata: false,
        hasAuthorizationServerMetadata: false,
        successfulClientMetadataUrl: null,
        reportJson: null,
        updatedAt: now,
      });
      const skippedSnapshot = await fetchStoreListingOAuthProbe(
        listingRow.id,
        context,
      );
      if (!skippedSnapshot) {
        throw new Error("OAuth probe snapshot missing after rescan.");
      }
      return skippedSnapshot;
    }

    try {
      const report = await probeOAuthListingAuth(storefrontUrl);
      const successfulClientUrl = report.clientMetadata.find(
        (c) => c.result.ok,
      )?.url;

      await upsertProbe({
        storeListingId: listingRow.id,
        slug: slugText,
        status: "completed",
        probeError: null,
        probedUrl: report.inputUrl,
        probedAt: now,
        oauthScopesDistinct: report.summary.oauthScopesDistinct,
        transitionalScopes: report.summary.transitionalScopesPresent,
        publishesAtprotoScope: report.summary.publishesAtprotoAs,
        clientScopeRawLine: report.summary.clientScopeRawLine,
        clientScopeSyntaxOk: report.summary.clientScopeSyntaxOk,
        hasProtectedResourceMetadata: Boolean(report.protectedResource.raw),
        hasAuthorizationServerMetadata: report.authorizationServersDetail.some(
          (r) => r.result.ok,
        ),
        successfulClientMetadataUrl: successfulClientUrl ?? null,
        reportJson: report,
        updatedAt: now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await upsertProbe({
        storeListingId: listingRow.id,
        slug: slugText,
        status: "error",
        probeError: message,
        probedUrl: storefrontUrl,
        probedAt: now,
        oauthScopesDistinct: [],
        transitionalScopes: [],
        publishesAtprotoScope: null,
        clientScopeRawLine: null,
        clientScopeSyntaxOk: null,
        hasProtectedResourceMetadata: false,
        hasAuthorizationServerMetadata: false,
        successfulClientMetadataUrl: null,
        reportJson: null,
        updatedAt: now,
      });
    }

    const snapshot = await fetchStoreListingOAuthProbe(listingRow.id, context);
    if (!snapshot) {
      throw new Error("OAuth probe snapshot missing after rescan.");
    }
    return snapshot;
  });

function toListingDetail(
  row: DirectoryListingDetailRow,
  options: {
    isStoreManaged: boolean;
    oauthProbe: DirectoryListingOAuthProbe | null;
  },
): DirectoryListingDetail {
  const primary = primaryCategorySlug(row.categorySlugs);
  const assignedCategory = getDirectoryCategoryOption(primary);

  return {
    ...toListingCard(row),
    atUri: row.atUri,
    isStoreManaged: options.isStoreManaged,
    repoDid: row.repoDid ?? null,
    productAccountDid: row.productAccountDid,
    sourceTagline: row.tagline ?? null,
    sourceFullDescription: row.fullDescription ?? null,
    screenshots: row.screenshotUrls,
    externalUrl: row.externalUrl,
    sourceUrl: row.sourceUrl,
    rawCategoryHint: row.rawCategoryHint
      ? formatMetadataLabel(row.rawCategoryHint)
      : null,
    scope: row.scope ? formatMetadataLabel(row.scope) : null,
    productType: row.productType ? formatMetadataLabel(row.productType) : null,
    domain: row.domain ? formatMetadataLabel(row.domain) : null,
    vertical: row.vertical ? formatMetadataLabel(row.vertical) : null,
    classificationReason: row.classificationReason,
    categorySlugs: row.categorySlugs ?? [],
    categorySlug: primary,
    categoryPathLabel: assignedCategory?.pathLabel || null,
    appTags: normalizeAppTags(row.appTags ?? []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    links: normalizeListingLinks(row.links ?? null),
    oauthProbe: options.oauthProbe,
  };
}

function dedupeListings(rows: Array<DirectoryListingRow>) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);
    return true;
  });
}

function requireCards(
  cards: Array<DirectoryListingCard>,
  desiredCount: number,
  label: string,
) {
  if (cards.length < desiredCount) {
    throw new Error(`Expected ${desiredCount} ${label}, found ${cards.length}`);
  }

  return cards.slice(0, desiredCount);
}

function resolveConfiguredHomeHeroRows(input: {
  configuredRows: Array<DirectoryListingRow>;
  fallbackRows: Array<DirectoryListingRow>;
  desiredCount: number;
}) {
  if (input.configuredRows.length >= input.desiredCount) {
    return input.configuredRows.slice(0, input.desiredCount);
  }

  return input.fallbackRows.slice(0, input.desiredCount);
}

function buildCategories(rows: Array<DirectoryListingRow>, limit = 4) {
  const tree = buildDirectoryCategoryTree(
    rows.flatMap((row) => row.categorySlugs ?? []),
  );
  const assignedCategories = flattenDirectoryCategoryTree(tree)
    .filter((node) => node.depth > 0 && node.count > 0)
    .toSorted((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (right.depth !== left.depth) {
        return right.depth - left.depth;
      }

      return left.pathLabels
        .join(" / ")
        .localeCompare(right.pathLabels.join(" / "));
    });

  if (assignedCategories.length > 0) {
    return assignedCategories
      .slice(0, limit)
      .map((category) => toDirectoryCategorySummary(category));
  }

  return fallbackCategoryIds
    .map((categoryId) => getDirectoryCategoryOption(categoryId))
    .filter(
      (category): category is NonNullable<typeof category> => category !== null,
    )
    .map((category) =>
      toDirectoryCategorySummary({
        ...category,
        count: 0,
      }),
    )
    .slice(0, limit);
}

type DirectoryListingAppTagRow = DirectoryListingRow & {
  appTags: string[] | null;
};

function isBrowseableAppRow(row: Pick<DirectoryListingRow, "categorySlugs">) {
  return row.categorySlugs.some(
    (slug) => slug.startsWith("apps/") && slug.split("/").length === 2,
  );
}

function buildAppTagGroups(
  rows: Array<DirectoryListingAppTagRow>,
  options?: { preserveListingOrder?: boolean },
) {
  const preserveListingOrder = options?.preserveListingOrder ?? false;
  const groups = new Map<string, Array<DirectoryListingCard>>();

  for (const row of rows) {
    if (!isBrowseableAppRow(row)) {
      continue;
    }

    const card = toListingCard(row);

    for (const tag of normalizeAppTags(row.appTags ?? [])) {
      const listings = groups.get(tag);
      if (listings) {
        listings.push(card);
        continue;
      }

      groups.set(tag, [card]);
    }
  }

  return [...groups.entries()]
    .map(
      ([tag, listings]) =>
        ({
          tag,
          count: listings.length,
          listings: preserveListingOrder
            ? [...listings]
            : [...listings].toSorted((left, right) =>
                left.name.localeCompare(right.name),
              ),
        }) satisfies DirectoryAppTagGroup,
    )
    .toSorted((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.tag.localeCompare(right.tag);
    });
}

function buildAllApps(rows: Array<DirectoryListingRow>) {
  return dedupeListings(rows.filter((row) => isBrowseableAppRow(row))).map(
    (row) => toListingCard(row),
  );
}

function isHomePageFeaturedAppRow(
  row: Pick<DirectoryListingRow, "categorySlugs">,
) {
  return row.categorySlugs.some(
    (slug) => slug.startsWith("apps/") && slug.split("/").length === 2,
  );
}

function isBrowseableProtocolRow(
  row: Pick<DirectoryListingRow, "categorySlugs">,
) {
  return row.categorySlugs.some(
    (slug) => getRootProtocolCategoryId(slug) !== null,
  );
}

function getRootProtocolCategoryId(slug: string): string | null {
  const parts = slug.split("/");
  if (parts[0] !== "protocol") {
    return null;
  }

  const rootSegment = parts[1];
  if (!rootSegment) {
    return null;
  }

  return `protocol/${rootSegment}`;
}

function buildHomePageTagSummaries(
  rows: Array<DirectoryListingAppTagRow>,
  limit = 4,
): Array<DirectoryAppTagSummary> {
  const groups = buildAppTagGroups(rows);

  if (groups.length > 0) {
    return groups.slice(0, limit).map(({ tag, count: listingCount }) => ({
      tag,
      count: listingCount,
    }));
  }

  throw new Error("No app tag summaries found");
}

/** Public listing card projection — never include `claim_pending_for_did` (server-only). */
function getListingSelect(table: typeof dbSchema.storeListings) {
  return {
    id: table.id,
    name: table.name,
    slug: table.slug,
    iconUrl: table.iconUrl,
    heroImageUrl: table.heroImageUrl,
    screenshotUrls: table.screenshotUrls,
    tagline: table.tagline,
    fullDescription: table.fullDescription,
    scope: sql<string | null>`null::text`.as("scope"),
    productType: sql<string | null>`null::text`.as("productType"),
    domain: sql<string | null>`null::text`.as("domain"),
    categorySlugs: table.categorySlugs,
    appTags: table.appTags,
    reviewCount: table.reviewCount,
    averageRating: table.averageRating,
    productAccountHandle: table.productAccountHandle,
  };
}

function assertDevelopmentOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This action is only available in development.");
  }
}

async function getFullDirectoryListing(
  context: { db: Database; schema: typeof dbSchema },
  id: string,
): Promise<StoreListing> {
  const table = context.schema.storeListings;
  const [row] = await context.db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!row) {
    throw new Error(`Listing not found: ${id}`);
  }
  return row;
}

function getListingGenerationUrl(listing: DirectoryListingGenerationCandidate) {
  return listing.externalUrl || listing.sourceUrl || null;
}

function normalizeGeneratedText(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replaceAll("\u00A0", " ")
    .replaceAll(/[ \t]{2,}/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function dedupeGeneratedStrings(
  values: Array<string | null | undefined>,
): Array<string> {
  const seen = new Set<string>();
  const out: Array<string> = [];

  for (const value of values) {
    const cleaned = normalizeGeneratedText(value);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

function shortenToSentence(value: string, maxLength = 160): string {
  const cleaned = normalizeGeneratedText(value) ?? value.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sentenceMatch = cleaned.match(/^(.{30,200}?[.!?])(?:\s|$)/);
  if (sentenceMatch?.[1] && sentenceMatch[1].length <= maxLength) {
    return sentenceMatch[1].trim();
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function isLikelyBoilerplateText(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 30) {
    return true;
  }

  return (
    normalized.includes("cookie") ||
    normalized.includes("privacy policy") ||
    normalized.includes("terms of service") ||
    normalized.includes("all rights reserved") ||
    normalized.includes("sign in") ||
    normalized.includes("log in") ||
    normalized.includes("create account")
  );
}

async function extractPageCopy(url: string): Promise<ExtractedPageCopy> {
  const { chromium } = await import(/* @vite-ignore */ "playwright");
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 960,
      },
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(2500);

    const [
      title,
      finalUrl,
      metaDescription,
      ogDescription,
      headings,
      paragraphs,
    ] = await Promise.all([
      page.title(),
      page.url(),
      page
        .locator('meta[name="description"]')
        .first()
        .getAttribute("content")
        .catch(() => null),
      page
        .locator('meta[property="og:description"]')
        .first()
        .getAttribute("content")
        .catch(() => null),
      page
        .locator(
          'main h1, main h2, main h3, article h1, article h2, article h3, [role="main"] h1, [role="main"] h2, [role="main"] h3, body h1, body h2, body h3',
        )
        .evaluateAll((nodes) =>
          nodes
            .map((node) => node.textContent ?? "")
            .map((value) => value.replaceAll(/\s+/g, " ").trim())
            .filter((value) => value.length > 0)
            .slice(0, 10),
        ),
      page
        .locator(
          'main p, main li, article p, article li, [role="main"] p, [role="main"] li, body p, body li',
        )
        .evaluateAll((nodes) =>
          nodes
            .map((node) => node.textContent ?? "")
            .map((value) => value.replaceAll(/\s+/g, " ").trim())
            .filter((value) => value.length >= 30)
            .slice(0, 24),
        ),
    ]);

    return {
      finalUrl,
      title,
      metaDescription,
      ogDescription,
      headings: dedupeGeneratedStrings(headings),
      paragraphs: dedupeGeneratedStrings(paragraphs),
    };
  } finally {
    await browser.close();
  }
}

function chooseSiteTagline(extracted: ExtractedPageCopy): string | null {
  const candidates = dedupeGeneratedStrings([
    extracted.metaDescription,
    extracted.ogDescription,
    extracted.headings[1],
    extracted.paragraphs[0],
    extracted.title,
  ]);

  for (const candidate of candidates) {
    if (isLikelyBoilerplateText(candidate)) continue;
    if (candidate.length < 24) continue;

    return shortenToSentence(candidate, 140);
  }

  return null;
}

function chooseSiteDescription(extracted: ExtractedPageCopy): string | null {
  const parts: Array<string> = [];

  for (const paragraph of extracted.paragraphs) {
    if (isLikelyBoilerplateText(paragraph)) continue;
    if (
      parts.some(
        (existing) => existing.toLowerCase() === paragraph.toLowerCase(),
      )
    ) {
      continue;
    }

    parts.push(paragraph);
    if (parts.join("\n\n").length >= 420) {
      break;
    }
  }

  const joined = normalizeGeneratedText(parts.join("\n\n"));
  if (joined && joined.length >= 80) {
    return joined;
  }

  return (
    dedupeGeneratedStrings([
      extracted.metaDescription,
      extracted.ogDescription,
      extracted.paragraphs[0],
    ])[0] ?? null
  );
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice =
    start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed: unknown = JSON.parse(slice);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object from model");
  }

  return parsed as Record<string, unknown>;
}

async function generateListingCopyField(input: {
  field: "tagline" | "description";
  listing: DirectoryListingGenerationCandidate;
  extracted: ExtractedPageCopy;
  preferredTagline: string | null;
  preferredDescription: string | null;
}): Promise<string> {
  const apiKey =
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY or ANTHROPIC_KEY in the environment for copy generation.",
    );
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  const responseKey = input.field === "tagline" ? "tagline" : "description";
  const payload = {
    name: input.listing.name,
    url: input.extracted.finalUrl,
    sourceUrl: input.listing.sourceUrl,
    rawCategoryHint: input.listing.rawCategoryHint,
    scope: input.listing.scope,
    productType: input.listing.productType,
    domain: input.listing.domain,
    currentTagline: sanitizeListingTagline(input.listing.tagline),
    currentDescription: sanitizeListingDescription(
      input.listing.fullDescription,
    ),
    preferredTagline: input.preferredTagline,
    preferredDescription: input.preferredDescription,
    pageTitle: input.extracted.title,
    metaDescription: input.extracted.metaDescription,
    ogDescription: input.extracted.ogDescription,
    headings: input.extracted.headings.slice(0, 8),
    paragraphs: input.extracted.paragraphs.slice(0, 10),
  };

  const message = await client.messages.create({
    model,
    max_tokens: 400,
    temperature: 0.2,
    system:
      input.field === "tagline"
        ? `You write concise, accurate software directory taglines.

Rules:
- Prefer the product's own wording when it is available and clear.
- Do not invent features, platforms, pricing, or claims not supported by the provided page text.
- The tagline must be a single sentence under 140 characters.
- Avoid hype, filler, and phrases like "revolutionary" or "next-generation".
- Return JSON only with the key "tagline".`
        : `You write concise, accurate software directory descriptions.

Rules:
- Prefer the product's own wording when it is available and clear.
- Do not invent features, platforms, pricing, or claims not supported by the provided page text.
- Always write the final description in English, even if the source website is in another language.
- Translate or paraphrase non-English source text into natural English.
- The description should be 2-4 sentences and explain what the product is and why someone would use it.
- Avoid hype, filler, and phrases like "revolutionary" or "next-generation".
- Never include metadata labels such as Category, Platforms, Status, or Last checked.
- Return JSON only with the key "description".`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();
  const parsed = parseJsonObject(text);
  const value = String(parsed[responseKey] ?? "");

  if (input.field === "tagline") {
    const tagline = sanitizeListingTagline(value);
    if (!tagline) {
      throw new Error("Model returned an empty tagline");
    }

    return tagline;
  }

  const description = sanitizeListingDescription(value);
  if (!description) {
    throw new Error("Model returned an empty description");
  }

  return description;
}

async function generateListingTextField(input: {
  field: "tagline" | "description";
  listing: DirectoryListingGenerationCandidate;
}): Promise<{ value: string; source: "website" | "model" }> {
  const pageUrl = getListingGenerationUrl(input.listing);
  if (!pageUrl) {
    throw new Error(`Missing URL for ${input.listing.name}`);
  }

  const extracted = await extractPageCopy(pageUrl);
  const siteTagline = chooseSiteTagline(extracted);
  const siteDescription = chooseSiteDescription(extracted);

  if (input.field === "tagline" && siteTagline) {
    return {
      value: siteTagline,
      source: "website",
    };
  }

  return {
    value: await generateListingCopyField({
      field: input.field,
      listing: input.listing,
      extracted,
      preferredTagline: siteTagline,
      preferredDescription: siteDescription,
    }),
    source: "model",
  };
}

async function getDirectoryListingGenerationCandidate(
  context: { db: Database; schema: typeof dbSchema },
  id: string,
): Promise<DirectoryListingGenerationCandidate> {
  const table = context.schema.storeListings;
  const [listing] = await context.db
    .select({
      id: table.id,
      name: table.name,
      sourceUrl: table.sourceUrl,
      externalUrl: table.externalUrl,
      screenshotUrls: table.screenshotUrls,
      tagline: table.tagline,
      fullDescription: table.fullDescription,
      rawCategoryHint: sql<string | null>`null::text`.as("rawCategoryHint"),
      scope: sql<string | null>`null::text`.as("scope"),
      productType: sql<string | null>`null::text`.as("productType"),
      domain: sql<string | null>`null::text`.as("domain"),
    })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);

  if (!listing) {
    throw new Error(`Listing not found: ${id}`);
  }

  return listing;
}

const getHomePageData = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings;
    const homeHeroTable = context.schema.homePageHeroListings;
    const homePromoTable = context.schema.homePagePromoListing;
    const listingSelect = getListingSelect(table);

    const [
      recentRows,
      newestRows,
      tagRows,
      configuredHomeHeroRows,
      configuredHomePromoRow,
    ] = await Promise.all([
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, "apps"),
          ),
        )
        .orderBy(...orderByPopularListingSort(table))
        .limit(30),
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, "apps"),
          ),
        )
        .orderBy(desc(table.createdAt))
        .limit(6),
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, "apps"),
          ),
        )
        .orderBy(...orderByPopularListingSort(table)),
      (async (): Promise<Array<DirectoryListingRow>> => {
        const configured = await context.db
          .select({
            listingId: homeHeroTable.storeListingId,
          })
          .from(homeHeroTable)
          .orderBy(asc(homeHeroTable.position));

        if (configured.length === 0) {
          return [] as Array<DirectoryListingRow>;
        }

        const configuredListingIds = configured.map((row) => row.listingId);
        const configuredListingRows = (await context.db
          .select(listingSelect)
          .from(table)
          .where(
            listingPublicWhere(
              table,
              and(
                inArray(table.id, configuredListingIds),
                sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, "apps"),
              ),
            ),
          )) as Array<DirectoryListingRow>;

        const rowsById = new Map(
          configuredListingRows.map((row) => [row.id, row]),
        );
        return configuredListingIds
          .map((id) => rowsById.get(id) ?? null)
          .filter((row): row is DirectoryListingRow => row !== null);
      })(),
      (async (): Promise<DirectoryListingRow | null> => {
        const [configured] = await context.db
          .select({
            listingId: homePromoTable.storeListingId,
          })
          .from(homePromoTable)
          .limit(1);

        if (!configured) {
          return null;
        }

        const [row] = (await context.db
          .select(listingSelect)
          .from(table)
          .where(
            listingPublicWhere(
              table,
              and(
                eq(table.id, configured.listingId),
                sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, "apps"),
              ),
            ),
          )
          .limit(1)) as Array<DirectoryListingRow>;

        return row ?? null;
      })(),
    ]);

    if (recentRows.length === 0) {
      throw new Error("No recent rows found");
    }

    const dedupedRecentRows = dedupeListings(recentRows);
    const dedupedRecentAppRows = dedupedRecentRows.filter((row) =>
      isHomePageFeaturedAppRow(row),
    );
    const fallbackFeaturedSource =
      dedupedRecentAppRows.find(
        (row) =>
          row.heroImageUrl || row.screenshotUrls.length > 0 || row.iconUrl,
      ) || dedupedRecentAppRows[0];

    const heroRows = resolveConfiguredHomeHeroRows({
      configuredRows: dedupeListings(configuredHomeHeroRows),
      fallbackRows: dedupedRecentAppRows,
      desiredCount: 3,
    });
    const featuredSource = heroRows[0] ?? fallbackFeaturedSource;

    if (!featuredSource) {
      throw new Error("No homepage featured listing found");
    }

    const featured = toListingCard(featuredSource);
    const remainingAppRows =
      heroRows.length > 1
        ? heroRows.slice(1)
        : dedupedRecentAppRows.filter((row) => row.id !== featuredSource.id);

    const spotlightRows = remainingAppRows.slice(0, 2);
    const spotlights = requireCards(
      spotlightRows.map((row) => toListingCard(row)),
      2,
      "homepage spotlights",
    );

    const popularRows = dedupedRecentRows
      .filter((row) => row.id !== featuredSource.id)
      .slice(0, 6);
    const popular = requireCards(
      popularRows.map((row) => toListingCard(row)),
      6,
      "homepage popular listings",
    );

    const freshRows = dedupeListings(newestRows)
      .filter((row) => row.id !== featuredSource.id)
      .slice(0, 3);
    const fresh = requireCards(
      freshRows.map((row) => toListingCard(row)),
      3,
      "homepage fresh listings",
    );

    // Use the admin-configured promo when present; otherwise auto-pick a
    // listing that isn't already shown elsewhere so the slot acts as a
    // discovery surface rather than a re-feature.
    const displayedListingIds = new Set<string>([
      featuredSource.id,
      ...spotlightRows.map((row) => row.id),
      ...popularRows.map((row) => row.id),
      ...freshRows.map((row) => row.id),
    ]);
    let promoSource: DirectoryListingRow | null = configuredHomePromoRow;
    if (!promoSource) {
      const promoCandidates = dedupedRecentAppRows.filter(
        (row) => !displayedListingIds.has(row.id),
      );
      promoSource =
        promoCandidates.find((row) => row.heroImageUrl) ??
        promoCandidates.find(
          (row) => row.screenshotUrls.length > 0 || row.iconUrl,
        ) ??
        promoCandidates[0] ??
        null;
    }
    const promo = promoSource ? toListingCard(promoSource) : null;

    const tags = buildHomePageTagSummaries(tagRows, 9);

    return {
      featured,
      spotlights,
      popular,
      fresh,
      promo,
      tags,
    } satisfies DirectoryHomePageData;
  });

const getHomePageQueryOptions = queryOptions({
  queryKey: ["storeListings", "home"],
  queryFn: async () => getHomePageData(),
});

const getDirectoryCategories = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(listingPublicWhere(table))
      .orderBy(...orderByPopularListingSort(table))
      .limit(500);

    return buildCategories(rows, 12);
  });

const getDirectoryCategoriesQueryOptions = queryOptions({
  queryKey: ["storeListings", "categories"],
  queryFn: async () => getDirectoryCategories(),
});

const getDirectoryCategoryTree = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings;
    const rows = await context.db
      .select({
        categorySlugs: table.categorySlugs,
      })
      .from(table)
      .where(listingPublicWhere(table));

    return buildDirectoryCategoryTree(
      rows.flatMap((row) => row.categorySlugs ?? []),
    );
  });

const getDirectoryCategoryTreeQueryOptions = queryOptions({
  queryKey: ["storeListings", "categoryTree"],
  queryFn: async () => getDirectoryCategoryTree(),
});

const getDirectoryCategoryPage = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryCategoryPageInput)
  .handler(async ({ data, context }) => {
    const input = getDirectoryCategoryPageInput.parse(data);
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(listingPublicWhere(table))
      .orderBy(
        ...(input.sort === "newest"
          ? [desc(table.createdAt)]
          : input.sort === "alphabetical"
            ? [asc(table.name)]
            : orderByPopularListingSort(table)),
      );

    const tree = buildDirectoryCategoryTree(
      rows.flatMap((row) => row.categorySlugs ?? []),
    );
    const category = findDirectoryCategoryNode(tree, input.categoryId);

    if (!category) {
      return null;
    }

    const descendantIds = new Set(
      getDirectoryCategoryDescendantIds(tree, category.id),
    );
    const listings = rows
      .filter((row) =>
        (row.categorySlugs ?? []).some((slug: string) =>
          descendantIds.has(slug),
        ),
      )
      .map((row) => toListingCard(row));

    return {
      category,
      listings,
    } satisfies DirectoryCategoryPageData;
  });

function getDirectoryCategoryPageQueryOptions(
  input: z.input<typeof getDirectoryCategoryPageInput>,
) {
  const normalizedInput = getDirectoryCategoryPageInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "categoryPage", normalizedInput],
    queryFn: async () => getDirectoryCategoryPage({ data: normalizedInput }),
  });
}

const getAppsByTag = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, "apps/%"),
        ),
      )
      .orderBy(...orderByPopularListingSort(table));

    return buildAppTagGroups(rows, { preserveListingOrder: true });
  });

const getAppsByTagQueryOptions = queryOptions({
  queryKey: ["storeListings", "appsByTag"],
  queryFn: async () => getAppsByTag(),
});

/**
 * Distinct app tags currently assigned to top-level `apps/<slug>` listings,
 * sorted by popularity then alphabetically. Powers the tag picker in the
 * listing editor so users choose from tags other top-level app listings
 * already use (rather than a hard-coded canonical set).
 *
 * Sub-app rows (e.g. `apps/bluesky/client`) are intentionally excluded — the
 * lexicon/form invariant is that app tags only apply to top-level apps, so
 * any tags lingering on sub-app rows are stale data and must not leak into
 * the picker.
 */
const getAllDirectoryListingAppTags = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings;
    const rows = await context.db
      .select({ appTags: table.appTags, categorySlugs: table.categorySlugs })
      .from(table);

    const counts = new Map<string, number>();
    for (const row of rows) {
      const hasTopLevelAppCategory = (row.categorySlugs ?? []).some((slug) =>
        isEditableAppCategorySlug(slug),
      );
      if (!hasTopLevelAppCategory) continue;
      for (const tag of normalizeAppTags(row.appTags ?? [])) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(
        ([tag, listingCount]): DirectoryAppTagSummary => ({
          tag,
          count: listingCount,
        }),
      )
      .toSorted((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.tag.localeCompare(right.tag);
      });
  });

const getAllDirectoryListingAppTagsQueryOptions = queryOptions({
  queryKey: ["storeListings", "allAppTags"] as const,
  queryFn: async () => getAllDirectoryListingAppTags(),
});

const getAllAppsInput = z.object({
  sort: listingSortInput,
});

const getAllApps = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getAllAppsInput)
  .handler(async ({ data, context }) => {
    const input = getAllAppsInput.parse(data);
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, "apps/%"),
        ),
      )
      .orderBy(
        ...(input.sort === "newest"
          ? [desc(table.createdAt)]
          : input.sort === "alphabetical"
            ? [asc(table.name)]
            : orderByPopularListingSort(table)),
      );

    return buildAllApps(rows);
  });

function getAllAppsQueryOptions(input: z.input<typeof getAllAppsInput> = {}) {
  const normalizedInput = getAllAppsInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "allApps", normalizedInput],
    queryFn: async () => getAllApps({ data: normalizedInput }),
  });
}

const getAppsByTagPage = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getAppsByTagPageInput)
  .handler(async ({ data, context }) => {
    const input = getAppsByTagPageInput.parse(data);
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, "apps/%"),
        ),
      )
      .orderBy(
        ...(input.sort === "newest"
          ? [desc(table.createdAt)]
          : input.sort === "alphabetical"
            ? [asc(table.name)]
            : orderByPopularListingSort(table)),
      );

    const groups = buildAppTagGroups(rows, { preserveListingOrder: true });
    const tag = findAppTagBySlug(
      groups.map((group) => group.tag),
      input.tag,
    );

    if (!tag) {
      return null;
    }

    return groups.find((group) => group.tag === tag) ?? null;
  });

function getAppsByTagPageQueryOptions(
  input: z.input<typeof getAppsByTagPageInput>,
) {
  const normalizedInput = getAppsByTagPageInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "appsByTagPage", normalizedInput],
    queryFn: async () => getAppsByTagPage({ data: normalizedInput }),
  });
}

const getAllListingsInput = z.object({
  sort: listingSortInput,
});

const getAllListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getAllListingsInput)
  .handler(async ({ data, context }) => {
    const input = getAllListingsInput.parse(data);
    const table = context.schema.storeListings;
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sql`not (${sqlCategorySlugsMatchesLike(table.categorySlugs, "protocol/%")})`,
        ),
      )
      .orderBy(
        ...(input.sort === "newest"
          ? [desc(table.createdAt)]
          : input.sort === "alphabetical"
            ? [asc(table.name)]
            : orderByPopularListingSort(table)),
      );

    return rows.map((row) => toListingCard(row));
  });

function getAllListingsQueryOptions(
  input: z.input<typeof getAllListingsInput> = {},
) {
  const normalizedInput = getAllListingsInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "allListings", normalizedInput],
    queryFn: async () => getAllListings({ data: normalizedInput }),
  });
}

const getDirectoryListingDetail = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings;
    /** Explicit columns only — never `claim_pending_for_did`. */
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        heroImageUrl: table.heroImageUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        categorySlugs: table.categorySlugs,
        atUri: table.atUri,
        repoDid: table.repoDid,
        migratedFromAtUri: table.migratedFromAtUri,
        productAccountDid: table.productAccountDid,
        productAccountHandle: table.productAccountHandle,
        reviewCount: table.reviewCount,
        averageRating: table.averageRating,
        ...storeListingLegacyDetailColumns,
        appTags: table.appTags,
        links: table.links,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.id)))
      .limit(1);

    if (!row) {
      return null;
    }

    const [oauthProbe, isStoreManaged] = await Promise.all([
      fetchStoreListingOAuthProbe(row.id, context),
      computeIsStoreManaged(row),
    ]);

    return toListingDetail(row, {
      isStoreManaged,
      oauthProbe,
    });
  });

const getDirectoryListingDetailBySlug = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({
      slug: z.string().trim().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings;
    /** Explicit columns only — never `claim_pending_for_did`. */
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        heroImageUrl: table.heroImageUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        categorySlugs: table.categorySlugs,
        atUri: table.atUri,
        repoDid: table.repoDid,
        migratedFromAtUri: table.migratedFromAtUri,
        productAccountDid: table.productAccountDid,
        productAccountHandle: table.productAccountHandle,
        reviewCount: table.reviewCount,
        averageRating: table.averageRating,
        ...storeListingLegacyDetailColumns,
        appTags: table.appTags,
        links: table.links,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.slug, data.slug)))
      .limit(1);

    if (!row) {
      return null;
    }

    const [oauthProbe, isStoreManaged] = await Promise.all([
      fetchStoreListingOAuthProbe(row.id, context),
      computeIsStoreManaged(row),
    ]);

    return toListingDetail(row, {
      isStoreManaged,
      oauthProbe,
    });
  });

/**
 * Determines whether a listing's AT proto record is hosted by the at-store
 * publisher (or whether it is not yet on AT proto at all). Listings whose
 * record now lives on a different repo have been claimed by their owner.
 *
 * Edge case: when the at-store publisher account itself is the official product
 * account (e.g. the @atstore.fyi self-listing), a successful PDS claim leaves
 * `repoDid === atstoreDid` because the claimant *is* at-store. `migratedFromAtUri`
 * is set by `claimProductListingToPds` only after a successful PDS migration
 * (and is rolled back on failure), so it's our truthful "claim happened" signal.
 */
async function computeIsStoreManaged(row: {
  atUri: string | null;
  repoDid: string | null;
  migratedFromAtUri: string | null;
}): Promise<boolean> {
  const atUri = row.atUri?.trim();
  if (!atUri) return true;
  const repoDid = row.repoDid?.trim();
  if (!repoDid) return true;
  const atstoreDid = await getAtstoreRepoDid();
  if (repoDid !== atstoreDid) return false;
  return !row.migratedFromAtUri?.trim();
}

function getDirectoryListingDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["storeListings", "detail", id],
    queryFn: async () => getDirectoryListingDetail({ data: { id } }),
  });
}

function getDirectoryListingDetailBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["storeListings", "detailBySlug", slug],
    queryFn: async () => getDirectoryListingDetailBySlug({ data: { slug } }),
  });
}

const getDirectoryListingDetailForOwnerEditInput = z.object({
  productId: z.string().min(1),
});

/** Owner or public-verified listings only — hides non-listed drafts from strangers. */
const getDirectoryListingDetailForOwnerEdit = createServerFn({
  method: "GET",
})
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryListingDetailForOwnerEditInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return null;
    }

    const legacyListingId = getLegacyDirectoryListingId(data.productId);
    const table = context.schema.storeListings;
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        heroImageUrl: table.heroImageUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        categorySlugs: table.categorySlugs,
        verificationStatus: table.verificationStatus,
        atUri: table.atUri,
        repoDid: table.repoDid,
        migratedFromAtUri: table.migratedFromAtUri,
        productAccountDid: table.productAccountDid,
        productAccountHandle: table.productAccountHandle,
        reviewCount: table.reviewCount,
        averageRating: table.averageRating,
        ...storeListingLegacyDetailColumns,
        appTags: table.appTags,
        links: table.links,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(
        legacyListingId
          ? eq(table.id, legacyListingId)
          : eq(table.slug, data.productId.trim()),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    const verified = row.verificationStatus === "verified";
    const isOwner =
      row.productAccountDid?.trim() === session.did &&
      row.repoDid?.trim() === session.did;

    if (!verified && !isOwner) {
      return null;
    }

    const { verificationStatus: _removed, ...detailRow } = row;

    const [oauthProbe, isStoreManaged] = await Promise.all([
      fetchStoreListingOAuthProbe(row.id, context),
      computeIsStoreManaged(row),
    ]);

    return {
      ...toListingDetail(detailRow as DirectoryListingDetailRow, {
        isStoreManaged,
        oauthProbe,
      }),
      verificationStatus: row.verificationStatus,
    };
  });

function getDirectoryListingDetailForOwnerEditQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["storeListings", "detailForOwnerEdit", productId] as const,
    queryFn: async () =>
      getDirectoryListingDetailForOwnerEdit({
        data: { productId },
      }),
  });
}

const getDirectoryListingReviews = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryListingReviewsInput)
  .handler(async ({ data, context }) => {
    if (!isUuid(data.id)) {
      return [];
    }

    const table = context.schema.storeListings;
    const [listing] = await context.db
      .select({
        id: table.id,
        repoDid: table.repoDid,
        productAccountDid: table.productAccountDid,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.id)))
      .limit(1);

    if (!listing) {
      return [];
    }

    const session = await getAtprotoSessionForRequest(getRequest());
    const viewerDid = session?.did ?? undefined;

    const rev = context.schema.storeListingReviews;
    const rows = await context.db
      .select({
        id: rev.id,
        authorDid: rev.authorDid,
        rating: rev.rating,
        text: rev.text,
        reviewCreatedAt: rev.reviewCreatedAt,
        authorDisplayName: rev.authorDisplayName,
        authorAvatarUrl: rev.authorAvatarUrl,
        replyCount: rev.replyCount,
      })
      .from(rev)
      .where(eq(rev.storeListingId, listing.id))
      .orderBy(desc(rev.reviewCreatedAt));

    const enriched: Array<DirectoryListingReview> = await Promise.all(
      rows.map(async (row) => {
        const profile = await fetchBlueskyPublicProfileFields(row.authorDid);
        const handle =
          profile?.handle?.trim() && profile.handle.trim().length > 0
            ? profile.handle.trim()
            : null;
        const displayName =
          row.authorDisplayName?.trim() ||
          profile?.displayName?.trim() ||
          profile?.handle ||
          null;
        const avatarUrl =
          row.authorAvatarUrl?.trim() || profile?.avatarUrl || null;

        const replyCount = Number(row.replyCount ?? 0);
        return {
          id: row.id,
          authorDid: row.authorDid,
          rating: row.rating,
          text: row.text,
          reviewCreatedAt: row.reviewCreatedAt.toISOString(),
          authorDisplayName: displayName,
          authorHandle: handle,
          authorAvatarUrl: avatarUrl,
          replyCount,
          canReply: viewerMayReplyOnListingReview({
            viewerDid,
            reviewAuthorDid: row.authorDid,
            listingRepoDid: listing.repoDid,
            listingProductAccountDid: listing.productAccountDid,
          }),
        };
      }),
    );

    return enriched;
  });

function getDirectoryListingReviewsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["storeListings", "reviews", id],
    queryFn: async () => getDirectoryListingReviews({ data: { id } }),
  });
}

const getDirectoryListingMentions = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryListingMentionsInput)
  .handler(async ({ data, context }) => {
    if (!isUuid(data.id)) {
      return { mentions: [], total: 0 };
    }

    const table = context.schema.storeListings;
    const [listing] = await context.db
      .select({ id: table.id, categorySlugs: table.categorySlugs })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.id)))
      .limit(1);

    if (!listing) {
      return { mentions: [], total: 0 };
    }

    const omitUrl = shouldOmitUrlMentionsForBlueskyPlatformListing(
      listing.categorySlugs,
    );
    const m = context.schema.storeListingMentions;
    const mentionWhere = (
      omitUrl
        ? and(eq(m.storeListingId, listing.id), ne(m.matchType, "url"))
        : eq(m.storeListingId, listing.id)
    ) as SQL;

    const [{ total: mentionCount }] = await context.db
      .select({ total: count() })
      .from(m)
      .where(mentionWhere);
    const total = Number(mentionCount ?? 0);

    const rows = await context.db
      .select({
        id: m.id,
        postUri: m.postUri,
        authorDid: m.authorDid,
        authorHandle: m.authorHandle,
        postText: m.postText,
        postCreatedAt: m.postCreatedAt,
        matchType: m.matchType,
        matchConfidence: m.matchConfidence,
        matchEvidence: m.matchEvidence,
      })
      .from(m)
      .where(mentionWhere)
      .orderBy(desc(m.postCreatedAt))
      .limit(data.limit);

    const postDataByPostUri = await fetchBlueskyPostEmbedsByUri(
      rows.map((row) => row.postUri),
    );

    const profileByDid = new Map<
      string,
      Awaited<ReturnType<typeof fetchBlueskyPublicProfileFields>>
    >();

    async function profileForDid(
      did: string,
    ): Promise<Awaited<ReturnType<typeof fetchBlueskyPublicProfileFields>>> {
      if (profileByDid.has(did)) return profileByDid.get(did) ?? null;
      const p = await fetchBlueskyPublicProfileFields(did);
      profileByDid.set(did, p);
      return p;
    }

    const enriched: Array<DirectoryListingMention> = await Promise.all(
      rows.map(async (row) => {
        const profile = await profileForDid(row.authorDid);
        const handle =
          row.authorHandle?.trim() || profile?.handle?.trim() || null;
        const authorDisplayName = profile?.displayName?.trim() || null;
        const authorAvatarUrl = profile?.avatarUrl ?? null;

        return {
          id: row.id,
          postUri: row.postUri,
          bskyPostUrl: bskyAppPostUrlFromAtUri(row.postUri),
          authorDid: row.authorDid,
          authorHandle: handle,
          authorDisplayName,
          authorAvatarUrl,
          postText: postDataByPostUri.get(row.postUri)?.text ?? row.postText,
          postFacets: postDataByPostUri.get(row.postUri)?.facets ?? null,
          postCreatedAt: row.postCreatedAt.toISOString(),
          matchType: row.matchType,
          matchConfidence: row.matchConfidence,
          matchEvidence:
            row.matchEvidence &&
            typeof row.matchEvidence === "object" &&
            !Array.isArray(row.matchEvidence)
              ? (row.matchEvidence as Record<string, {}>)
              : null,
          postEmbed: postDataByPostUri.get(row.postUri)?.embed ?? null,
        };
      }),
    );

    return { mentions: enriched, total };
  });

function getDirectoryListingMentionsQueryOptions(
  id: string,
  limit: number = 12,
) {
  const normalized = getDirectoryListingMentionsInput.parse({ id, limit });
  return queryOptions({
    queryKey: ["storeListings", "mentions", normalized.id, normalized.limit],
    queryFn: async () =>
      getDirectoryListingMentions({
        data: { id: normalized.id, limit: normalized.limit },
      }),
  });
}

const getUserProfileReviewsPageData = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getUserProfileReviewsPageDataInput)
  .handler(async ({ data, context }) => {
    const did = data.did.trim();
    if (!isPlausiblePublicDid(did)) {
      return null;
    }

    const profile = await fetchBlueskyPublicProfileFields(did);

    const session = await getAtprotoSessionForRequest(getRequest());
    const viewerDid = session?.did ?? undefined;

    const rev = context.schema.storeListingReviews;
    const list = context.schema.storeListings;

    const rows = await context.db
      .select({
        id: rev.id,
        authorDid: rev.authorDid,
        rating: rev.rating,
        text: rev.text,
        reviewCreatedAt: rev.reviewCreatedAt,
        authorDisplayName: rev.authorDisplayName,
        authorAvatarUrl: rev.authorAvatarUrl,
        replyCount: rev.replyCount,
        listingId: list.id,
        listingName: list.name,
        listingSlug: list.slug,
        listingSourceUrl: list.sourceUrl,
        listingIconUrl: list.iconUrl,
        listingTagline: list.tagline,
        listingRepoDid: list.repoDid,
        listingProductAccountDid: list.productAccountDid,
      })
      .from(rev)
      .innerJoin(list, eq(rev.storeListingId, list.id))
      .where(and(eq(rev.authorDid, did), listingPublicWhere(list)))
      .orderBy(desc(rev.reviewCreatedAt));

    const enriched: Array<DirectoryUserReview> = rows.map((row) => {
      const displayName =
        row.authorDisplayName?.trim() ||
        profile?.displayName?.trim() ||
        profile?.handle ||
        null;
      const avatarUrl =
        row.authorAvatarUrl?.trim() || profile?.avatarUrl || null;

      const handle =
        profile?.handle?.trim() && profile.handle.trim().length > 0
          ? profile.handle.trim()
          : null;

      const replyCount = Number(row.replyCount ?? 0);
      return {
        id: row.id,
        authorDid: row.authorDid,
        rating: row.rating,
        text: row.text,
        reviewCreatedAt: row.reviewCreatedAt.toISOString(),
        authorDisplayName: displayName,
        authorHandle: handle,
        authorAvatarUrl: avatarUrl,
        replyCount,
        canReply: viewerMayReplyOnListingReview({
          viewerDid,
          reviewAuthorDid: row.authorDid,
          listingRepoDid: row.listingRepoDid,
          listingProductAccountDid: row.listingProductAccountDid,
        }),
        listing: {
          id: row.listingId,
          name: row.listingName,
          slug: row.listingSlug,
          sourceUrl: row.listingSourceUrl,
          iconUrl: httpsListingImageUrlOrNull(
            row.listingIconUrl?.trim() || null,
          ),
          tagline: row.listingTagline?.trim() || null,
          repoDid: row.listingRepoDid ?? null,
          productAccountDid: row.listingProductAccountDid ?? null,
        },
      };
    });

    return {
      did,
      displayName:
        profile?.displayName?.trim() ||
        enriched[0]?.authorDisplayName?.trim() ||
        null,
      handle: profile?.handle ?? null,
      avatarUrl:
        profile?.avatarUrl?.trim() ||
        enriched[0]?.authorAvatarUrl?.trim() ||
        null,
      reviews: enriched,
    } satisfies UserProfileReviewsPageData;
  });

function getUserProfileReviewsPageDataQueryOptions(did: string) {
  return queryOptions({
    queryKey: ["userProfileReviews", did],
    queryFn: async () => getUserProfileReviewsPageData({ data: { did } }),
  });
}

const getProfileFavoriteListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getProfileFavoriteListingsInput)
  .handler(async ({ data, context }) => {
    const did = data.did.trim();
    if (!isPlausiblePublicDid(did)) {
      return [];
    }
    const fav = context.schema.storeListingFavorites;
    const list = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: list.id,
        name: list.name,
        slug: list.slug,
        iconUrl: list.iconUrl,
        tagline: list.tagline,
        favoritedAt: fav.favoriteCreatedAt,
      })
      .from(fav)
      .innerJoin(list, eq(fav.storeListingId, list.id))
      .where(and(eq(fav.authorDid, did), listingPublicWhere(list)))
      .orderBy(desc(fav.favoriteCreatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      tagline: row.tagline?.trim() || null,
      favoritedAt: row.favoritedAt.toISOString(),
    })) satisfies Array<DirectoryUserFavoriteListing>;
  });

function getProfileFavoriteListingsQueryOptions(did: string) {
  return queryOptions({
    queryKey: ["storeListings", "profileFavorites", did] as const,
    queryFn: async () => getProfileFavoriteListings({ data: { did } }),
  });
}

const getDirectoryListingFavoriteStatus = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(listingFavoriteInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      return { isFavorited: false } satisfies DirectoryListingFavoriteStatus;
    }

    const list = context.schema.storeListings;
    const [listing] = await context.db
      .select({ id: list.id })
      .from(list)
      .where(listingPublicWhere(list, eq(list.id, data.listingId)))
      .limit(1);

    if (!listing) {
      return { isFavorited: false } satisfies DirectoryListingFavoriteStatus;
    }

    const fav = context.schema.storeListingFavorites;
    const [favorite] = await context.db
      .select({ id: fav.id })
      .from(fav)
      .where(
        and(
          eq(fav.storeListingId, data.listingId),
          eq(fav.authorDid, session.did),
        ),
      )
      .limit(1);

    return {
      isFavorited: Boolean(favorite),
    } satisfies DirectoryListingFavoriteStatus;
  });

function getDirectoryListingFavoriteStatusQueryOptions(listingId: string) {
  return queryOptions({
    queryKey: ["storeListings", "favoriteStatus", listingId] as const,
    queryFn: async () =>
      getDirectoryListingFavoriteStatus({ data: { listingId } }),
  });
}

const favoriteDirectoryListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(listingFavoriteInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to favorite products.");
    }

    const t = context.schema.storeListings;
    const [listing] = await context.db
      .select({
        id: t.id,
        atUri: t.atUri,
      })
      .from(t)
      .where(listingPublicWhere(t, eq(t.id, data.listingId)))
      .limit(1);
    if (!listing) {
      throw new Error("Listing not found.");
    }

    const subject = listing.atUri?.trim();
    if (!subject) {
      throw new Error(
        "This listing cannot be favorited until it is published on AT Protocol.",
      );
    }

    const createdAt = new Date().toISOString();
    await putListingFavoriteRecord(
      session.client,
      session.did,
      data.listingId,
      {
        subject,
        createdAt,
      },
    );
    return { ok: true as const };
  });

const unfavoriteDirectoryListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(listingFavoriteInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to manage favorites.");
    }

    const t = context.schema.storeListings;
    const [listing] = await context.db
      .select({ id: t.id })
      .from(t)
      .where(listingPublicWhere(t, eq(t.id, data.listingId)))
      .limit(1);
    if (!listing) {
      throw new Error("Listing not found.");
    }

    await deleteRecord(
      session.client,
      session.did,
      COLLECTION.listingFavorite,
      data.listingId,
    );
    return { ok: true as const };
  });

const createDirectoryListingReview = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(createDirectoryListingReviewInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to post a review.");
    }

    const table = context.schema.storeListings;
    const [listing] = await context.db
      .select({
        id: table.id,
        atUri: table.atUri,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.listingId)))
      .limit(1);

    if (!listing) {
      throw new Error("Listing not found.");
    }

    const atUri = listing.atUri?.trim();
    if (!atUri) {
      throw new Error(
        "This listing has no AT Protocol URI yet; reviews are unavailable until it is published to the network.",
      );
    }

    const rev = context.schema.storeListingReviews;
    const [existing] = await context.db
      .select({ id: rev.id })
      .from(rev)
      .where(
        and(eq(rev.storeListingId, listing.id), eq(rev.authorDid, session.did)),
      )
      .limit(1);

    if (existing) {
      throw new Error("You already reviewed this listing.");
    }

    const createdAt = new Date().toISOString();
    const { uri } = await createListingReviewRecord(
      session.client,
      session.did,
      {
        subject: atUri,
        rating: data.rating,
        createdAt,
        text: data.text,
      },
    );

    const { repo, rkey } = parseAtUriParts(uri);
    if (repo !== session.did) {
      throw new Error("Unexpected review record repo DID.");
    }

    const record: {
      $type: typeof NSID.listingReview;
      subject: string;
      rating: number;
      createdAt: string;
      text?: string;
    } = {
      $type: NSID.listingReview,
      subject: atUri,
      rating: data.rating,
      createdAt,
    };
    const trimmed = data.text?.trim();
    if (trimmed) {
      record.text = trimmed;
    }

    await upsertListingReviewFromTap({
      db: context.db,
      did: repo,
      rkey,
      record,
    });

    const [reviewRow] = await context.db
      .select({ id: rev.id })
      .from(rev)
      .where(eq(rev.atUri, uri))
      .limit(1);

    if (!reviewRow) {
      throw new Error(
        "Review was created on the network but could not be mirrored locally.",
      );
    }

    return { uri, reviewId: reviewRow.id };
  });

const updateDirectoryListingReview = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(updateDirectoryListingReviewInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to edit your review.");
    }

    const revTable = context.schema.storeListingReviews;
    const listTable = context.schema.storeListings;

    const [revRow] = await context.db
      .select({
        rkey: revTable.rkey,
        reviewCreatedAt: revTable.reviewCreatedAt,
        storeListingId: revTable.storeListingId,
      })
      .from(revTable)
      .where(
        and(
          eq(revTable.id, data.reviewId),
          eq(revTable.authorDid, session.did),
        ),
      )
      .limit(1);

    if (!revRow) {
      throw new Error(
        "Review not found or you do not have permission to edit it.",
      );
    }

    const [listing] = await context.db
      .select({
        atUri: listTable.atUri,
      })
      .from(listTable)
      .where(
        listingPublicWhere(listTable, eq(listTable.id, revRow.storeListingId)),
      )
      .limit(1);

    if (!listing) {
      throw new Error("Listing not found.");
    }

    const atUri = listing.atUri?.trim();
    if (!atUri) {
      throw new Error(
        "This listing has no AT Protocol URI yet; reviews cannot be updated until it is published to the network.",
      );
    }

    await putListingReviewRecord(session.client, session.did, revRow.rkey, {
      subject: atUri,
      rating: data.rating,
      createdAt: revRow.reviewCreatedAt.toISOString(),
      text: data.text,
    });

    return { ok: true as const };
  });

const deleteDirectoryListingReview = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(deleteDirectoryListingReviewInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to delete your review.");
    }

    const revTable = context.schema.storeListingReviews;
    const [revRow] = await context.db
      .select({
        rkey: revTable.rkey,
      })
      .from(revTable)
      .where(
        and(
          eq(revTable.id, data.reviewId),
          eq(revTable.authorDid, session.did),
        ),
      )
      .limit(1);

    if (!revRow) {
      throw new Error(
        "Review not found or you do not have permission to delete it.",
      );
    }

    await deleteRecord(
      session.client,
      session.did,
      COLLECTION.listingReview,
      revRow.rkey,
    );

    return { ok: true as const };
  });

const getDirectoryListingReviewReplies = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryListingReviewRepliesInput)
  .handler(async ({ data, context }) => {
    const rev = context.schema.storeListingReviews;
    const list = context.schema.storeListings;
    const rep = context.schema.storeListingReviewReplies;

    const [ctxRow] = await context.db
      .select({ reviewId: rev.id })
      .from(rev)
      .innerJoin(list, eq(rev.storeListingId, list.id))
      .where(and(eq(rev.id, data.reviewId), listingPublicWhere(list)))
      .limit(1);

    if (!ctxRow) {
      return [];
    }

    const authorAllowed = sqlReplyAuthorAllowedPredicate(rep, rev, list);

    const rows = await context.db
      .select({
        id: rep.id,
        authorDid: rep.authorDid,
        text: rep.text,
        replyCreatedAt: rep.replyCreatedAt,
      })
      .from(rep)
      .innerJoin(rev, eq(rep.reviewId, rev.id))
      .innerJoin(list, eq(rev.storeListingId, list.id))
      .where(
        and(
          eq(rep.reviewId, data.reviewId),
          listingPublicWhere(list),
          authorAllowed,
        ),
      )
      .orderBy(asc(rep.replyCreatedAt), asc(rep.id));

    const enriched: Array<DirectoryListingReviewReply> = await Promise.all(
      rows.map(async (row) => {
        const profile = await fetchBlueskyPublicProfileFields(row.authorDid);
        const handle =
          profile?.handle?.trim() && profile.handle.trim().length > 0
            ? profile.handle.trim()
            : null;
        const displayName =
          profile?.displayName?.trim() ||
          handle ||
          (row.authorDid.length > 16
            ? `${row.authorDid.slice(0, 10)}…`
            : row.authorDid);

        const avatarUrl = profile?.avatarUrl ?? null;

        return {
          id: row.id,
          authorDid: row.authorDid,
          text: row.text,
          replyCreatedAt: row.replyCreatedAt.toISOString(),
          authorDisplayName: displayName,
          authorHandle: handle,
          authorAvatarUrl: avatarUrl,
        };
      }),
    );

    return enriched;
  });

function getDirectoryListingReviewRepliesQueryOptions(reviewId: string) {
  return queryOptions({
    queryKey: ["storeListings", "reviewReplies", reviewId],
    queryFn: async () =>
      getDirectoryListingReviewReplies({ data: { reviewId } }),
  });
}

const createDirectoryListingReviewReply = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(createDirectoryListingReviewReplyInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to post a reply.");
    }

    const revTable = context.schema.storeListingReviews;
    const listTable = context.schema.storeListings;

    const [row] = await context.db
      .select({
        reviewAtUri: revTable.atUri,
        reviewAuthorDid: revTable.authorDid,
        listingRepoDid: listTable.repoDid,
        listingProductDid: listTable.productAccountDid,
      })
      .from(revTable)
      .innerJoin(listTable, eq(revTable.storeListingId, listTable.id))
      .where(and(eq(revTable.id, data.reviewId), listingPublicWhere(listTable)))
      .limit(1);

    if (!row) {
      throw new Error("Review not found.");
    }

    if (
      !viewerMayReplyOnListingReview({
        viewerDid: session.did,
        reviewAuthorDid: row.reviewAuthorDid,
        listingRepoDid: row.listingRepoDid,
        listingProductAccountDid: row.listingProductDid,
      })
    ) {
      throw new Error("You cannot reply on this thread.");
    }

    const subject = row.reviewAtUri?.trim();
    if (!subject) {
      throw new Error(
        "This listing has no AT Protocol URI yet; replies are unavailable until it is published to the network.",
      );
    }

    const createdAt = new Date().toISOString();
    const text = data.text.trim();
    const { uri } = await createListingReviewReplyRecord(
      session.client,
      session.did,
      { subject, text, createdAt },
    );

    const { repo, rkey } = parseAtUriParts(uri);
    if (repo !== session.did) {
      throw new Error("Unexpected reply record repo DID.");
    }

    const record: {
      $type: typeof NSID.listingReviewReply;
      subject: string;
      text: string;
      createdAt: string;
    } = {
      $type: NSID.listingReviewReply,
      subject,
      text,
      createdAt,
    };

    await upsertListingReviewReplyFromTap({
      db: context.db,
      did: repo,
      rkey,
      record,
    });

    const repTable = context.schema.storeListingReviewReplies;
    const [replyRow] = await context.db
      .select({ id: repTable.id })
      .from(repTable)
      .where(eq(repTable.atUri, uri))
      .limit(1);

    if (!replyRow) {
      throw new Error(
        "Reply was created on the network but could not be mirrored locally.",
      );
    }

    return { uri, replyId: replyRow.id };
  });

const updateDirectoryListingReviewReply = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(updateDirectoryListingReviewReplyInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to edit your reply.");
    }

    const repTable = context.schema.storeListingReviewReplies;
    const revTable = context.schema.storeListingReviews;
    const listTable = context.schema.storeListings;

    const [joined] = await context.db
      .select({
        rkey: repTable.rkey,
        subjectUri: repTable.subjectUri,
        replyCreatedAt: repTable.replyCreatedAt,
      })
      .from(repTable)
      .innerJoin(revTable, eq(repTable.reviewId, revTable.id))
      .innerJoin(listTable, eq(revTable.storeListingId, listTable.id))
      .where(
        and(
          eq(repTable.id, data.replyId),
          eq(repTable.authorDid, session.did),
          listingPublicWhere(listTable),
        ),
      )
      .limit(1);

    if (!joined) {
      throw new Error(
        "Reply not found or you do not have permission to edit it.",
      );
    }

    await putListingReviewReplyRecord(
      session.client,
      session.did,
      joined.rkey,
      {
        subject: joined.subjectUri,
        createdAt: joined.replyCreatedAt.toISOString(),
        text: data.text.trim(),
      },
    );

    return { ok: true as const };
  });

const deleteDirectoryListingReviewReply = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(deleteDirectoryListingReviewReplyInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session) {
      throw new Error("Sign in to delete your reply.");
    }

    const repTable = context.schema.storeListingReviewReplies;
    const revTable = context.schema.storeListingReviews;
    const listTable = context.schema.storeListings;

    const [joined] = await context.db
      .select({
        rkey: repTable.rkey,
      })
      .from(repTable)
      .innerJoin(revTable, eq(repTable.reviewId, revTable.id))
      .innerJoin(listTable, eq(revTable.storeListingId, listTable.id))
      .where(
        and(
          eq(repTable.id, data.replyId),
          eq(repTable.authorDid, session.did),
          listingPublicWhere(listTable),
        ),
      )
      .limit(1);

    if (!joined) {
      throw new Error(
        "Reply not found or you do not have permission to delete it.",
      );
    }

    await deleteRecord(
      session.client,
      session.did,
      COLLECTION.listingReviewReply,
      joined.rkey,
    );

    return { ok: true as const };
  });

const getRelatedDirectoryListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getRelatedDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    if (!isUuid(data.id)) {
      return [];
    }

    const table = context.schema.storeListings;
    const listingSelect = getListingSelect(table);

    const [currentRow, candidateRows] = await Promise.all([
      context.db
        .select({
          id: table.id,
          appTags: table.appTags,
          categorySlugs: table.categorySlugs,
        })
        .from(table)
        .where(listingPublicWhere(table, eq(table.id, data.id)))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      context.db
        .select({
          ...listingSelect,
          updatedAt: table.updatedAt,
          createdAt: table.createdAt,
        })
        .from(table)
        .where(listingPublicWhere(table, ne(table.id, data.id)))
        .orderBy(...orderByPopularListingSort(table))
        .limit(128),
    ]);

    if (!currentRow) {
      return [];
    }

    const currentTags = new Set(normalizeAppTags(currentRow.appTags ?? []));
    if (currentTags.size === 0) {
      return [];
    }

    return candidateRows
      .map((row) => {
        const tags = normalizeAppTags(row.appTags ?? []);
        let overlapCount = 0;

        for (const tag of tags) {
          if (currentTags.has(tag)) {
            overlapCount += 1;
          }
        }

        if (overlapCount === 0) {
          return null;
        }

        return {
          card: toListingCard(row),
          overlapCount,
          sameCategory: categorySlugsOverlap(
            row.categorySlugs,
            currentRow.categorySlugs,
          ),
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .toSorted((left, right) => {
        if (right.overlapCount !== left.overlapCount) {
          return right.overlapCount - left.overlapCount;
        }

        if (left.sameCategory !== right.sameCategory) {
          return left.sameCategory ? -1 : 1;
        }

        const updatedDelta =
          right.updatedAt.getTime() - left.updatedAt.getTime();
        if (updatedDelta !== 0) {
          return updatedDelta;
        }

        const createdDelta =
          right.createdAt.getTime() - left.createdAt.getTime();
        if (createdDelta !== 0) {
          return createdDelta;
        }

        return left.card.name.localeCompare(right.card.name);
      })
      .slice(0, data.limit)
      .map((item) => item.card);
  });

function getRelatedDirectoryListingsQueryOptions(
  input: z.input<typeof getRelatedDirectoryListingsInput>,
) {
  const normalizedInput = getRelatedDirectoryListingsInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "related", normalizedInput],
    queryFn: async () => getRelatedDirectoryListings({ data: normalizedInput }),
  });
}

const listDirectoryListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(listDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings;
    const search = data.query?.trim();
    const listingSelect = getListingSelect(table);

    const searchClause = search
      ? or(
          ilike(table.name, `%${search}%`),
          ilike(table.tagline, `%${search}%`),
          ilike(table.fullDescription, `%${search}%`),
          ilike(
            sql<string>`array_to_string(${table.categorySlugs}, ' ')`,
            `%${search}%`,
          ),
          ilike(
            sql<string>`array_to_string(${table.appTags}, ' ')`,
            `%${search}%`,
          ),
        )
      : undefined;

    const noProductHandleClause = data.withoutProductAccountHandleOnly
      ? sql`coalesce(trim(${table.productAccountHandle}), '') = ''`
      : undefined;

    let filterExtra: SQL | undefined =
      searchClause && noProductHandleClause
        ? and(searchClause, noProductHandleClause)
        : (searchClause ?? noProductHandleClause);

    if (data.excludeOwnedListingsForSession) {
      const session = await getAtprotoSessionForRequest(getRequest());
      const did = session?.did?.trim();
      if (did) {
        const notAlreadyProductAccount = or(
          isNull(table.productAccountDid),
          ne(table.productAccountDid, did),
        );
        const notPublishedInClaimantRepo = or(
          isNull(table.repoDid),
          ne(table.repoDid, did),
        );
        const excludeOwned = and(
          notAlreadyProductAccount,
          notPublishedInClaimantRepo,
        );
        filterExtra = filterExtra
          ? and(filterExtra, excludeOwned)
          : excludeOwned;
      }
    }

    const rows = await context.db
      .select(listingSelect)
      .from(table)
      .where(listingPublicWhere(table, filterExtra))
      .orderBy(...orderByPopularListingSort(table))
      .limit(data.limit);

    return rows.map((row) => toListingCard(row));
  });

function getListDirectoryListingsQueryOptions(
  input: z.input<typeof listDirectoryListingsInput> = {},
) {
  const normalizedInput = listDirectoryListingsInput.parse(input);

  return queryOptions({
    queryKey: ["storeListings", "list", normalizedInput],
    queryFn: async () => listDirectoryListings({ data: normalizedInput }),
  });
}

const getDirectoryListingCategoryAssignments = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly();

    const table = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        categorySlugs: table.categorySlugs,
        scope: sql<string | null>`null::text`.as("scope"),
        productType: sql<string | null>`null::text`.as("productType"),
        domain: sql<string | null>`null::text`.as("domain"),
        updatedAt: table.updatedAt,
      })
      .from(table)
      .orderBy(...orderByPopularListingSort(table));

    return rows
      .map((row) => {
        const slugs = row.categorySlugs ?? [];
        const primary = primaryCategorySlug(slugs);
        const assignedCategory = getDirectoryCategoryOption(primary);
        const legacyCategoryHint = [
          row.scope ? formatMetadataLabel(row.scope) : null,
          row.productType ? formatMetadataLabel(row.productType) : null,
          row.domain ? formatMetadataLabel(row.domain) : null,
        ]
          .filter(Boolean)
          .join(" / ");

        return {
          id: row.id,
          name: row.name,
          iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
          tagline:
            sanitizeListingTagline(row.tagline) ||
            sanitizeListingTagline(row.fullDescription) ||
            "No tagline yet.",
          description:
            sanitizeListingDescription(row.fullDescription) ||
            sanitizeListingTagline(row.tagline) ||
            "No description yet.",
          externalUrl: row.externalUrl,
          categorySlugs: slugs,
          categorySlug: primary,
          categoryPathLabel: assignedCategory?.pathLabel || null,
          legacyCategoryHint: legacyCategoryHint || "Unclassified",
        } satisfies DirectoryListingCategoryAssignment;
      })
      .toSorted((left, right) => {
        if (left.categorySlug === null && right.categorySlug !== null) {
          return -1;
        }

        if (left.categorySlug !== null && right.categorySlug === null) {
          return 1;
        }

        return left.name.localeCompare(right.name);
      });
  });

const getDirectoryListingCategoryAssignmentsQueryOptions = queryOptions({
  queryKey: ["storeListings", "categoryAssignments"],
  queryFn: async () => getDirectoryListingCategoryAssignments(),
});

const getDirectoryListingAppTagAssignments = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly();

    const table = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        appTags: table.appTags,
        categorySlugs: table.categorySlugs,
        scope: sql<string | null>`null::text`.as("scope"),
        productType: sql<string | null>`null::text`.as("productType"),
        domain: sql<string | null>`null::text`.as("domain"),
        vertical: sql<string | null>`null::text`.as("vertical"),
        rawCategoryHint: sql<string | null>`null::text`.as("rawCategoryHint"),
      })
      .from(table)
      .orderBy(...orderByPopularListingSort(table));

    const popular = popularTagsFromAllAssignments(
      rows.map((row) => row.appTags ?? []),
      80,
    );

    const assignments: Array<DirectoryListingAppTagAssignment> = rows.map(
      (row) => {
        const assigned = normalizeAppTags(row.appTags ?? []);
        const slugs = row.categorySlugs ?? [];
        const primary = primaryCategorySlug(slugs);
        const metadataSuggestions = suggestAppTagsFromListing({
          scope: row.scope,
          productType: row.productType,
          domain: row.domain,
          vertical: row.vertical,
          rawCategoryHint: row.rawCategoryHint,
          categorySlug: primary,
        });

        return {
          id: row.id,
          name: row.name,
          iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
          tagline:
            sanitizeListingTagline(row.tagline) ||
            sanitizeListingTagline(row.fullDescription) ||
            "No tagline yet.",
          description:
            sanitizeListingDescription(row.fullDescription) ||
            sanitizeListingTagline(row.tagline) ||
            "No description yet.",
          externalUrl: row.externalUrl,
          appTags: assigned,
          suggestedTags: suggestedTagsForListing(
            assigned,
            metadataSuggestions,
            popular,
            24,
          ),
          categorySlugs: slugs,
          categorySlug: primary,
          scope: row.scope,
          productType: row.productType,
          domain: row.domain,
          vertical: row.vertical,
          rawCategoryHint: row.rawCategoryHint,
        } satisfies DirectoryListingAppTagAssignment;
      },
    );

    return assignments
      .toSorted((left, right) => {
        if (left.appTags.length === 0 && right.appTags.length > 0) {
          return -1;
        }

        if (left.appTags.length > 0 && right.appTags.length === 0) {
          return 1;
        }

        return left.name.localeCompare(right.name);
      })
      .filter((listing) =>
        listing.categorySlugs.some(
          (cs) => cs.split("/").length === 2 && !cs.startsWith("protocol/"),
        ),
      );
  });

const getDirectoryListingAppTagAssignmentsQueryOptions = queryOptions({
  queryKey: ["storeListings", "appTagAssignments"],
  queryFn: async () => getDirectoryListingAppTagAssignments(),
});

const updateDirectoryListingAppTags = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(updateDirectoryListingAppTagsInput)
  .handler(async ({ data, context }) => {
    const nextTags = normalizeAppTags(data.appTags);
    const full = await getFullDirectoryListing(context, data.id);
    const cs = primaryCategorySlug(full.categorySlugs);
    if (!cs || cs.startsWith("protocol/") || cs.split("/").length !== 2) {
      throw new Error(
        "App tags can only be edited for listings in an allowed Apps sub-branch, not Protocol.",
      );
    }

    await publishDirectoryListingDetail(full, { appTags: nextTags });

    return {
      id: data.id,
      appTags: nextTags,
    };
  });

const updateDirectoryListingCategoryAssignment = createServerFn({
  method: "POST",
})
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(updateDirectoryListingCategoryAssignmentInput)
  .handler(async ({ data, context }) => {
    const nextCategorySlug = data.categorySlug?.trim() || null;
    const full = await getFullDirectoryListing(context, data.id);
    const effective = nextCategorySlug ?? "misc";

    await publishDirectoryListingDetail(full, { categorySlugs: [effective] });

    return {
      id: data.id,
      categorySlug: nextCategorySlug,
    };
  });

const deleteDirectoryListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(deleteDirectoryListingInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();

    const full = await getFullDirectoryListing(context, data.id);
    if (!full.rkey) {
      throw new Error(
        "Listing has no ATProto record (missing rkey). Nothing to delete on the PDS.",
      );
    }

    const { client, repoDid } = await createAtstorePublishClient();
    await deleteRecord(client, repoDid, COLLECTION.listingDetail, full.rkey);

    return {
      id: data.id,
    };
  });

const removeStoreManagedListingHeroInput = z.object({
  id: z.string().min(1),
});

/**
 * Clear the hero image for an AtStore-managed listing: republish without a `heroImage` blob
 * (see `clearHero` in `buildListingDetailRecordWithBlobs`), then null `hero_image_url` in Postgres
 * so the site updates immediately.
 *
 * DB-only clears are not enough: Tap ingest mirrors the chain record and would restore `heroImageUrl`
 * from the blob on the next event.
 */
const removeStoreManagedListingHero = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(removeStoreManagedListingHeroInput)
  .handler(async ({ data, context }) => {
    const full = await getFullDirectoryListing(context, data.id);
    const atstoreRepoDid = await getAtstoreRepoDid();
    if (full.repoDid?.trim() !== atstoreRepoDid) {
      throw new Error(
        "Only AtStore-managed listings can have their hero image removed by an admin.",
      );
    }

    await publishDirectoryListingDetail(full, undefined, { clearHero: true });

    const t = context.schema.storeListings;
    await context.db
      .update(t)
      .set({ heroImageUrl: null, updatedAt: new Date() })
      .where(eq(t.id, data.id));

    return { id: data.id };
  });

const deleteStoreManagedListingInput = z.object({
  id: z.string().min(1),
});

/**
 * Admin: permanently delete an AtStore-managed directory listing.
 *
 * Tombstones the lexicon record on the store PDS and removes the mirror row from `storeListings`
 * so the directory updates immediately. Tap ingest will eventually see the tombstone too;
 * `markListingRemovedFromTap` is idempotent on a missing row so the double-delete is safe.
 */
const deleteStoreManagedListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(deleteStoreManagedListingInput)
  .handler(async ({ data, context }) => {
    const full = await getFullDirectoryListing(context, data.id);
    const atstoreRepoDid = await getAtstoreRepoDid();
    if (full.repoDid?.trim() !== atstoreRepoDid) {
      throw new Error(
        "Only AtStore-managed listings can be deleted from this admin page.",
      );
    }
    if (!full.rkey) {
      throw new Error(
        "Listing has no ATProto record (missing rkey). Nothing to delete on the PDS.",
      );
    }

    const { client, repoDid } = await createAtstorePublishClient();
    await deleteRecord(client, repoDid, COLLECTION.listingDetail, full.rkey);

    const t = context.schema.storeListings;
    await context.db.delete(t).where(eq(t.id, data.id));

    return { id: data.id };
  });

const deleteOwnedProductListingInput = z.object({
  listingId: z.string().uuid(),
});

/** Delete a listing hosted on the signed-in user's PDS and remove the Postgres mirror row. */
const deleteOwnedProductListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(deleteOwnedProductListingInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to delete your listing.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);

    if (full.repoDid?.trim() !== session.did) {
      throw new Error(
        "Only the account that hosts the listing record can delete it.",
      );
    }

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }

    if (!full.rkey?.trim()) {
      throw new Error(
        "Listing has no AT Proto record (missing rkey). Nothing to delete.",
      );
    }

    await deleteRecord(
      session.client,
      session.did,
      COLLECTION.listingDetail,
      full.rkey.trim(),
    );

    const t = context.schema.storeListings;
    await context.db.delete(t).where(eq(t.id, data.listingId));

    return { ok: true as const };
  });

const regenerateDirectoryListingTagline = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    const listing = await getDirectoryListingGenerationCandidate(
      context,
      data.id,
    );
    const nextTagline = await generateListingTextField({
      field: "tagline",
      listing,
    });
    const full = await getFullDirectoryListing(context, data.id);

    await publishDirectoryListingDetail(full, { tagline: nextTagline.value });

    return {
      id: data.id,
      tagline: nextTagline.value,
      source: nextTagline.source,
    };
  });

const regenerateDirectoryListingDescription = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    const listing = await getDirectoryListingGenerationCandidate(
      context,
      data.id,
    );
    const nextDescription = await generateListingTextField({
      field: "description",
      listing,
    });
    const full = await getFullDirectoryListing(context, data.id);

    await publishDirectoryListingDetail(full, {
      fullDescription: nextDescription.value,
    });

    return {
      id: data.id,
      description: nextDescription.value,
      source: nextDescription.source,
    };
  });

const confirmProductAccountCandidateInput = z.object({
  candidateId: z.string().uuid(),
});

const rejectProductAccountCandidateInput = z.object({
  candidateId: z.string().uuid(),
});

export type ProductAccountCandidateQueueItem = {
  candidateId: string;
  storeListingId: string;
  candidateDid: string;
  candidateHandle: string | null;
  source: string;
  createdAt: string;
  listingName: string;
  listingSlug: string;
  iconUrl: string | null;
  externalUrl: string | null;
  sourceUrl: string;
};

const getNextProductAccountCandidate = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly();

    const c = context.schema.storeListingProductAccountCandidates;
    const l = context.schema.storeListings;
    const [row] = await context.db
      .select({
        candidateId: c.id,
        storeListingId: c.storeListingId,
        candidateDid: c.candidateDid,
        candidateHandle: c.candidateHandle,
        source: c.source,
        createdAt: c.createdAt,
        listingName: l.name,
        listingSlug: l.slug,
        iconUrl: l.iconUrl,
        externalUrl: l.externalUrl,
        sourceUrl: l.sourceUrl,
      })
      .from(c)
      .innerJoin(l, eq(c.storeListingId, l.id))
      .where(eq(c.status, "pending"))
      .orderBy(asc(c.createdAt))
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      createdAt: row.createdAt.toISOString(),
    } satisfies ProductAccountCandidateQueueItem;
  });

const getNextProductAccountCandidateQueryOptions = queryOptions({
  queryKey: ["storeListings", "dev", "nextProductAccountCandidate"],
  queryFn: async () => getNextProductAccountCandidate(),
});

const getPendingProductAccountCandidates = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly();

    const c = context.schema.storeListingProductAccountCandidates;
    const l = context.schema.storeListings;
    const rows = await context.db
      .select({
        candidateId: c.id,
        storeListingId: c.storeListingId,
        candidateDid: c.candidateDid,
        candidateHandle: c.candidateHandle,
        source: c.source,
        createdAt: c.createdAt,
        listingName: l.name,
        listingSlug: l.slug,
        iconUrl: l.iconUrl,
        externalUrl: l.externalUrl,
        sourceUrl: l.sourceUrl,
      })
      .from(c)
      .innerJoin(l, eq(c.storeListingId, l.id))
      .where(eq(c.status, "pending"))
      .orderBy(asc(c.createdAt));

    return rows.map((row) => ({
      ...row,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      createdAt: row.createdAt.toISOString(),
    })) satisfies Array<ProductAccountCandidateQueueItem>;
  });

const getPendingProductAccountCandidatesQueryOptions = queryOptions({
  queryKey: ["storeListings", "dev", "pendingProductAccountCandidates"],
  queryFn: async () => getPendingProductAccountCandidates(),
});

/** Listings with no usable Bluesky handle in DB (shows as @unknown on /apps/tags). */
export type ListingMissingProductAccountHandleItem = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  externalUrl: string | null;
  productAccountDid: string | null;
  productAccountHandleIgnoredAt: string | null;
};

const getListingsMissingProductAccountHandleInput = z.object({
  includeIgnored: z.boolean().optional().default(false),
});

const getListingsMissingProductAccountHandle = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getListingsMissingProductAccountHandleInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();
    const t = context.schema.storeListings;
    const conditions = [
      sql`coalesce(trim(${t.productAccountHandle}), '') = ''`,
    ];
    if (!data.includeIgnored) {
      conditions.push(sql`${t.productAccountHandleIgnoredAt} is null`);
    }
    const rows = await context.db
      .select({
        id: t.id,
        slug: t.slug,
        name: t.name,
        iconUrl: t.iconUrl,
        externalUrl: t.externalUrl,
        productAccountDid: t.productAccountDid,
        productAccountHandleIgnoredAt: t.productAccountHandleIgnoredAt,
      })
      .from(t)
      .where(and(...conditions))
      .orderBy(asc(t.name));

    return rows.map((row) => ({
      ...row,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      productAccountHandleIgnoredAt:
        row.productAccountHandleIgnoredAt?.toISOString() ?? null,
    })) satisfies Array<ListingMissingProductAccountHandleItem>;
  });

function getListingsMissingProductAccountHandleQueryOptions(
  input: z.input<typeof getListingsMissingProductAccountHandleInput> = {},
) {
  const normalizedInput =
    getListingsMissingProductAccountHandleInput.parse(input);
  return queryOptions({
    queryKey: [
      "storeListings",
      "dev",
      "listingsMissingProductAccountHandle",
      normalizedInput,
    ],
    queryFn: async () =>
      getListingsMissingProductAccountHandle({ data: normalizedInput }),
  });
}

function normalizeManualProductAccountHandle(raw: string): string {
  const s = raw.trim().replace(/^@+/, "");
  if (!s) {
    throw new Error("Handle is required.");
  }
  if (/\s/.test(s)) {
    throw new Error("Handle cannot contain whitespace.");
  }
  return s;
}

function normalizeManualProductAccountDid(raw: string): string {
  const s = raw.trim();
  if (!s) {
    throw new Error("DID is required.");
  }
  if (/\s/.test(s)) {
    throw new Error("DID cannot contain whitespace.");
  }
  if (!s.startsWith("did:")) {
    throw new Error('DID must start with "did:".');
  }
  return s;
}

const setProductAccountHandleDevInput = z
  .object({
    listingId: z.string().uuid(),
    handle: z.string().min(1).max(300).optional(),
    did: z.string().min(1).max(300).optional(),
  })
  .refine((value) => value.handle?.trim() || value.did?.trim(), {
    message: "Either handle or DID is required.",
  });

const setProductAccountHandleDev = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(setProductAccountHandleDevInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();
    const t = context.schema.storeListings;

    const [found] = await context.db
      .select({ id: t.id })
      .from(t)
      .where(eq(t.id, data.listingId))
      .limit(1);

    if (!found) {
      throw new Error("Listing not found.");
    }

    const updates: {
      productAccountHandle?: string;
      productAccountDid?: string;
    } = {};
    const normalizedHandle = data.handle?.trim()
      ? normalizeManualProductAccountHandle(data.handle)
      : null;
    if (normalizedHandle) {
      updates.productAccountHandle = normalizedHandle;
    }
    if (data.did?.trim()) {
      updates.productAccountDid = normalizeManualProductAccountDid(data.did);
    } else if (normalizedHandle) {
      const resolvedDid = await resolveBlueskyHandleToDid(normalizedHandle);
      if (!resolvedDid) {
        throw new Error("Could not resolve that handle to a DID.");
      }
      updates.productAccountDid = resolvedDid;
    }
    if (!updates.productAccountHandle && !updates.productAccountDid) {
      throw new Error("Either handle or DID is required.");
    }

    const now = new Date();
    await context.db
      .update(t)
      .set({
        ...updates,
        productAccountHandleIgnoredAt: null,
        updatedAt: now,
      })
      .where(eq(t.id, data.listingId));

    return { ok: true as const };
  });

const ignoreMissingProductAccountHandleDevInput = z.object({
  listingId: z.string().uuid(),
});

const ignoreMissingProductAccountHandleDev = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(ignoreMissingProductAccountHandleDevInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();
    const t = context.schema.storeListings;

    const [found] = await context.db
      .select({ id: t.id })
      .from(t)
      .where(eq(t.id, data.listingId))
      .limit(1);

    if (!found) {
      throw new Error("Listing not found.");
    }

    const now = new Date();
    await context.db
      .update(t)
      .set({
        productAccountHandleIgnoredAt: now,
        updatedAt: now,
      })
      .where(eq(t.id, data.listingId));

    return { ok: true as const };
  });

const unignoreMissingProductAccountHandleDevInput = z.object({
  listingId: z.string().uuid(),
});

const unignoreMissingProductAccountHandleDev = createServerFn({
  method: "POST",
})
  .middleware([dbMiddleware])
  .inputValidator(unignoreMissingProductAccountHandleDevInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();
    const t = context.schema.storeListings;

    const [found] = await context.db
      .select({ id: t.id })
      .from(t)
      .where(eq(t.id, data.listingId))
      .limit(1);

    if (!found) {
      throw new Error("Listing not found.");
    }

    const now = new Date();
    await context.db
      .update(t)
      .set({
        productAccountHandleIgnoredAt: null,
        updatedAt: now,
      })
      .where(eq(t.id, data.listingId));

    return { ok: true as const };
  });

async function runConfirmProductAccountCandidate(
  context: { db: Database; schema: typeof dbSchema },
  candidateId: string,
) {
  const c = context.schema.storeListingProductAccountCandidates;
  const t = context.schema.storeListings;
  const [candidate] = await context.db
    .select()
    .from(c)
    .where(eq(c.id, candidateId))
    .limit(1);

  if (!candidate || candidate.status !== "pending") {
    throw new Error("Candidate not found or not pending.");
  }

  const full = await getFullDirectoryListing(context, candidate.storeListingId);
  const did = candidate.candidateDid.trim();
  if (!did.startsWith("did:")) {
    throw new Error("Invalid candidate DID.");
  }

  await publishDirectoryListingDetail(full, { productAccountDid: did });

  const profile = await fetchBlueskyPublicProfileFields(did);
  const handle =
    profile?.handle?.trim() && profile.handle.length > 0
      ? profile.handle.trim()
      : null;
  const now = new Date();

  await context.db
    .update(t)
    .set({
      productAccountDid: did,
      productAccountHandle: handle,
      updatedAt: now,
    })
    .where(eq(t.id, candidate.storeListingId));

  await context.db
    .update(c)
    .set({ status: "verified", resolvedAt: now, updatedAt: now })
    .where(eq(c.id, candidate.id));

  await context.db
    .update(c)
    .set({ status: "superseded", updatedAt: now })
    .where(
      and(
        eq(c.storeListingId, candidate.storeListingId),
        eq(c.status, "pending"),
        ne(c.id, candidate.id),
      ),
    );
}

const confirmProductAccountCandidate = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(confirmProductAccountCandidateInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();
    await runConfirmProductAccountCandidate(context, data.candidateId);
    return { ok: true as const };
  });

const applyProductAccountCandidatesBatchInput = z.object({
  /** Checked rows: one winning candidate per listing (last in list order wins duplicates). */
  confirmCandidateIds: z.array(z.string().uuid()),
});

const applyProductAccountCandidatesBatch = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(applyProductAccountCandidatesBatchInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();

    const c = context.schema.storeListingProductAccountCandidates;
    const l = context.schema.storeListings;

    const rows = await context.db
      .select({
        candidateId: c.id,
        storeListingId: c.storeListingId,
      })
      .from(c)
      .innerJoin(l, eq(c.storeListingId, l.id))
      .where(eq(c.status, "pending"))
      .orderBy(asc(c.createdAt));

    const confirmSet = new Set(data.confirmCandidateIds);
    const winningByListing = new Map<string, string>();
    for (const row of rows) {
      if (confirmSet.has(row.candidateId)) {
        winningByListing.set(row.storeListingId, row.candidateId);
      }
    }
    const toConfirm = [...winningByListing.values()];

    let confirmed = 0;
    for (const candidateId of toConfirm) {
      try {
        await runConfirmProductAccountCandidate(context, candidateId);
        confirmed += 1;
      } catch (error) {
        console.warn(
          `[applyProductAccountCandidatesBatch] skip confirm ${candidateId}:`,
          error,
        );
      }
    }

    const now = new Date();
    const stillPending = await context.db
      .select({ id: c.id })
      .from(c)
      .where(eq(c.status, "pending"));

    let rejected = 0;
    for (const { id } of stillPending) {
      if (toConfirm.includes(id)) continue;
      const result = await context.db
        .update(c)
        .set({ status: "rejected", resolvedAt: now, updatedAt: now })
        .where(and(eq(c.id, id), eq(c.status, "pending")))
        .returning({ id: c.id });
      if (result.length > 0) rejected += 1;
    }

    return { ok: true as const, confirmed, rejected };
  });

const rejectProductAccountCandidate = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(rejectProductAccountCandidateInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly();

    const c = context.schema.storeListingProductAccountCandidates;
    const now = new Date();
    const result = await context.db
      .update(c)
      .set({ status: "rejected", resolvedAt: now, updatedAt: now })
      .where(and(eq(c.id, data.candidateId), eq(c.status, "pending")))
      .returning({ id: c.id });

    if (result.length === 0) {
      throw new Error("Candidate not found.");
    }

    return { ok: true as const };
  });

const claimProductListingToPdsInput = z.object({
  listingId: z.string().uuid(),
});

const getProfileOwnedProductListingsInput = z.object({
  did: z.string().trim().min(1).max(2048),
});

const getProductClaimEligibility = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return { eligible: false as const, listings: [] };
    }
    const listings = await findEligibleProductClaimsForDid(
      context.db,
      session.did,
    );
    return {
      eligible: listings.length > 0,
      listings,
    };
  });

function getProductClaimEligibilityQueryOptions() {
  return queryOptions({
    queryKey: ["storeListings", "productClaimEligibility"] as const,
    queryFn: async () => getProductClaimEligibility(),
  });
}

const submitProductListingClaimInput = z.object({
  listingId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(
      20,
      "Please add more detail so we can verify your request (at least 20 characters).",
    )
    .max(8000),
});

const submitProductListingClaim = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(submitProductListingClaimInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to request a listing claim.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);
    if (full.verificationStatus !== "verified") {
      throw new Error("Only verified listings can be claimed.");
    }
    if (isBrowseableProtocolRow({ categorySlugs: full.categorySlugs ?? [] })) {
      throw new Error("Protocol listings cannot be claimed through this flow.");
    }

    const atstoreDid = await getAtstoreRepoDid();
    if (full.repoDid?.trim() !== atstoreDid) {
      throw new Error(
        "This listing is not on the store account anymore, so it cannot be claimed here.",
      );
    }
    if (!full.atUri?.trim() || !full.rkey?.trim()) {
      throw new Error("This listing is missing ATProto coordinates.");
    }

    if (full.productAccountDid?.trim() === session.did) {
      throw new Error(
        "This listing is already associated with your account. Use the claim option above.",
      );
    }

    if (full.productAccountHandle?.trim()) {
      throw new Error(
        "This listing already has a Bluesky product account. Log in with that handle and use the claim option above.",
      );
    }

    const claimTable = context.schema.listingClaims;
    const [existingPending] = await context.db
      .select({ id: claimTable.id })
      .from(claimTable)
      .where(
        and(
          eq(claimTable.storeListingId, data.listingId),
          eq(claimTable.claimantDid, session.did),
          eq(claimTable.status, "pending"),
        ),
      )
      .limit(1);

    if (existingPending) {
      throw new Error("You already have a pending claim for this listing.");
    }

    const claimantHandle = await fetchBlueskyHandleForDid(session.did);

    await context.db.insert(claimTable).values({
      storeListingId: data.listingId,
      claimantDid: session.did,
      message: data.message,
      claimantHandle: claimantHandle ?? null,
      status: "pending",
      updatedAt: new Date(),
    });

    return { ok: true as const };
  });

const getUserProductListingClaimRequests = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return [];
    }

    const c = context.schema.listingClaims;
    const l = context.schema.storeListings;

    const rows = await context.db
      .select({
        id: c.id,
        storeListingId: c.storeListingId,
        listingName: l.name,
        listingSlug: l.slug,
        listingIconUrl: l.iconUrl,
        status: c.status,
        message: c.message,
        createdAt: c.createdAt,
        decidedAt: c.decidedAt,
      })
      .from(c)
      .innerJoin(l, eq(c.storeListingId, l.id))
      .where(eq(c.claimantDid, session.did))
      .orderBy(desc(c.createdAt));

    return rows.map((row) => ({
      ...row,
      listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
    }));
  });

function getUserProductListingClaimRequestsQueryOptions() {
  return queryOptions({
    queryKey: ["storeListings", "userProductListingClaims"] as const,
    queryFn: async () => getUserProductListingClaimRequests(),
  });
}

const listingExternalUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

/**
 * App tags only apply to top-level app listings (`apps/<slug>`). App-tool
 * sub-branches and protocol listings must not carry tags — mirrors the invariant
 * enforced by `updateDirectoryListingAppTags`.
 */
function isEditableAppCategorySlug(categorySlug: string): boolean {
  const parts = categorySlug.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "apps";
}

function normalizeEditableListingCategorySlug(value: string): string {
  const raw = value.trim().replace(/^app\//i, "apps/");
  const option = getDirectoryCategoryOption(raw);
  const ids = option?.pathIds ?? [];

  const isProtocolLeaf = ids[0] === "protocol" && ids.length === 2;
  const isAppLeaf = ids[0] === "apps" && (ids.length === 2 || ids.length === 3);
  if (!isProtocolLeaf && !isAppLeaf) {
    throw new Error(
      "Category must be `protocol/<category>`, `apps/<app>`, or `apps/<app>/<category>`.",
    );
  }

  return ids.join("/");
}

const listingLinkInputSchema = z.object({
  type: z.string().trim().min(1).max(128),
  url: z.string().trim().min(1).max(LISTING_LINK_URL_MAX_LENGTH),
  label: z
    .string()
    .trim()
    .max(LISTING_LINK_LABEL_MAX_LENGTH)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
});

const updateOwnedProductListingInput = z.object({
  listingId: z.string().uuid(),
  name: z.string().trim().min(1).max(640),
  tagline: z.string().max(2000),
  fullDescription: z.string().max(20_000),
  externalUrl: listingExternalUrlSchema,
  categorySlug: z.string().trim().min(1).max(256),
  productHandle: z.string().max(300),
  links: z
    .array(listingLinkInputSchema)
    .max(LISTING_LINK_MAX_COUNT)
    .optional()
    .default([]),
  appTags: z.array(z.string()).max(64).optional().default([]),
});

const createOwnedProductListingInput = z.object({
  name: z.string().trim().min(1).max(640),
  tagline: z.string().max(2000),
  fullDescription: z.string().max(20_000),
  externalUrl: listingExternalUrlSchema,
  categorySlug: z.string().trim().min(1).max(256),
  productHandle: z.string().max(300),
  heroImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  iconImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  screenshotImages: z
    .array(
      z.object({
        mimeType: z.string().min(3).max(128),
        imageBase64: z.string().min(1),
      }),
    )
    .min(1)
    .max(4)
    .optional(),
  links: z
    .array(listingLinkInputSchema)
    .max(LISTING_LINK_MAX_COUNT)
    .optional()
    .default([]),
  appTags: z.array(z.string()).max(64).optional().default([]),
});

const getProductListingEditAccessInput = z.object({
  listingId: z.string().uuid(),
});

/**
 * Stable, human-readable URL slug (same rules as curated listings via
 * {@link buildDirectoryListingSlug}). If that base is taken by another row,
 * allocates `slug-2`, `slug-3`, … rather than `--hex` prefixes from the old draft flow.
 */
async function allocateUniqueStoreListingSlug(
  db: Database,
  name: string,
  sourceUrl: string,
): Promise<string> {
  const base = buildDirectoryListingSlug({ name, sourceUrl });
  const t = dbSchema.storeListings;
  let candidate = base;
  let suffix = 2;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const [row] = await db
      .select({ id: t.id })
      .from(t)
      .where(eq(t.slug, candidate))
      .limit(1);
    if (!row) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  throw new Error("Could not allocate a unique listing slug.");
}

const getProductListingEditAccess = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getProductListingEditAccessInput)
  .handler(async ({ data, context }) => {
    const full = await getFullDirectoryListing(context, data.listingId);

    if (!full.rkey?.trim() || !full.atUri?.trim()) {
      return {
        canEdit: false as const,
        needsClaim: false as const,
        isStoreManaged: false as const,
      };
    }

    const atstoreDid = await getAtstoreRepoDid();
    const repo = full.repoDid?.trim();
    const productDid = full.productAccountDid?.trim();
    /**
     * Once a listing has been migrated via `claimProductListingToPds`,
     * `migratedFromAtUri` is non-null even when the claimant *is* at-store
     * itself (so `repo === atstoreDid` would otherwise misreport the listing
     * as still store-managed and trigger a redundant claim CTA).
     */
    const isStoreManaged =
      repo === atstoreDid && !full.migratedFromAtUri?.trim();

    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return {
        canEdit: false as const,
        needsClaim: false as const,
        isStoreManaged,
      };
    }

    const needsClaim = Boolean(productDid === session.did && isStoreManaged);

    const canEdit = Boolean(repo === session.did && productDid === session.did);

    return { canEdit, needsClaim, isStoreManaged };
  });

function getProductListingEditAccessQueryOptions(listingId: string) {
  return queryOptions({
    queryKey: ["storeListings", "productListingEditAccess", listingId] as const,
    queryFn: async () => getProductListingEditAccess({ data: { listingId } }),
  });
}

const updateOwnedProductListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(updateOwnedProductListingInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to edit your listing.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);

    if (full.repoDid?.trim() !== session.did) {
      throw new Error(
        "Only the account that hosts the listing record can edit it. Claim the listing first if it is still on the store publisher.",
      );
    }

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }

    const name = data.name.trim().slice(0, 640);
    const taglineClean = sanitizeListingTagline(data.tagline);
    const descClean = sanitizeListingDescription(data.fullDescription);
    const externalUrl = data.externalUrl.trim();
    const categorySlug = normalizeEditableListingCategorySlug(
      data.categorySlug,
    );
    const productHandleInput = data.productHandle.trim();

    let productAccountHandle: string | null = null;
    if (productHandleInput.length > 0) {
      productAccountHandle =
        normalizeManualProductAccountHandle(productHandleInput);
      const resolvedDid = await resolveBlueskyHandleToDid(productAccountHandle);
      if (!resolvedDid) {
        throw new Error("Could not resolve that handle to a DID.");
      }
      if (resolvedDid !== session.did) {
        throw new Error(
          "That handle does not belong to your signed-in account.",
        );
      }
    }

    const links = normalizeListingLinks(data.links as Array<ListingLink>);

    /**
     * Only `apps/<slug>` listings surface app tags; clear them otherwise so we don't
     * carry stale editorial tags across a category change (mirrors the invariant
     * enforced by `updateDirectoryListingAppTags`).
     */
    const appTags = isEditableAppCategorySlug(categorySlug)
      ? normalizeAppTags(data.appTags ?? [])
      : [];

    const patch: Partial<StoreListing> = {
      name,
      tagline: taglineClean,
      fullDescription: descClean,
      externalUrl,
      categorySlugs: [categorySlug],
      productAccountDid: session.did,
      links,
      appTags,
    };

    const { uri } = await publishOwnedListingDetail(
      session.client,
      session.did,
      full,
      patch,
    );

    const now = new Date();
    const t = context.schema.storeListings;
    /**
     * An owner edit on a previously-rejected listing is a resubmission: flip the row
     * back to `unverified` so (a) the owner stops seeing a stuck "Rejected" badge on
     * `/products/manage` after they've revised, and (b) admins re-review it via the
     * normal queue. Rejection history is preserved in `store_listing_rejection_events`
     * and surfaced by the admin "Resubmitted after rejection" section
     * (see `getAdminDashboard`). Tap re-ingest of the edited record will then read
     * `unverified` and not re-pin to `rejected` (see `resolveListingVerificationStatus`).
     */
    const verificationStatusPatch =
      full.verificationStatus === "rejected"
        ? { verificationStatus: "unverified" as const }
        : {};

    await context.db
      .update(t)
      .set({
        name,
        tagline: taglineClean,
        fullDescription: descClean,
        externalUrl,
        categorySlugs: [categorySlug],
        productAccountDid: session.did,
        productAccountHandle,
        atUri: uri,
        links,
        appTags,
        ...verificationStatusPatch,
        updatedAt: now,
      })
      .where(eq(t.id, full.id));

    return { slug: full.slug };
  });

const createOwnedProductListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(createOwnedProductListingInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to create a listing.");
    }

    const name = data.name.trim().slice(0, 640);
    const taglineClean = sanitizeListingTagline(data.tagline);
    const descClean = sanitizeListingDescription(data.fullDescription);
    const externalUrl = data.externalUrl.trim();
    const categorySlug = normalizeEditableListingCategorySlug(
      data.categorySlug,
    );

    /**
     * `store_listings` has a unique index on `source_url`, so a second listing
     * for the same product URL gets silently dropped by tap ingest (see
     * `tap-listing-sync.ts:isSourceUrlUniqueViolation`). Detect that here and
     * throw a friendly error pointing the owner at the edit flow — otherwise
     * the PDS write succeeds, the directory row never appears, and the
     * submission "goes into the void". This matters most when the existing row
     * is the owner's own previously-rejected listing: edit-and-resubmit is the
     * supported recovery path (see `updateOwnedProductListing`).
     */
    const conflictTable = context.schema.storeListings;
    const [conflictingListing] = await context.db
      .select({
        id: conflictTable.id,
        slug: conflictTable.slug,
        repoDid: conflictTable.repoDid,
        verificationStatus: conflictTable.verificationStatus,
      })
      .from(conflictTable)
      .where(eq(conflictTable.sourceUrl, externalUrl))
      .limit(1);
    if (conflictingListing) {
      if (conflictingListing.repoDid?.trim() === session.did) {
        throw new Error(
          "You already have a listing for this URL. Open it from \u201CManage listings\u201D and edit it to resubmit.",
        );
      }
      throw new Error(
        "Another listing already covers this URL. Reach out to support if you think this is a mistake.",
      );
    }

    const slug = await allocateUniqueStoreListingSlug(
      context.db,
      name,
      externalUrl,
    );
    const productHandleInput = data.productHandle.trim();

    let productAccountHandle: string | null = null;
    if (productHandleInput.length > 0) {
      productAccountHandle =
        normalizeManualProductAccountHandle(productHandleInput);
      const resolvedDid = await resolveBlueskyHandleToDid(productAccountHandle);
      if (!resolvedDid) {
        throw new Error("Could not resolve that handle to a DID.");
      }
      if (resolvedDid !== session.did) {
        throw new Error(
          "That handle does not belong to your signed-in account.",
        );
      }
    }

    const now = new Date();
    const links = normalizeListingLinks(data.links as Array<ListingLink>);
    /**
     * Only `apps/<slug>` listings carry app tags in the lexicon; other category kinds
     * drop them so we don't pin editorial tags onto protocol/app-tool records (mirrors
     * the invariant in `updateOwnedProductListing`).
     */
    const appTags = isEditableAppCategorySlug(categorySlug)
      ? normalizeAppTags(data.appTags ?? [])
      : [];
    const draftRow: StoreListing = {
      id: crypto.randomUUID(),
      sourceUrl: externalUrl,
      name,
      slug,
      externalUrl,
      iconUrl: null,
      screenshotUrls: [],
      tagline: taglineClean,
      fullDescription: descClean,
      categorySlugs: [categorySlug],
      appTags,
      links,
      atUri: null,
      repoDid: session.did,
      rkey: null,
      heroImageUrl: null,
      verificationStatus: "unverified",
      sourceAccountDid: session.did,
      claimedByDid: null,
      claimedAt: null,
      productAccountDid: session.did,
      productAccountHandle,
      productAccountHandleIgnoredAt: null,
      migratedFromAtUri: null,
      claimPendingForDid: null,
      reviewCount: 0,
      averageRating: null,
      favoriteCount: 0,
      mentionCount24h: 0,
      mentionCount7d: 0,
      trendingScore: null,
      trendingUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let blobOverrides:
      | {
          heroImage?: { bytes: Uint8Array; mimeType: string };
          icon?: { bytes: Uint8Array; mimeType: string };
          screenshots?: Array<{ bytes: Uint8Array; mimeType: string }>;
        }
      | undefined;

    if (
      data.heroImage ||
      data.iconImage ||
      (data.screenshotImages?.length ?? 0) > 0
    ) {
      blobOverrides = {};
      if (data.heroImage) {
        const heroMime = data.heroImage.mimeType.trim().toLowerCase();
        if (!heroMime.startsWith("image/")) {
          throw new Error("Hero image must be an image.");
        }
        const heroRaw = Buffer.from(data.heroImage.imageBase64, "base64");
        if (heroRaw.length === 0 || heroRaw.length > 12_000_000) {
          throw new Error("Hero image must be at most 12 MB.");
        }
        blobOverrides.heroImage = {
          bytes: Uint8Array.from(heroRaw),
          mimeType: heroMime,
        };
      }
      if (data.iconImage) {
        const iconMime = data.iconImage.mimeType.trim().toLowerCase();
        if (!iconMime.startsWith("image/")) {
          throw new Error("Icon image must be an image.");
        }
        const iconRaw = Buffer.from(data.iconImage.imageBase64, "base64");
        if (iconRaw.length === 0) {
          throw new Error("Icon image must be an image.");
        }
        blobOverrides.icon = {
          bytes: Uint8Array.from(iconRaw),
          mimeType: iconMime,
        };
      }
      if (data.screenshotImages && data.screenshotImages.length > 0) {
        blobOverrides.screenshots = data.screenshotImages.map(
          (screenshot, index) => {
            const screenshotMime = screenshot.mimeType.trim().toLowerCase();
            if (!screenshotMime.startsWith("image/")) {
              throw new Error(`Screenshot ${index + 1} must be an image.`);
            }
            const screenshotRaw = Buffer.from(screenshot.imageBase64, "base64");
            if (
              screenshotRaw.length === 0 ||
              screenshotRaw.length > 12_000_000
            ) {
              throw new Error(`Screenshot ${index + 1} must be at most 12 MB.`);
            }
            return {
              bytes: Uint8Array.from(screenshotRaw),
              mimeType: screenshotMime,
            };
          },
        );
      }
    }

    const { record } = await buildListingDetailRecordWithBlobs(
      session.client,
      draftRow,
      blobOverrides,
    );
    const createdAt = now.toISOString();
    record.createdAt = createdAt;
    record.updatedAt = createdAt;

    const { uri } = await createListingDetailRecord(
      session.client,
      session.did,
      record,
    );
    return { uri, slug };
  });

const updateOwnedProductListingImageInput = z.object({
  listingId: z.string().uuid(),
  kind: z.enum(["hero", "icon"]),
  mimeType: z.string().min(3).max(128),
  imageBase64: z.string().min(1),
});

const updateOwnedProductListingScreenshotsInput = z.object({
  listingId: z.string().uuid(),
  retainedExistingScreenshotUrls: z.array(z.string().min(1)).max(4).default([]),
  screenshots: z
    .array(
      z.object({
        mimeType: z.string().min(3).max(128),
        imageBase64: z.string().min(1),
      }),
    )
    .max(4),
});

const updateOwnedProductListingImage = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(updateOwnedProductListingImageInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to update images.");
    }

    const mime = data.mimeType.trim().toLowerCase();
    if (!mime.startsWith("image/")) {
      throw new Error("File must be an image.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);

    if (full.repoDid?.trim() !== session.did) {
      throw new Error(
        "Only the account that hosts the listing record can edit it.",
      );
    }

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }

    let raw: Buffer;
    try {
      raw = Buffer.from(data.imageBase64, "base64");
    } catch {
      throw new Error("Invalid image data.");
    }
    const maxBytes = data.kind === "hero" ? 12_000_000 : 2_000_000;
    if (raw.length === 0) {
      throw new Error(
        data.kind === "hero"
          ? "Hero image must be at most 12 MB."
          : "Icon image must be at most 2 MB.",
      );
    }

    let finalRaw = raw;
    let finalMime = mime;
    if (data.kind === "icon" && raw.length > maxBytes) {
      const { default: sharp } = await import("sharp");
      const scales = [1, 0.9, 0.8, 0.7, 0.6] as const;
      const qualities = [90, 80, 70, 60, 50, 40] as const;
      let bestBuffer: Buffer | null = null;

      for (const scale of scales) {
        let pipeline = sharp(raw, { failOn: "none" }).rotate();
        if (scale < 1) {
          const meta = await pipeline.metadata();
          const width = meta.width ?? 0;
          const height = meta.height ?? 0;
          if (width > 0 && height > 0) {
            pipeline = pipeline.resize({
              width: Math.max(1, Math.floor(width * scale)),
              height: Math.max(1, Math.floor(height * scale)),
              fit: "inside",
              withoutEnlargement: true,
            });
          }
        }

        for (const quality of qualities) {
          const webpBuffer = await pipeline
            .clone()
            .webp({ quality })
            .toBuffer();
          if (!bestBuffer || webpBuffer.length < bestBuffer.length) {
            bestBuffer = webpBuffer;
          }
          if (webpBuffer.length <= maxBytes) {
            finalRaw = webpBuffer;
            finalMime = "image/webp";
            break;
          }

          const jpegBuffer = await pipeline
            .clone()
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
          if (!bestBuffer || jpegBuffer.length < bestBuffer.length) {
            bestBuffer = jpegBuffer;
          }
          if (jpegBuffer.length <= maxBytes) {
            finalRaw = jpegBuffer;
            finalMime = "image/jpeg";
            break;
          }
        }

        if (finalRaw.length <= maxBytes) {
          break;
        }
      }
    }

    if (finalRaw.length > maxBytes) {
      throw new Error(
        data.kind === "hero"
          ? "Hero image must be at most 12 MB."
          : "Icon image must be at most 2 MB.",
      );
    }

    const bytes = Uint8Array.from(finalRaw);
    const blobOverrides =
      data.kind === "hero"
        ? {
            heroImage: {
              bytes,
              mimeType: finalMime,
            },
          }
        : {
            icon: {
              bytes,
              mimeType: finalMime,
            },
          };

    const { uri, dbUrls } = await publishOwnedListingDetail(
      session.client,
      session.did,
      full,
      undefined,
      blobOverrides,
    );

    const now = new Date();
    const t = context.schema.storeListings;

    if (data.kind === "hero") {
      await context.db
        .update(t)
        .set({
          heroImageUrl: dbUrls.heroImageUrl,
          atUri: uri,
          updatedAt: now,
        })
        .where(eq(t.id, full.id));
    } else {
      await context.db
        .update(t)
        .set({
          iconUrl: dbUrls.iconUrl,
          atUri: uri,
          updatedAt: now,
        })
        .where(eq(t.id, full.id));
    }

    return { ok: true as const };
  });

const removeOwnedProductListingHeroImageInput = z.object({
  listingId: z.string().uuid(),
});

/**
 * Owner-side counterpart to `removeStoreManagedListingHero`. Republishes the
 * listing record to the owner's PDS with `clearHero: true` so the lexicon record
 * loses its `heroImage` blob, then clears `heroImageUrl` in Postgres so the
 * directory stops rendering the hero immediately. Tap ingest reconciles back to
 * a record without a hero, so this stays clean across re-syncs.
 */
const removeOwnedProductListingHeroImage = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(removeOwnedProductListingHeroImageInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to update images.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);

    if (full.repoDid?.trim() !== session.did) {
      throw new Error(
        "Only the account that hosts the listing record can edit it.",
      );
    }

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }

    const { uri } = await publishOwnedListingDetail(
      session.client,
      session.did,
      full,
      undefined,
      { clearHero: true },
    );

    const now = new Date();
    const t = context.schema.storeListings;
    await context.db
      .update(t)
      .set({
        heroImageUrl: null,
        atUri: uri,
        updatedAt: now,
      })
      .where(eq(t.id, full.id));

    return { ok: true as const };
  });

const updateOwnedProductListingScreenshots = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(updateOwnedProductListingScreenshotsInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to update images.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);

    if (full.repoDid?.trim() !== session.did) {
      throw new Error(
        "Only the account that hosts the listing record can edit it.",
      );
    }

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }

    const retainedExistingScreenshotUrls = data.retainedExistingScreenshotUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .slice(0, 4);

    const uploadedScreenshots = data.screenshots.map((screenshot, index) => {
      const mimeType = screenshot.mimeType.trim().toLowerCase();
      if (!mimeType.startsWith("image/")) {
        throw new Error(`Screenshot ${index + 1} must be an image.`);
      }
      let raw: Buffer;
      try {
        raw = Buffer.from(screenshot.imageBase64, "base64");
      } catch {
        throw new Error(`Screenshot ${index + 1} has invalid image data.`);
      }
      if (raw.length === 0 || raw.length > 12_000_000) {
        throw new Error(`Screenshot ${index + 1} must be at most 12 MB.`);
      }
      return {
        bytes: Uint8Array.from(raw),
        mimeType,
      };
    });

    const keepExistingScreenshotsAsBlobs =
      retainedExistingScreenshotUrls.length > 0 &&
      uploadedScreenshots.length > 0
        ? await Promise.all(
            retainedExistingScreenshotUrls.map(async (url, index) => {
              const existingIndex = index + 1;
              let resolved;
              try {
                resolved = await resolveUrlToImageBytes(url);
              } catch {
                throw new Error(
                  `Could not keep existing screenshot ${existingIndex}; please re-upload it.`,
                );
              }
              if (
                !resolved.mimeType.startsWith("image/") ||
                resolved.bytes.length === 0 ||
                resolved.bytes.length > 12_000_000
              ) {
                throw new Error(
                  `Existing screenshot ${existingIndex} is invalid; please re-upload it.`,
                );
              }
              return resolved;
            }),
          )
        : [];

    const finalScreenshotOverrides =
      retainedExistingScreenshotUrls.length === 0 &&
      uploadedScreenshots.length === 0
        ? []
        : uploadedScreenshots.length > 0
          ? [...keepExistingScreenshotsAsBlobs, ...uploadedScreenshots].slice(
              0,
              4,
            )
          : undefined;

    const { uri, dbUrls } = await publishOwnedListingDetail(
      session.client,
      session.did,
      full,
      { screenshotUrls: retainedExistingScreenshotUrls },
      finalScreenshotOverrides === undefined
        ? undefined
        : { screenshots: finalScreenshotOverrides },
    );

    const now = new Date();
    const t = context.schema.storeListings;
    await context.db
      .update(t)
      .set({
        screenshotUrls: dbUrls.screenshotUrls,
        atUri: uri,
        updatedAt: now,
      })
      .where(eq(t.id, full.id));

    return { ok: true as const };
  });

const claimProductListingToPds = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(claimProductListingToPdsInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      throw new Error("Sign in to claim your product listing.");
    }

    const full = await getFullDirectoryListing(context, data.listingId);
    const atstoreDid = await getAtstoreRepoDid();

    if (full.productAccountDid?.trim() !== session.did) {
      throw new Error("This listing is not associated with your account.");
    }
    if (full.repoDid?.trim() !== atstoreDid) {
      throw new Error("This listing is not published on the store account.");
    }

    if (isBrowseableProtocolRow({ categorySlugs: full.categorySlugs ?? [] })) {
      throw new Error(
        "Protocol directory listings cannot be claimed to a product PDS.",
      );
    }

    const oldAtUri = full.atUri?.trim();
    const oldRkey = full.rkey?.trim();
    if (!oldAtUri?.startsWith("at://") || !oldRkey) {
      throw new Error("Listing is missing ATProto coordinates.");
    }

    /**
     * Must match `atUriFor()` in tap-listing-sync so `markListingRemovedFromTap` can correlate
     * delete events when Tap processes the store-repo tombstone before the claim finishes.
     */
    const canonicalOldAtUri = `at://${atstoreDid}/${COLLECTION.listingDetail}/${oldRkey}`;

    const { client } = session;
    const t = context.schema.storeListings;
    const claimStartedAt = new Date();

    /**
     * Set lineage + pending claimant DID *before* PDS writes:
     * - lineage so a racing Tap delete for the store-repo tombstone hits the
     *   `migratedFromAtUri` skip in `markListingRemovedFromTap`.
     * - `claimPendingForDid` so any Tap ingest of the new owner-PDS record
     *   passes the combined-lineage+DID handshake in `tap-listing-sync.ts`
     *   even if the firehose event arrives before our handler-side
     *   `verified` update below lands.
     */
    await context.db
      .update(t)
      .set({
        migratedFromAtUri: canonicalOldAtUri,
        claimPendingForDid: session.did,
        updatedAt: claimStartedAt,
      })
      .where(eq(t.id, full.id));

    try {
      /**
       * Slug for directory URLs must stay aligned with the listing that lived on the store
       * account. Prefer the authoritative `fyi.atstore.listing.detail` on the store PDS so the
       * claimed record (and mirror row) cannot drift from the migrated-from listing if Postgres
       * was ever out of sync.
       */
      const priorOnStore = await fetchListingDetailRecord(
        client,
        atstoreDid,
        oldRkey,
      );
      const inheritedSlug =
        priorOnStore?.value.slug?.trim() || full.slug?.trim() || "";
      if (!inheritedSlug) {
        throw new Error(
          "This listing has no stable slug; cannot complete the claim.",
        );
      }
      const rowForClaim: StoreListing = { ...full, slug: inheritedSlug };

      const { record } = await buildListingDetailRecordWithBlobs(
        client,
        rowForClaim,
        undefined,
        {
          migratedFromAtUri: canonicalOldAtUri,
        },
      );
      record.updatedAt = new Date().toISOString();

      const { uri: newUri } = await createListingDetailRecord(
        client,
        session.did,
        record,
      );
      const { rkey: newRkey } = parseAtUriParts(newUri);

      const now = new Date();
      await context.db
        .update(t)
        .set({
          slug: inheritedSlug,
          atUri: newUri,
          repoDid: session.did,
          rkey: newRkey,
          migratedFromAtUri: canonicalOldAtUri,
          verificationStatus: "verified",
          /** Handshake satisfied — clear so the marker cannot gate a future re-publish. */
          claimPendingForDid: null,
          /**
           * Mirrors admin approval (`setClaimStatus`): stable claim timestamp for admin
           * views and sorts. Tap ingest does not overwrite these columns.
           */
          claimedAt: now,
          claimedByDid: session.did,
          updatedAt: now,
        })
        .where(eq(t.id, full.id));

      return { slug: inheritedSlug };
    } catch (error) {
      await context.db
        .update(t)
        .set({
          migratedFromAtUri: null,
          claimPendingForDid: null,
          updatedAt: new Date(),
        })
        .where(eq(t.id, full.id));
      throw error;
    }
  });

const getProfileOwnedProductListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getProfileOwnedProductListingsInput)
  .handler(async ({ data, context }) => {
    const did = data.did.trim();
    if (!isPlausiblePublicDid(did)) {
      return null;
    }

    const t = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: t.id,
        name: t.name,
        slug: t.slug,
        tagline: t.tagline,
        iconUrl: t.iconUrl,
        heroImageUrl: t.heroImageUrl,
        reviewCount: t.reviewCount,
        averageRating: t.averageRating,
      })
      .from(t)
      .where(listingPublicWhere(t, eq(t.productAccountDid, did)))
      .orderBy(asc(t.name));

    return rows.map((row) => ({
      ...row,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      heroImageUrl: httpsListingImageUrlOrNull(row.heroImageUrl),
    }));
  });

function getProfileOwnedProductListingsQueryOptions(did: string) {
  return queryOptions({
    queryKey: ["storeListings", "profileOwnedProducts", did] as const,
    queryFn: async () => getProfileOwnedProductListings({ data: { did } }),
  });
}

/** Signed-in user's listings (every verification status) with rejection history — for /products/manage */
const getMyProductListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return [];
    }

    const did = session.did;
    const t = context.schema.storeListings;
    const rej = context.schema.storeListingRejectionEvents;

    const rows = await context.db
      .select({
        id: t.id,
        name: t.name,
        slug: t.slug,
        iconUrl: t.iconUrl,
        verificationStatus: t.verificationStatus,
        updatedAt: t.updatedAt,
      })
      .from(t)
      .where(eq(t.productAccountDid, did))
      .orderBy(desc(t.updatedAt));

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((r) => r.id);
    const events = await context.db
      .select({
        storeListingId: rej.storeListingId,
        reason: rej.reason,
        createdAt: rej.createdAt,
      })
      .from(rej)
      .where(inArray(rej.storeListingId, ids))
      .orderBy(asc(rej.createdAt));

    const byListing = new Map<
      string,
      Array<{ createdAt: Date; reason: string }>
    >();

    for (const e of events) {
      const list = byListing.get(e.storeListingId) ?? [];
      list.push({ createdAt: e.createdAt, reason: e.reason });
      byListing.set(e.storeListingId, list);
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
      verificationStatus: row.verificationStatus,
      updatedAt: row.updatedAt.toISOString(),
      rejectionHistory:
        byListing.get(row.id)?.map((h) => ({
          createdAt: h.createdAt.toISOString(),
          reason: h.reason,
        })) ?? [],
    }));
  });

function getMyProductListingsQueryOptions() {
  return queryOptions({
    queryKey: ["storeListings", "mine"] as const,
    queryFn: async () => getMyProductListings(),
  });
}

export type StoreManagedListingSummary = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  externalUrl: string | null;
  categorySlug: string | null;
  verificationStatus: string;
  productAccountHandle: string | null;
  updatedAt: string | null;
};

/**
 * Admin-only: lists every `store_listings` row still published on the store
 * account (i.e. `repo_did = atstoreDid`). These are the listings an admin can
 * freely edit via `updateStoreManagedListing` and the regenerate/preview tooling.
 */
const getStoreManagedListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const atstoreDid = await getAtstoreRepoDid();
    const t = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: t.id,
        slug: t.slug,
        name: t.name,
        iconUrl: t.iconUrl,
        externalUrl: t.externalUrl,
        categorySlugs: t.categorySlugs,
        verificationStatus: t.verificationStatus,
        productAccountHandle: t.productAccountHandle,
        updatedAt: t.updatedAt,
      })
      .from(t)
      .where(eq(t.repoDid, atstoreDid))
      .orderBy(asc(t.name));

    return rows.map(
      (row): StoreManagedListingSummary => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
        externalUrl: row.externalUrl,
        categorySlug: primaryCategorySlug(row.categorySlugs ?? []),
        verificationStatus: row.verificationStatus,
        productAccountHandle: row.productAccountHandle,
        updatedAt: row.updatedAt?.toISOString() ?? null,
      }),
    );
  });

const getStoreManagedListingsQueryOptions = queryOptions({
  queryKey: ["storeListings", "storeManagedListings"] as const,
  queryFn: async () => getStoreManagedListings(),
});

export type AdminListingHeroReviewRow = {
  id: string;
  name: string;
  productSlug: string;
  heroImageUrl: string | null;
  /** Public hero image URL when set on the listing. */
  ogShareImageFromHero: string | null;
  /** `/og?…` card used for Open Graph when there is no hero. */
  ogFallbackImagePath: string;
  /** Relative URL: resolved hero if set, otherwise the fallback `/og` card. */
  effectiveOgImagePath: string;
  /** Product site URL used to scrape `og:image` (external link, else source URL). */
  externalPageUrl: string | null;
  /** `repo_did` is the store publisher — hero can be cleared only when one exists (`canRemoveHero`). */
  isStorePublished: boolean;
  canRemoveHero: boolean;
};

/**
 * Admin-only: every verified listing with fields needed to review on-page hero vs social preview.
 */
const getAdminListingHeroReview = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const atstoreDid = await getAtstoreRepoDid();
    const t = context.schema.storeListings;
    const rows = await context.db
      .select({
        id: t.id,
        name: t.name,
        slug: t.slug,
        tagline: t.tagline,
        fullDescription: t.fullDescription,
        heroImageUrl: t.heroImageUrl,
        repoDid: t.repoDid,
        appTags: t.appTags,
        externalUrl: t.externalUrl,
        sourceUrl: t.sourceUrl,
      })
      .from(t)
      .where(listingPublicWhere(t))
      .orderBy(asc(t.name));

    return rows.map((row): AdminListingHeroReviewRow => {
      const heroImageUrl = httpsListingImageUrlOrNull(row.heroImageUrl);
      const tagline =
        sanitizeListingTagline(row.tagline) ||
        sanitizeListingTagline(row.fullDescription) ||
        "Discover a polished Bluesky tool.";
      const primaryTag = row.appTags?.[0]
        ? formatAppTagLabel(row.appTags[0])
        : null;
      const ogDescription = primaryTag
        ? `${tagline} Tag: ${primaryTag}.`
        : tagline;
      const ogTitle = `${row.name} | at-store`;
      const resolvedHero = publicMediaUrlOrNull(heroImageUrl);
      const ogFallbackImagePath = buildFallbackOgImageUrl({
        title: ogTitle,
        description: ogDescription,
      });
      const effectiveOgImagePath = resolvedHero ?? ogFallbackImagePath;
      const productSlug =
        row.slug?.trim() || buildDirectoryListingSlug({ name: row.name });
      const rawHero = row.heroImageUrl?.trim();
      const isStorePublished = row.repoDid?.trim() === atstoreDid;

      return {
        id: row.id,
        name: row.name,
        productSlug,
        heroImageUrl,
        ogShareImageFromHero: resolvedHero,
        ogFallbackImagePath,
        effectiveOgImagePath,
        externalPageUrl: getListingExternalPageUrl({
          externalUrl: row.externalUrl,
          sourceUrl: row.sourceUrl,
        }),
        isStorePublished,
        canRemoveHero: isStorePublished && Boolean(rawHero),
      };
    });
  });

const getAdminListingHeroReviewQueryOptions = queryOptions({
  queryKey: ["storeListings", "adminListingHeroReview"] as const,
  queryFn: async () => getAdminListingHeroReview(),
});

const fetchListingExternalOgImageInput = z.object({
  id: z.string().uuid(),
});

const fetchListingExternalOgImage = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(fetchListingExternalOgImageInput)
  .handler(async ({ data, context }) => {
    const t = context.schema.storeListings;
    const [row] = await context.db
      .select({
        externalUrl: t.externalUrl,
        sourceUrl: t.sourceUrl,
      })
      .from(t)
      .where(and(listingPublicWhere(t), eq(t.id, data.id)))
      .limit(1);

    if (!row) {
      throw new Error("Listing not found.");
    }

    const pageUrl = getListingExternalPageUrl({
      externalUrl: row.externalUrl,
      sourceUrl: row.sourceUrl,
    });

    if (!pageUrl) {
      return {
        ogImageUrl: null as string | null,
        pageUrl: null as string | null,
      };
    }

    const ogImageUrl = await discoverOgImageUrlFromPage(pageUrl);
    return { ogImageUrl, pageUrl };
  });

function getFetchListingExternalOgImageQueryOptions(listingId: string) {
  const id = fetchListingExternalOgImageInput.parse({ id: listingId }).id;
  return queryOptions({
    queryKey: ["storeListings", "adminExternalOg", id] as const,
    queryFn: async () => fetchListingExternalOgImage({ data: { id } }),
    staleTime: 60 * 60 * 1000,
  });
}

const applyListingHeroFromExternalOgInput = z.object({
  id: z.string().uuid(),
});

/**
 * Re-fetch og:image from the listing product URL, upload as a new hero blob on the store
 * record, and mirror the CDN URL into `hero_image_url` (same constraints as remove hero).
 */
const applyListingHeroFromExternalOg = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(applyListingHeroFromExternalOgInput)
  .handler(async ({ data, context }) => {
    const full = await getFullDirectoryListing(context, data.id);
    const atstoreRepoDid = await getAtstoreRepoDid();
    if (full.repoDid?.trim() !== atstoreRepoDid) {
      throw new Error(
        "Only listings published from the store account can set hero from site OG.",
      );
    }

    const pageUrl = getListingExternalPageUrl({
      externalUrl: full.externalUrl,
      sourceUrl: full.sourceUrl,
    });
    if (!pageUrl?.trim()) {
      throw new Error("Listing has no product URL to scrape for og:image.");
    }

    const ogUrl = await discoverOgImageUrlFromPage(pageUrl);
    if (!ogUrl) {
      throw new Error(
        "No og:image (or Twitter image) meta tag found on the product page.",
      );
    }

    const { bytes, mimeType } = await resolveUrlToImageBytes(ogUrl);
    if (!mimeType.startsWith("image/")) {
      throw new Error(`og:image resolved to non-image content: ${mimeType}`);
    }
    const maxBytes = 12_000_000;
    if (bytes.byteLength > maxBytes) {
      throw new Error(
        `og:image is too large (${bytes.byteLength} bytes); max ${maxBytes}.`,
      );
    }

    const { heroImageUrl: publishedHero } = await publishDirectoryListingDetail(
      full,
      undefined,
      {
        heroImage: {
          bytes,
          mimeType,
        },
      },
    );

    const t = context.schema.storeListings;
    await context.db
      .update(t)
      .set({
        heroImageUrl: publishedHero ?? null,
        updatedAt: new Date(),
      })
      .where(eq(t.id, data.id));

    return {
      id: data.id,
      heroImageUrl: publishedHero ?? null,
      ogSourceUrl: ogUrl,
    };
  });

const updateStoreManagedListingInput = z.object({
  listingId: z.string().uuid(),
  name: z.string().trim().min(1).max(640),
  tagline: z.string().max(2000),
  fullDescription: z.string().max(20_000),
  externalUrl: listingExternalUrlSchema,
  categorySlug: z.string().trim().min(1).max(256),
  productHandle: z.string().max(300),
  links: z
    .array(listingLinkInputSchema)
    .max(LISTING_LINK_MAX_COUNT)
    .optional()
    .default([]),
  appTags: z.array(z.string()).max(64).optional().default([]),
  heroImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  iconImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  retainedExistingScreenshotUrls: z
    .array(z.string().min(1))
    .max(4)
    .optional()
    .default([]),
  screenshotImages: z
    .array(
      z.object({
        mimeType: z.string().min(3).max(128),
        imageBase64: z.string().min(1),
      }),
    )
    .max(4)
    .optional()
    .default([]),
});

async function assertStoreManagedListing(
  context: { db: Database; schema: typeof dbSchema },
  listingId: string,
): Promise<StoreListing> {
  const full = await getFullDirectoryListing(context, listingId);
  const atstoreDid = await getAtstoreRepoDid();
  if (full.repoDid?.trim() !== atstoreDid) {
    throw new Error(
      "This listing is not published from the store account and cannot be edited here.",
    );
  }
  return full;
}

/**
 * Admin-only bulk edit for store-PDS listings. Mirrors `updateOwnedProductListing` +
 * image/screenshot helpers but publishes via the store account and bypasses the
 * session-based ownership checks. Only works for listings whose `repo_did`
 * matches the store DID.
 */
const updateStoreManagedListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(updateStoreManagedListingInput)
  .handler(async ({ data, context }) => {
    const full = await assertStoreManagedListing(context, data.listingId);

    const name = data.name.trim().slice(0, 640);
    const taglineClean = sanitizeListingTagline(data.tagline);
    const descClean = sanitizeListingDescription(data.fullDescription);
    const externalUrl = data.externalUrl.trim();
    const categorySlug = normalizeEditableListingCategorySlug(
      data.categorySlug,
    );
    const productHandleInput = data.productHandle.trim();

    let productAccountHandle: string | null = null;
    let productAccountDid: string | null = full.productAccountDid ?? null;
    if (productHandleInput.length > 0) {
      productAccountHandle =
        normalizeManualProductAccountHandle(productHandleInput);
      const resolvedDid = await resolveBlueskyHandleToDid(productAccountHandle);
      if (!resolvedDid) {
        throw new Error("Could not resolve that handle to a DID.");
      }
      productAccountDid = resolvedDid;
    }

    const links = normalizeListingLinks(data.links as Array<ListingLink>);
    const appTags = isEditableAppCategorySlug(categorySlug)
      ? normalizeAppTags(data.appTags ?? [])
      : [];

    let blobOverrides:
      | {
          heroImage?: { bytes: Uint8Array; mimeType: string };
          icon?: { bytes: Uint8Array; mimeType: string };
          screenshots?: Array<{ bytes: Uint8Array; mimeType: string }>;
        }
      | undefined;

    if (data.heroImage) {
      const heroMime = data.heroImage.mimeType.trim().toLowerCase();
      if (!heroMime.startsWith("image/")) {
        throw new Error("Hero image must be an image.");
      }
      const heroRaw = Buffer.from(data.heroImage.imageBase64, "base64");
      if (heroRaw.length === 0 || heroRaw.length > 12_000_000) {
        throw new Error("Hero image must be at most 12 MB.");
      }
      blobOverrides = blobOverrides ?? {};
      blobOverrides.heroImage = {
        bytes: Uint8Array.from(heroRaw),
        mimeType: heroMime,
      };
    }

    if (data.iconImage) {
      const iconMime = data.iconImage.mimeType.trim().toLowerCase();
      if (!iconMime.startsWith("image/")) {
        throw new Error("Icon image must be an image.");
      }
      const iconRaw = Buffer.from(data.iconImage.imageBase64, "base64");
      if (iconRaw.length === 0 || iconRaw.length > 2_000_000) {
        throw new Error("Icon image must be at most 2 MB.");
      }
      blobOverrides = blobOverrides ?? {};
      blobOverrides.icon = {
        bytes: Uint8Array.from(iconRaw),
        mimeType: iconMime,
      };
    }

    const retainedExistingScreenshotUrls = (
      data.retainedExistingScreenshotUrls ?? []
    )
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .slice(0, 4);
    const newScreenshots = (data.screenshotImages ?? []).map(
      (screenshot, index) => {
        const mime = screenshot.mimeType.trim().toLowerCase();
        if (!mime.startsWith("image/")) {
          throw new Error(`Screenshot ${index + 1} must be an image.`);
        }
        const raw = Buffer.from(screenshot.imageBase64, "base64");
        if (raw.length === 0 || raw.length > 12_000_000) {
          throw new Error(`Screenshot ${index + 1} must be at most 12 MB.`);
        }
        return { bytes: Uint8Array.from(raw), mimeType: mime };
      },
    );

    const existingScreenshotUrls = full.screenshotUrls ?? [];
    const screenshotsChanged =
      newScreenshots.length > 0 ||
      retainedExistingScreenshotUrls.length !== existingScreenshotUrls.length ||
      retainedExistingScreenshotUrls.some(
        (url, index) => url !== existingScreenshotUrls[index],
      );

    if (screenshotsChanged) {
      const retainedAsBlobs =
        retainedExistingScreenshotUrls.length > 0 && newScreenshots.length > 0
          ? await Promise.all(
              retainedExistingScreenshotUrls.map(async (url, index) => {
                let resolved;
                try {
                  resolved = await resolveUrlToImageBytes(url);
                } catch {
                  throw new Error(
                    `Could not keep existing screenshot ${index + 1}; please re-upload it.`,
                  );
                }
                if (
                  !resolved.mimeType.startsWith("image/") ||
                  resolved.bytes.length === 0 ||
                  resolved.bytes.length > 12_000_000
                ) {
                  throw new Error(
                    `Existing screenshot ${index + 1} is invalid; please re-upload it.`,
                  );
                }
                return resolved;
              }),
            )
          : [];

      /**
       * When the caller uploaded new screenshots, re-pack the full ordered list (retained
       * first, new next) as blob overrides; otherwise we just trim the existing list by
       * passing through `screenshotUrls` in the patch below.
       */
      if (newScreenshots.length > 0) {
        blobOverrides = blobOverrides ?? {};
        blobOverrides.screenshots = [
          ...retainedAsBlobs,
          ...newScreenshots,
        ].slice(0, 4);
      }
    }

    /**
     * Only include keys we actually want to override. Setting a key to `undefined`
     * here still overwrites `row.<key>` via `{ ...row, ...patch }` in
     * `mergeListingRow`, which previously nuked `screenshotUrls` on text-only saves
     * and caused `row.screenshotUrls.filter(...)` to throw in
     * `buildListingDetailRecordWithBlobs`.
     */
    const patch: Partial<StoreListing> = {
      name,
      tagline: taglineClean,
      fullDescription: descClean,
      externalUrl,
      categorySlugs: [categorySlug],
      links,
      appTags,
    };
    if (productAccountDid) {
      patch.productAccountDid = productAccountDid;
    }
    if (screenshotsChanged && newScreenshots.length === 0) {
      patch.screenshotUrls = retainedExistingScreenshotUrls;
    }

    const { uri } = await publishDirectoryListingDetail(
      full,
      patch,
      blobOverrides,
    );

    const now = new Date();
    const t = context.schema.storeListings;
    await context.db
      .update(t)
      .set({
        name,
        tagline: taglineClean,
        fullDescription: descClean,
        externalUrl,
        categorySlugs: [categorySlug],
        productAccountDid,
        productAccountHandle,
        atUri: uri,
        links,
        appTags,
        updatedAt: now,
      })
      .where(eq(t.id, full.id));

    return { slug: full.slug };
  });

const createStoreManagedListingInput = z.object({
  name: z.string().trim().min(1).max(640),
  tagline: z.string().max(2000),
  fullDescription: z.string().max(20_000),
  externalUrl: listingExternalUrlSchema,
  categorySlug: z.string().trim().min(1).max(256),
  productHandle: z.string().max(300),
  links: z
    .array(listingLinkInputSchema)
    .max(LISTING_LINK_MAX_COUNT)
    .optional()
    .default([]),
  appTags: z.array(z.string()).max(64).optional().default([]),
  heroImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  iconImage: z
    .object({
      mimeType: z.string().min(3).max(128),
      imageBase64: z.string().min(1),
    })
    .optional(),
  screenshotImages: z
    .array(
      z.object({
        mimeType: z.string().min(3).max(128),
        imageBase64: z.string().min(1),
      }),
    )
    .max(4)
    .optional()
    .default([]),
});

/**
 * Admin-only: create a brand-new `fyi.atstore.listing.detail` record on the
 * store PDS. The row in Postgres is created by Tap ingest when the record
 * lands; this server fn only publishes to the PDS and returns the slug/uri.
 */
const createStoreManagedListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(createStoreManagedListingInput)
  .handler(async ({ data, context }) => {
    const { client, repoDid } = await createAtstorePublishClient();

    const name = data.name.trim().slice(0, 640);
    const taglineClean = sanitizeListingTagline(data.tagline);
    const descClean = sanitizeListingDescription(data.fullDescription);
    const externalUrl = data.externalUrl.trim();
    const categorySlug = normalizeEditableListingCategorySlug(
      data.categorySlug,
    );
    const slug = await allocateUniqueStoreListingSlug(
      context.db,
      name,
      externalUrl,
    );
    const productHandleInput = data.productHandle.trim();

    let productAccountHandle: string | null = null;
    let productAccountDid: string | null = null;
    if (productHandleInput.length > 0) {
      productAccountHandle =
        normalizeManualProductAccountHandle(productHandleInput);
      const resolvedDid = await resolveBlueskyHandleToDid(productAccountHandle);
      if (!resolvedDid) {
        throw new Error("Could not resolve that handle to a DID.");
      }
      productAccountDid = resolvedDid;
    }

    const now = new Date();
    const links = normalizeListingLinks(data.links as Array<ListingLink>);
    const appTags = isEditableAppCategorySlug(categorySlug)
      ? normalizeAppTags(data.appTags ?? [])
      : [];
    const draftRow: StoreListing = {
      id: crypto.randomUUID(),
      sourceUrl: externalUrl,
      name,
      slug,
      externalUrl,
      iconUrl: null,
      screenshotUrls: [],
      tagline: taglineClean,
      fullDescription: descClean,
      categorySlugs: [categorySlug],
      appTags,
      links,
      atUri: null,
      repoDid,
      rkey: null,
      heroImageUrl: null,
      verificationStatus: "unverified",
      sourceAccountDid: repoDid,
      claimedByDid: null,
      claimedAt: null,
      productAccountDid,
      productAccountHandle,
      productAccountHandleIgnoredAt: null,
      migratedFromAtUri: null,
      claimPendingForDid: null,
      reviewCount: 0,
      averageRating: null,
      favoriteCount: 0,
      mentionCount24h: 0,
      mentionCount7d: 0,
      trendingScore: null,
      trendingUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let blobOverrides:
      | {
          heroImage?: { bytes: Uint8Array; mimeType: string };
          icon?: { bytes: Uint8Array; mimeType: string };
          screenshots?: Array<{ bytes: Uint8Array; mimeType: string }>;
        }
      | undefined;

    if (data.heroImage) {
      const heroMime = data.heroImage.mimeType.trim().toLowerCase();
      if (!heroMime.startsWith("image/")) {
        throw new Error("Hero image must be an image.");
      }
      const heroRaw = Buffer.from(data.heroImage.imageBase64, "base64");
      if (heroRaw.length === 0 || heroRaw.length > 12_000_000) {
        throw new Error("Hero image must be at most 12 MB.");
      }
      blobOverrides = blobOverrides ?? {};
      blobOverrides.heroImage = {
        bytes: Uint8Array.from(heroRaw),
        mimeType: heroMime,
      };
    }

    if (data.iconImage) {
      const iconMime = data.iconImage.mimeType.trim().toLowerCase();
      if (!iconMime.startsWith("image/")) {
        throw new Error("Icon image must be an image.");
      }
      const iconRaw = Buffer.from(data.iconImage.imageBase64, "base64");
      if (iconRaw.length === 0 || iconRaw.length > 2_000_000) {
        throw new Error("Icon image must be at most 2 MB.");
      }
      blobOverrides = blobOverrides ?? {};
      blobOverrides.icon = {
        bytes: Uint8Array.from(iconRaw),
        mimeType: iconMime,
      };
    }

    if (data.screenshotImages && data.screenshotImages.length > 0) {
      blobOverrides = blobOverrides ?? {};
      blobOverrides.screenshots = data.screenshotImages.map(
        (screenshot, index) => {
          const mime = screenshot.mimeType.trim().toLowerCase();
          if (!mime.startsWith("image/")) {
            throw new Error(`Screenshot ${index + 1} must be an image.`);
          }
          const raw = Buffer.from(screenshot.imageBase64, "base64");
          if (raw.length === 0 || raw.length > 12_000_000) {
            throw new Error(`Screenshot ${index + 1} must be at most 12 MB.`);
          }
          return { bytes: Uint8Array.from(raw), mimeType: mime };
        },
      );
    }

    const { record } = await buildListingDetailRecordWithBlobs(
      client,
      draftRow,
      blobOverrides,
    );
    const createdAt = now.toISOString();
    record.createdAt = createdAt;
    record.updatedAt = createdAt;

    const { uri } = await createListingDetailRecord(client, repoDid, record);
    return { uri, slug };
  });

export const directoryListingApi = {
  getHomePageData,
  getHomePageQueryOptions,
  getDirectoryCategories,
  getDirectoryCategoriesQueryOptions,
  getDirectoryCategoryTree,
  getDirectoryCategoryTreeQueryOptions,
  getDirectoryCategoryPage,
  getDirectoryCategoryPageQueryOptions,
  getAllApps,
  getAllAppsQueryOptions,
  getAppsByTag,
  getAppsByTagQueryOptions,
  getAllDirectoryListingAppTags,
  getAllDirectoryListingAppTagsQueryOptions,
  getAppsByTagPage,
  getAppsByTagPageQueryOptions,
  getAllListings,
  getAllListingsQueryOptions,
  getDirectoryListingDetail,
  getDirectoryListingDetailQueryOptions,
  getDirectoryListingDetailBySlug,
  getDirectoryListingDetailBySlugQueryOptions,
  getDirectoryListingDetailForOwnerEdit,
  getDirectoryListingDetailForOwnerEditQueryOptions,
  getDirectoryListingReviews,
  getDirectoryListingReviewsQueryOptions,
  getDirectoryListingReviewReplies,
  getDirectoryListingReviewRepliesQueryOptions,
  getDirectoryListingMentions,
  getDirectoryListingMentionsQueryOptions,
  getUserProfileReviewsPageData,
  getUserProfileReviewsPageDataQueryOptions,
  getProfileFavoriteListings,
  getProfileFavoriteListingsQueryOptions,
  getDirectoryListingFavoriteStatus,
  getDirectoryListingFavoriteStatusQueryOptions,
  favoriteDirectoryListing,
  unfavoriteDirectoryListing,
  createDirectoryListingReview,
  updateDirectoryListingReview,
  deleteDirectoryListingReview,
  createDirectoryListingReviewReply,
  updateDirectoryListingReviewReply,
  deleteDirectoryListingReviewReply,
  getRelatedDirectoryListings,
  getRelatedDirectoryListingsQueryOptions,
  listDirectoryListings,
  getListDirectoryListingsQueryOptions,
  getDirectoryListingCategoryAssignments,
  getDirectoryListingCategoryAssignmentsQueryOptions,
  getDirectoryListingAppTagAssignments,
  getDirectoryListingAppTagAssignmentsQueryOptions,
  updateDirectoryListingAppTags,
  updateDirectoryListingCategoryAssignment,
  deleteDirectoryListing,
  removeStoreManagedListingHero,
  deleteStoreManagedListing,
  deleteOwnedProductListing,
  regenerateDirectoryListingTagline,
  regenerateDirectoryListingDescription,
  getNextProductAccountCandidate,
  getNextProductAccountCandidateQueryOptions,
  getPendingProductAccountCandidates,
  getPendingProductAccountCandidatesQueryOptions,
  getListingsMissingProductAccountHandle,
  getListingsMissingProductAccountHandleQueryOptions,
  setProductAccountHandleDev,
  ignoreMissingProductAccountHandleDev,
  unignoreMissingProductAccountHandleDev,
  rescanListingOAuthProbeDev,
  applyProductAccountCandidatesBatch,
  confirmProductAccountCandidate,
  rejectProductAccountCandidate,
  getProductClaimEligibility,
  getProductClaimEligibilityQueryOptions,
  submitProductListingClaim,
  getUserProductListingClaimRequests,
  getUserProductListingClaimRequestsQueryOptions,
  getProductListingEditAccessQueryOptions,
  createOwnedProductListing,
  updateOwnedProductListing,
  updateOwnedProductListingImage,
  removeOwnedProductListingHeroImage,
  updateOwnedProductListingScreenshots,
  claimProductListingToPds,
  getProfileOwnedProductListings,
  getProfileOwnedProductListingsQueryOptions,
  getMyProductListings,
  getMyProductListingsQueryOptions,
  getStoreManagedListings,
  getStoreManagedListingsQueryOptions,
  getAdminListingHeroReview,
  getAdminListingHeroReviewQueryOptions,
  fetchListingExternalOgImage,
  getFetchListingExternalOgImageQueryOptions,
  applyListingHeroFromExternalOg,
  updateStoreManagedListing,
  createStoreManagedListing,
};
