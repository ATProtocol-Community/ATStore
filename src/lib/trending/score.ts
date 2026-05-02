import {
  trendingFavoriteVelocitySubweight,
  trendingMentionHalfLifeDays,
  trendingRatingPriorMean,
  trendingRatingPriorWeight,
  trendingWeights,
} from "#/lib/trending/config";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `factor = 2^(-age / halfLife)` so at `halfLife` age the weight is 0.5. */
export function decayFactorForAgeMs(
  ageMs: number,
  halfLifeDays: number,
): number {
  if (ageMs <= 0) return 1;
  if (
    !Number.isFinite(ageMs) ||
    !Number.isFinite(halfLifeDays) ||
    halfLifeDays <= 0
  ) {
    return 0;
  }
  const halfLifeMs = halfLifeDays * MS_PER_DAY;
  return Math.pow(2, -ageMs / halfLifeMs);
}

/**
 * Bayesian-smoothed mean on 1–5 scale, shrunk toward prior when n is small.
 */
export function bayesianAverageRating(input: {
  reviewCount: number;
  averageRating: number | null;
}): number {
  const n = input.reviewCount;
  const prior = trendingRatingPriorMean();
  const w = trendingRatingPriorWeight();
  if (
    n <= 0 ||
    input.averageRating == null ||
    Number.isNaN(input.averageRating)
  ) {
    return prior;
  }
  return (input.averageRating * n + prior * w) / (n + w);
}

/** Map 1–5 mean to [0,1]. */
export function ratingSignalFromAverage(mean15: number): number {
  const clamped = Math.min(5, Math.max(1, mean15));
  return (clamped - 1) / 4;
}

/**
 * Bayesian-smoothed mean (1–5 scale) where each review's contribution is
 * weighted by `2^(-age / halfLife)`. Returns the prior when no usable rows.
 */
export function decayedBayesianRating(
  reviews: ReadonlyArray<{ rating: number; createdAtMs: number }>,
  halfLifeDays: number,
  nowMs: number = Date.now(),
): number {
  const prior = trendingRatingPriorMean();
  const w = trendingRatingPriorWeight();

  let weightSum = 0;
  let weightedRatingSum = 0;
  for (const r of reviews) {
    if (
      !Number.isFinite(r.rating) ||
      !Number.isFinite(r.createdAtMs) ||
      r.rating < 1 ||
      r.rating > 5
    ) {
      continue;
    }
    const decay = decayFactorForAgeMs(nowMs - r.createdAtMs, halfLifeDays);
    if (decay <= 0) continue;
    weightSum += decay;
    weightedRatingSum += decay * r.rating;
  }

  if (weightSum <= 0) return prior;
  return (weightedRatingSum + prior * w) / (weightSum + w);
}

/** Linear blend of two `[0,1]` signals. */
export function blendRatingSignals(
  allTime01: number,
  recent01: number,
  recentWeight: number,
): number {
  const rw = Math.min(1, Math.max(0, recentWeight));
  return (1 - rw) * allTime01 + rw * recent01;
}

/**
 * Smoothed favorite-velocity signal in [0,1].
 *
 * `recent` and `baseline` are raw counts over their respective windows.
 * Both are normalized to a per-day rate, the prior is added to the baseline
 * rate to dampen low-N noise, and the resulting ratio is `log1p`-squashed.
 */
export function favoriteVelocitySignal(input: {
  recentCount: number;
  baselineCount: number;
  recentDays: number;
  baselineDays: number;
  prior: number;
  squashK: number;
}): number {
  const recentDays = Math.max(0.0001, input.recentDays);
  const baselineDays = Math.max(0.0001, input.baselineDays);
  const recentRate = Math.max(0, input.recentCount) / recentDays;
  const baselineRate = Math.max(0, input.baselineCount) / baselineDays;
  const prior = Math.max(0, input.prior);
  const k = Math.max(0.0001, input.squashK);

  const ratio = recentRate / (baselineRate + prior);
  const sig = Math.log1p(Math.max(0, ratio)) / Math.log1p(k);
  return Math.min(1, Math.max(0, sig));
}

export type TrendingParts = {
  decayedFavoriteWeight: number;
  /** Already-blended (all-time + recent) rating in [0,1]. */
  ratingSignal01: number;
  decayedMentionWeight: number;
  /** log1p(mentionCount7d) / log1p(50) capped — light boost for sustained buzz */
  mentionVolume01: number;
  /** Smoothed favorite growth ratio in [0,1] (defaults to 0 if absent). */
  favoriteVelocity01?: number;
};

/**
 * Combined score (roughly 0–100) from normalized parts and weights.
 */
export function combineTrendingScore(parts: TrendingParts): number {
  const w = trendingWeights();
  const sumW = w.favorite + w.rating + w.mention;
  const norm = sumW > 0 ? sumW : 1;

  const fav01 = Math.min(1, parts.decayedFavoriteWeight / 25);
  const men01 = Math.min(1, parts.decayedMentionWeight / 35);
  const vol = Math.min(1, parts.mentionVolume01);
  const favVel = Math.min(1, Math.max(0, parts.favoriteVelocity01 ?? 0));

  const velSub = trendingFavoriteVelocitySubweight();
  const favTerm = (1 - velSub) * fav01 + velSub * favVel;

  const combined =
    (w.favorite * favTerm +
      w.rating * parts.ratingSignal01 +
      w.mention * (0.75 * men01 + 0.25 * vol)) /
    norm;

  return Math.round(combined * 1000) / 10;
}

export function mentionVolumeSignal(mentionCount7d: number): number {
  const n = Math.max(0, mentionCount7d);
  return Math.log1p(n) / Math.log1p(50);
}

export function defaultMentionHalfLifeDays(): number {
  return trendingMentionHalfLifeDays();
}
