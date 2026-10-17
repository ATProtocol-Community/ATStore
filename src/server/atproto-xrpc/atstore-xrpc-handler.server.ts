import type { DirectoryListingCardXrpc } from "#/integrations/tanstack-query/api-directory-listings.functions";
import type { ListingLink } from "#/lib/atproto/listing-record";

import { db } from "#/db/index.server";
import * as schema from "#/db/schema";
import { directoryListingXrpcHelpers } from "#/integrations/tanstack-query/api-directory-listings.functions";
import { parseAtUriParts } from "#/lib/atproto/at-uri";
import { ATSTORE_XRPC_METHOD, NSID } from "#/lib/atproto/nsids";
import { fetchBlueskyPublicProfileFields } from "#/lib/bluesky-public-profile";
import {
  filterAndSortBrowseListings,
  joinList,
  validateBrowseSearch,
} from "#/lib/browse-listings";
import { getAtprotoSessionForRequest } from "#/middleware/auth";
import { desc, eq, inArray, or, sql } from "drizzle-orm";

const LEGACY_DETAIL_SQL = {
  rawCategoryHint: sql<string | null>`null::text`.as("rawCategoryHint"),
  scope: sql<string | null>`null::text`.as("scope"),
  productType: sql<string | null>`null::text`.as("productType"),
  domain: sql<string | null>`null::text`.as("domain"),
  vertical: sql<string | null>`null::text`.as("vertical"),
  classificationReason: sql<string | null>`null::text`.as(
    "classificationReason",
  ),
};

const corsJsonHeaders: HeadersInit = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

function xrpcJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsJsonHeaders,
  });
}

function xrpcErr(status: number, error: string, message?: string) {
  return xrpcJson({ error, message: message ?? error }, status);
}

function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString(
    "base64url",
  );
}

function decodeOffsetCursor(cursor: string | null): number | undefined {
  if (!cursor?.trim()) {
    return undefined;
  }
  try {
    const raw = Buffer.from(cursor.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { o?: unknown };
    if (
      typeof parsed.o !== "number" ||
      !Number.isFinite(parsed.o) ||
      parsed.o < 0
    ) {
      return undefined;
    }
    return Math.floor(parsed.o);
  } catch {
    return undefined;
  }
}

function listingDetailUriOrNull(uriRaw: string): string | null {
  const trimmed = uriRaw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const { collection } = parseAtUriParts(trimmed);
    return collection === NSID.listingDetail ? trimmed : null;
  } catch {
    return null;
  }
}

function listingCardXrpcJson(card: DirectoryListingCardXrpc) {
  return {
    ...card,
    rating:
      card.rating == null || Number.isNaN(Number(card.rating))
        ? null
        : String(card.rating),
  };
}

function normalizeExternalUrlCandidates(raw: string): Array<string> {
  const t = raw.trim();
  if (!t) {
    return [];
  }
  const noTrail = t.replace(/\/+$/, "");
  if (noTrail === t) {
    return [t];
  }
  return [t, noTrail];
}

async function handleDescribe() {
  const methods = (
    Object.values(ATSTORE_XRPC_METHOD) as Array<string>
  ).toSorted((a, b) => a.localeCompare(b));
  return xrpcJson({
    service: "at-store-directory",
    publicReads: true,
    reviewsWrittenOnAuthorRepo: true,
    defaultListingLimit: 24,
    maxListingLimit: 100,
    maxReviewLimit: 100,
    methods,
  });
}

