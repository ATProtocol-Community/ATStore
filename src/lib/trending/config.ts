/**
 * Trending score + Jetstream mention tuning (env-driven).
 */

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** When false, directory "popular" sort falls back to `updatedAt` (legacy). Default: enabled. */
export function trendingScoreSortEnabled(): boolean {
  return process.env.TRENDING_SCORE_ENABLED?.trim().toLowerCase() !== "false";
}

export function trendingWeights() {
  return {
    favorite: envFloat("TRENDING_WEIGHT_FAVORITE", 0.35),
    rating: envFloat("TRENDING_WEIGHT_RATING", 0.35),
    mention: envFloat("TRENDING_WEIGHT_MENTION", 0.3),
  };
}

/** Half-life in days for exponential decay of favorite timestamps. */
export function trendingFavoriteHalfLifeDays(): number {
  return envFloat("TRENDING_FAVORITE_HALF_LIFE_DAYS", 10);
}

/** Half-life in days for mention post timestamps. */
export function trendingMentionHalfLifeDays(): number {
  return envFloat("TRENDING_MENTION_HALF_LIFE_DAYS", 7);
}

/** Bayesian prior mean (1–5 scale) when review count is low. */
export function trendingRatingPriorMean(): number {
  return envFloat("TRENDING_RATING_PRIOR_MEAN", 3.25);
}

export function trendingRatingPriorWeight(): number {
  return envFloat("TRENDING_RATING_PRIOR_WEIGHT", 4);
}

/** Max age in days for rows included in decayed sums (performance bound). */
export function trendingDecayWindowDays(): number {
  return envInt("TRENDING_DECAY_WINDOW_DAYS", 90);
}
