/**
 * Weekly digest content: apps newly listed (or newly verified) this week, plus
 * the current trending apps. The same digest goes to every subscriber, so the
 * runner builds it once per run.
 */

import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { sanitizeListingTagline } from "#/lib/listing-copy";
import { httpsListingImageUrlOrNull } from "#/lib/listing-image-url";
import { and, desc, eq, gte, notInArray, or, sql } from "drizzle-orm";

import {
  DIGEST_NEW_APPS_LIMIT,
  DIGEST_TRENDING_APPS_LIMIT,
  DIGEST_WINDOW_DAYS,
} from "./config";

export interface DigestApp {
  id: string;
  name: string;
  tagline: string;
  iconUrl: string | null;
  url: string;
  rating: number | null;
  reviewCount: number;
}

export interface DigestData {
  newApps: Array<DigestApp>;
  trendingApps: Array<DigestApp>;
}

export interface DigestListingRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  fullDescription: string | null;
  iconUrl: string | null;
  reviewCount: number;
  averageRating: number | null;
}

export function isDigestEmpty(digest: DigestData): boolean {
  return digest.newApps.length === 0 && digest.trendingApps.length === 0;
}

export function toDigestApp(row: DigestListingRow, baseUrl: string): DigestApp {
  const rating =
    row.reviewCount > 0 && row.averageRating != null
      ? Number(row.averageRating.toFixed(1))
      : null;
  return {
    id: row.id,
    name: row.name,
    tagline:
      sanitizeListingTagline(row.tagline) ||
      sanitizeListingTagline(row.fullDescription) ||
      "",
    iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
    url: `${baseUrl}/products/${encodeURIComponent(row.slug)}`,
    rating,
    reviewCount: row.reviewCount,
  };
}

const t = schema.storeListings;

const digestListingSelect = {
  id: t.id,
  name: t.name,
  slug: t.slug,
  tagline: t.tagline,
  fullDescription: t.fullDescription,
  iconUrl: t.iconUrl,
  reviewCount: t.reviewCount,
  averageRating: t.averageRating,
};

/** Verified listings under `apps/<slug>` — the same pool the home page draws from. */
const publicAppWhere = and(
  eq(t.verificationStatus, "verified"),
  sql<boolean>`exists (
    select 1 from unnest(${t.categorySlugs}) as u(slug)
    where cardinality(string_to_array(trim(both from u.slug::text), '/')) = 2
      and trim(both from u.slug::text) like 'apps/%'
  )`,
);

export async function buildDigest(
  db: Database,
  options: { baseUrl: string; now?: Date },
): Promise<DigestData> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - DIGEST_WINDOW_DAYS * 86_400_000);
  const approvals = schema.storeListingVerificationApprovalEvents;

  const newRows = await db
    .select(digestListingSelect)
    .from(t)
    .where(
      and(
        publicAppWhere,
        or(
          gte(t.createdAt, since),
          sql<boolean>`exists (
            select 1 from ${approvals}
            where ${approvals.storeListingId} = ${t.id}
              and ${approvals.createdAt} >= ${since.toISOString()}::timestamptz
          )`,
        ),
      ),
    )
    .orderBy(desc(t.createdAt))
    .limit(DIGEST_NEW_APPS_LIMIT);

  const newIds = newRows.map((row) => row.id);
  const trendingRows = await db
    .select(digestListingSelect)
    .from(t)
    .where(
      and(
        publicAppWhere,
        newIds.length > 0 ? notInArray(t.id, newIds) : undefined,
      ),
    )
    // Scored apps first; on a quiet week, most-favorited/reviewed apps fill the
    // rest so the section always has DIGEST_TRENDING_APPS_LIMIT entries.
    .orderBy(
      sql`${t.trendingScore} DESC NULLS LAST`,
      desc(t.favoriteCount),
      desc(t.reviewCount),
    )
    .limit(DIGEST_TRENDING_APPS_LIMIT);

  return {
    newApps: newRows.map((row) => toDigestApp(row, options.baseUrl)),
    trendingApps: trendingRows.map((row) => toDigestApp(row, options.baseUrl)),
  };
}
