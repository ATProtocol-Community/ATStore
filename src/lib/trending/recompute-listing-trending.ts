import { and, eq, gte, ne, sql } from "drizzle-orm";

import type { Database } from "#/db/index.server";
import * as schema from "#/db/schema";
import { shouldOmitUrlMentionsForBlueskyPlatformListing } from "#/lib/directory-categories";
import {
  trendingDecayWindowDays,
  trendingFavoriteHalfLifeDays,
  trendingMentionHalfLifeDays,
} from "#/lib/trending/config";
import {
  bayesianAverageRating,
  combineTrendingScore,
  decayFactorForAgeMs,
  mentionVolumeSignal,
  ratingSignalFromAverage,
} from "#/lib/trending/score";

function windowStart(): Date {
  const days = trendingDecayWindowDays();
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function storeListingMentionsInWindow(
  storeListingId: string,
  since: Date,
  omitUrlMentions: boolean,
) {
  const parts = [
    eq(schema.storeListingMentions.storeListingId, storeListingId),
    gte(schema.storeListingMentions.postCreatedAt, since),
  ];
  if (omitUrlMentions) {
    parts.push(ne(schema.storeListingMentions.matchType, "url"));
  }
  return and(...parts);
}

/**
 * Recompute `favorite_count` from `store_listing_favorites`.
 */
export async function recomputeListingFavoriteCount(
  db: Database,
  storeListingId: string,
) {
  const [agg] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
    })
    .from(schema.storeListingFavorites)
    .where(eq(schema.storeListingFavorites.storeListingId, storeListingId));

  const count = Number(agg?.cnt ?? 0);
  await db
    .update(schema.storeListings)
    .set({
      favoriteCount: count,
    })
    .where(eq(schema.storeListings.id, storeListingId));
}

async function sumDecayedFavorites(
  db: Database,
  storeListingId: string,
  halfLifeDays: number,
): Promise<number> {
  const since = windowStart();
  const rows = await db
    .select({
      t: schema.storeListingFavorites.favoriteCreatedAt,
    })
    .from(schema.storeListingFavorites)
    .where(
      and(
        eq(schema.storeListingFavorites.storeListingId, storeListingId),
        gte(schema.storeListingFavorites.favoriteCreatedAt, since),
      ),
    );

  const now = Date.now();
  let sum = 0;
  for (const row of rows) {
    const ts = row.t?.getTime?.() ?? 0;
    sum += decayFactorForAgeMs(now - ts, halfLifeDays);
  }
  return sum;
}

async function sumDecayedMentions(
  db: Database,
  storeListingId: string,
  halfLifeDays: number,
  omitUrlMentions: boolean,
): Promise<number> {
  const since = windowStart();
  const rows = await db
    .select({
      t: schema.storeListingMentions.postCreatedAt,
    })
    .from(schema.storeListingMentions)
    .where(
      storeListingMentionsInWindow(storeListingId, since, omitUrlMentions),
    );

  const now = Date.now();
  let sum = 0;
  for (const row of rows) {
    const ts = row.t?.getTime?.() ?? 0;
    sum += decayFactorForAgeMs(now - ts, halfLifeDays);
  }
  return sum;
}

async function countMentionsSince(
  db: Database,
  storeListingId: string,
  since: Date,
  omitUrlMentions: boolean,
): Promise<number> {
  const [agg] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
    })
    .from(schema.storeListingMentions)
    .where(
      storeListingMentionsInWindow(storeListingId, since, omitUrlMentions),
    );
  return Number(agg?.cnt ?? 0);
}

/**
 * Recompute denormalized trending fields + cached score for one listing.
 */
export async function recomputeListingTrending(
  db: Database,
  storeListingId: string,
) {
  const [listing] = await db
    .select({
      reviewCount: schema.storeListings.reviewCount,
      averageRating: schema.storeListings.averageRating,
      categorySlugs: schema.storeListings.categorySlugs,
    })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.id, storeListingId))
    .limit(1);

  if (!listing) return;

  const omitUrlMentions = shouldOmitUrlMentionsForBlueskyPlatformListing(
    listing.categorySlugs,
  );

  const now = new Date();
  const d24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [mention24, mention7, decayedFav, decayedMen] = await Promise.all([
    countMentionsSince(db, storeListingId, d24, omitUrlMentions),
    countMentionsSince(db, storeListingId, d7, omitUrlMentions),
    sumDecayedFavorites(db, storeListingId, trendingFavoriteHalfLifeDays()),
    sumDecayedMentions(
      db,
      storeListingId,
      trendingMentionHalfLifeDays(),
      omitUrlMentions,
    ),
  ]);

  const [favRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(schema.storeListingFavorites)
    .where(eq(schema.storeListingFavorites.storeListingId, storeListingId));
  const favoriteCount = Number(favRow?.cnt ?? 0);

  const bayes = bayesianAverageRating({
    reviewCount: listing.reviewCount,
    averageRating: listing.averageRating,
  });
  const rating01 = ratingSignalFromAverage(bayes);

  const score = combineTrendingScore({
    decayedFavoriteWeight: decayedFav,
    ratingSignal01: rating01,
    decayedMentionWeight: decayedMen,
    mentionVolume01: mentionVolumeSignal(mention7),
  });

  await db
    .update(schema.storeListings)
    .set({
      favoriteCount,
      mentionCount24h: mention24,
      mentionCount7d: mention7,
      trendingScore: score,
      trendingUpdatedAt: new Date(),
    })
    .where(eq(schema.storeListings.id, storeListingId));
}