/** Repeated XRPC array params (`?tag=a&tag=b`), also accepting comma-joined values. */
function getListParam(url: URL, name: string): string | undefined {
  return joinList(
    url.searchParams
      .getAll(name)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/**
 * Filters and sorts with the same logic as `/apps` (over the cached catalog), then loads full
 * card rows for just the requested page.
 */
async function handleSearchListings(url: URL) {
  const limitParam = Number(url.searchParams.get("limit") ?? "24");
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, Math.floor(limitParam)))
    : 24;
  const cursorParam = url.searchParams.get("cursor");
  const offset = decodeOffsetCursor(cursorParam);
  if (cursorParam?.trim() && offset === undefined) {
    return xrpcErr(400, "InvalidCursor");
  }
  const start = offset ?? 0;

  const search = validateBrowseSearch({
    q: url.searchParams.get("q") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    tag: getListParam(url, "tag"),
    in: getListParam(url, "category"),
    data: getListParam(url, "data"),
    rating: url.searchParams.get("minRating") ?? undefined,
    has: getListParam(url, "has"),
  });

  const {
    getCachedBrowseListings,
    listingXrpcPublicWhere,
    getListingSelect,
    toListingCardXrpc,
  } = directoryListingXrpcHelpers;

  const catalog = await getCachedBrowseListings({ db, schema });
  const matching = filterAndSortBrowseListings(
    catalog.filter((listing) => listing.hasAtUri),
    search,
  );
  const pageIds = matching
    .slice(start, start + limit)
    .map((listing) => listing.id);

  const table = schema.storeListings;
  const rows =
    pageIds.length === 0
      ? []
      : await db
          .select(getListingSelect(table))
          .from(table)
          .where(listingXrpcPublicWhere(table, inArray(table.id, pageIds)));
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const listings = pageIds
    .flatMap((id) => rowsById.get(id) ?? [])
    .map((row) => listingCardXrpcJson(toListingCardXrpc(row)));

  const hasMore = matching.length > start + limit;
  return xrpcJson({
    listings,
    ...(hasMore ? { cursor: encodeOffsetCursor(start + limit) } : {}),
  });
}

