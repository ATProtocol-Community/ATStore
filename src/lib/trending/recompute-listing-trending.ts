import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { shouldOmitUrlMentionsForBlueskyPlatformListing } from "#/lib/directory-categories";
import {
  trendingDecayWindowDays,
  trendingFavoriteHalfLifeDays,
  trendingFavoriteVelocityBaselineDays,
  trendingFavoriteVelocityPrior,
  trendingFavoriteVelocityRecentDays,
  trendingFavoriteVelocitySquashK,
  trendingMentionHalfLifeDays,
  trendingRatingRecentBlendWeight,
  trendingRatingRecentHalfLifeDays,
} from "#/lib/trending/config";
import {
  bayesianAverageRating,
  blendRatingSignals,
  combineTrendingScore,
  decayFactorForAgeMs,
  decayedBayesianRating,
  favoriteVelocitySignal,
  mentionVolumeSignal,
  ratingSignalFromAverage,
} from "#/lib/trending/score";
import { and, eq, gte, ne, sql } from "drizzle-orm";

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

async function countFavoritesSince(
  db: Database,
  storeListingId: string,
  since: Date,
): Promise<number> {
  const [agg] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
    })
    .from(schema.storeListingFavorites)
    .where(
      and(
        eq(schema.storeListingFavorites.storeListingId, storeListingId),
        gte(schema.storeListingFavorites.favoriteCreatedAt, since),
      ),
    );
  return Number(agg?.cnt ?? 0);
}

async function fetchRecentReviewSignal(
  db: Database,
  storeListingId: string,
  halfLifeDays: number,
): Promise<number | null> {
  // Pull a generous window — twice the half-life captures ~75% of the signal mass.
  const sinceMs = Date.now() - halfLifeDays * 2 * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs);
  const rows = await db
    .select({
      rating: schema.storeListingReviews.rating,
      reviewCreatedAt: schema.storeListingReviews.reviewCreatedAt,
    })
    .from(schema.storeListingReviews)
    .where(
      and(
        eq(schema.storeListingReviews.storeListingId, storeListingId),
        gte(schema.storeListingReviews.reviewCreatedAt, since),
      ),
    );

  if (rows.length === 0) return null;

  const reviews = rows.map((r) => ({
    rating: r.rating,
    createdAtMs: r.reviewCreatedAt?.getTime?.() ?? 0,
  }));
  return decayedBayesianRating(reviews, halfLifeDays);
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

  const recentRatingHalfLife = trendingRatingRecentHalfLifeDays();
  const velRecentDays = trendingFavoriteVelocityRecentDays();
  const velBaselineDays = trendingFavoriteVelocityBaselineDays();
  const velRecentSince = new Date(
    now.getTime() - velRecentDays * 24 * 60 * 60 * 1000,
  );
  const velBaselineSince = new Date(
    now.getTime() - velBaselineDays * 24 * 60 * 60 * 1000,
  );

  const [
    mention24,
    mention7,
    decayedFav,
    decayedMen,
    recentRatingMean,
    favRecent,
    favBaseline,
  ] = await Promise.all([
    countMentionsSince(db, storeListingId, d24, omitUrlMentions),
    countMentionsSince(db, storeListingId, d7, omitUrlMentions),
    sumDecayedFavorites(db, storeListingId, trendingFavoriteHalfLifeDays()),
    sumDecayedMentions(
      db,
      storeListingId,
      trendingMentionHalfLifeDays(),
      omitUrlMentions,
    ),
    fetchRecentReviewSignal(db, storeListingId, recentRatingHalfLife),
    countFavoritesSince(db, storeListingId, velRecentSince),
    countFavoritesSince(db, storeListingId, velBaselineSince),
  ]);

  const [favRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(schema.storeListingFavorites)
    .where(eq(schema.storeListingFavorites.storeListingId, storeListingId));
  const favoriteCount = Number(favRow?.cnt ?? 0);

  const allTimeBayes = bayesianAverageRating({
    reviewCount: listing.reviewCount,
    averageRating: listing.averageRating,
  });
  const allTime01 = ratingSignalFromAverage(allTimeBayes);
  // Fall back to the all-time signal when there are no in-window reviews so
  // we don't penalize listings whose reviews are simply older than the window.
  const recent01 =
    recentRatingMean == null
      ? allTime01
      : ratingSignalFromAverage(recentRatingMean);
  const rating01 = blendRatingSignals(
    allTime01,
    recent01,
    trendingRatingRecentBlendWeight(),
  );

  const favVel = favoriteVelocitySignal({
    recentCount: favRecent,
    baselineCount: favBaseline,
    recentDays: velRecentDays,
    baselineDays: velBaselineDays,
    prior: trendingFavoriteVelocityPrior(),
    squashK: trendingFavoriteVelocitySquashK(),
  });

  const score = combineTrendingScore({
    decayedFavoriteWeight: decayedFav,
    ratingSignal01: rating01,
    decayedMentionWeight: decayedMen,
    mentionVolume01: mentionVolumeSignal(mention7),
    favoriteVelocity01: favVel,
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