function verifiedListingDetailSelect(table: typeof schema.storeListings) {
  return {
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
    ...LEGACY_DETAIL_SQL,
    appTags: table.appTags,
    links: table.links,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}

type VerifiedListingDetailRowForXrpc = Parameters<
  (typeof directoryListingXrpcHelpers)["toListingCardXrpc"]
>[0] & {
  links: unknown;
  repoDid: string | null;
  migratedFromAtUri: string | null;
  productAccountDid: string | null;
  sourceUrl: string;
  externalUrl: string | null;
  tagline: string | null;
  fullDescription: string | null;
  screenshotUrls: Array<string>;
  createdAt: Date;
  updatedAt: Date;
};

async function listingDetailXrpcPayload(row: VerifiedListingDetailRowForXrpc) {
  const { toListingCardXrpc, computeIsStoreManaged, normalizeListingLinks } =
    directoryListingXrpcHelpers;

  const listing = listingCardXrpcJson(toListingCardXrpc(row));
  const isStoreManaged = await computeIsStoreManaged(row);

  const linksRaw = normalizeListingLinks(
    row.links as Array<ListingLink> | null,
  );

  return {
    listing,
    isStoreManaged,
    repoDid: row.repoDid ?? null,
    productAccountDid: row.productAccountDid ?? null,
    sourceTagline: row.tagline ?? null,
    sourceFullDescription: row.fullDescription ?? null,
    screenshots: row.screenshotUrls ?? [],
    externalUrl: row.externalUrl ?? null,
    sourceUrl: row.sourceUrl ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    links: linksRaw.map((link) => ({
      ...(link.label ? { label: link.label } : {}),
      uri: link.url,
    })),
  };
}

async function fetchVerifiedListingDetailRowByUri(uriRaw: string) {
  const canonical = listingDetailUriOrNull(uriRaw);
  if (!canonical) {
    return { error: "InvalidParams" as const };
  }

  const table = schema.storeListings;
  const { listingXrpcPublicWhere } = directoryListingXrpcHelpers;

  const filter = eq(table.atUri, canonical);

  const [row] = await db
    .select(verifiedListingDetailSelect(table))
    .from(table)
    .where(listingXrpcPublicWhere(table, filter))
    .limit(1);

  if (!row) {
    return { error: "ListingNotFound" as const };
  }
  return { row };
}

async function handleGetListing(url: URL) {
  const uriParam = url.searchParams.get("uri")?.trim() ?? "";
  const externalUrlParam = url.searchParams.get("externalUrl")?.trim() ?? "";
  const hasUri = uriParam.length > 0;
  const hasExternal = externalUrlParam.length > 0;

  if (hasUri === hasExternal) {
    return xrpcErr(
      400,
      "InvalidParams",
      "Provide exactly one of uri or externalUrl.",
    );
  }

  if (hasUri) {
    const fetched = await fetchVerifiedListingDetailRowByUri(uriParam);
    if ("error" in fetched) {
      switch (fetched.error) {
        case "InvalidParams": {
          return xrpcErr(400, fetched.error);
        }
        case "ListingNotFound": {
          return xrpcErr(404, fetched.error);
        }
        default: {
          return xrpcErr(500, "InternalError");
        }
      }
    }

    return xrpcJson(await listingDetailXrpcPayload(fetched.row));
  }

  const variants = normalizeExternalUrlCandidates(externalUrlParam);
  if (variants.length === 0) {
    return xrpcErr(400, "InvalidParams");
  }

  const table = schema.storeListings;
  const { listingXrpcPublicWhere } = directoryListingXrpcHelpers;

  const clause =
    variants.length === 1
      ? (() => {
          const only = variants[0];
          return only ? eq(table.externalUrl, only) : undefined;
        })()
      : or(...variants.map((v) => eq(table.externalUrl, v)));

  if (!clause) {
    return xrpcErr(400, "InvalidParams");
  }

  const rows = await db
    .select(verifiedListingDetailSelect(table))
    .from(table)
    .where(listingXrpcPublicWhere(table, clause))
    .limit(4);

  if (rows.length === 0) {
    return xrpcErr(404, "ListingNotFound");
  }
  if (rows.length > 1) {
    return xrpcErr(409, "AmbiguousResolution");
  }

  const row = rows.at(0);
  if (!row?.atUri?.trim()) {
    return xrpcErr(404, "ListingNotFound");
  }

  return xrpcJson(await listingDetailXrpcPayload(row));
}

async function handleListReviews(url: URL, request: Request) {
  const uriParam = url.searchParams.get("uri") ?? "";
  const canonical = listingDetailUriOrNull(uriParam);
  if (!canonical) {
    return xrpcErr(400, "InvalidParams");
  }

  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, Math.floor(limitParam)))
    : 50;
  const cursorParam = url.searchParams.get("cursor");
  const offset = decodeOffsetCursor(cursorParam);
  if (cursorParam?.trim() && offset === undefined) {
    return xrpcErr(400, "InvalidCursor");
  }
  const start = offset ?? 0;

  const table = schema.storeListings;
  const { listingXrpcPublicWhere, viewerMayReplyOnListingReview } =
    directoryListingXrpcHelpers;

  const [listing] = await db
    .select({
      id: table.id,
      repoDid: table.repoDid,
      productAccountDid: table.productAccountDid,
    })
    .from(table)
    .where(listingXrpcPublicWhere(table, eq(table.atUri, canonical)))
    .limit(1);

  if (!listing) {
    return xrpcErr(404, "ListingNotFound");
  }

  const session = await getAtprotoSessionForRequest(request);
  const viewerDid = session?.did ?? undefined;

  const rev = schema.storeListingReviews;
  const rows = await db
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
    .orderBy(desc(rev.reviewCreatedAt))
    .offset(start)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const reviews = await Promise.all(
    slice.map(async (row) => {
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

      return {
        id: row.id,
        authorDid: row.authorDid,
        rating: row.rating,
        text: row.text,
        reviewCreatedAt: row.reviewCreatedAt.toISOString(),
        authorDisplayName: displayName,
        authorHandle: handle,
        authorAvatarUrl: avatarUrl,
        replyCount: Number(row.replyCount ?? 0),
        canReply: viewerMayReplyOnListingReview({
          viewerDid,
          reviewAuthorDid: row.authorDid,
          listingRepoDid: listing.repoDid,
          listingProductAccountDid: listing.productAccountDid,
        }),
      };
    }),
  );

  return xrpcJson({
    reviews,
    ...(hasMore ? { cursor: encodeOffsetCursor(start + limit) } : {}),
  });
}

export async function handleAtstoreXrpc(
  request: Request,
  nsid: string,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(request.url);

  try {
    switch (nsid) {
      case ATSTORE_XRPC_METHOD.serverDescribe: {
        if (request.method !== "GET") {
          return xrpcErr(405, "MethodNotAllowed");
        }
        return handleDescribe();
      }

      case ATSTORE_XRPC_METHOD.directorySearchListings: {
        if (request.method !== "GET") {
          return xrpcErr(405, "MethodNotAllowed");
        }
        return handleSearchListings(url);
      }

      case ATSTORE_XRPC_METHOD.directoryGetListing: {
        if (request.method !== "GET") {
          return xrpcErr(405, "MethodNotAllowed");
        }
        return handleGetListing(url);
      }

      case ATSTORE_XRPC_METHOD.reviewsListForListing: {
        if (request.method !== "GET") {
          return xrpcErr(405, "MethodNotAllowed");
        }
        return handleListReviews(url, request);
      }

      default: {
        return xrpcErr(404, "MethodNotFound");
      }
    }
  } catch (error) {
    console.error("atstore xrpc handler error", error);
    return xrpcErr(500, "InternalError");
  }
}
