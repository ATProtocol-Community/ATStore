import {
  trendingMentionHalfLifeDays,
  trendingRatingPriorMean,
  trendingRatingPriorWeight,
  trendingWeights,
} from '#/lib/trending/config'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** `factor = 2^(-age / halfLife)` so at `halfLife` age the weight is 0.5. */
export function decayFactorForAgeMs(ageMs: number, halfLifeDays: number): number {
  if (ageMs <= 0) return 1
  if (!Number.isFinite(ageMs) || !Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return 0
  }
  const halfLifeMs = halfLifeDays * MS_PER_DAY
  return Math.pow(2, -ageMs / halfLifeMs)
}

/**
 * Bayesian-smoothed mean on 1–5 scale, shrunk toward prior when n is small.
 */
export function bayesianAverageRating(input: {
  reviewCount: number
  averageRating: number | null
}): number {
  const n = input.reviewCount
  const prior = trendingRatingPriorMean()
  const w = trendingRatingPriorWeight()
  if (n <= 0 || input.averageRating == null || Number.isNaN(input.averageRating)) {
    return prior
  }
  return (input.averageRating * n + prior * w) / (n + w)
}

/** Map 1–5 mean to [0,1]. */
export function ratingSignalFromAverage(mean15: number): number {
  const clamped = Math.min(5, Math.max(1, mean15))
  return (clamped - 1) / 4
}

export type TrendingParts = {
  decayedFavoriteWeight: number
  ratingSignal01: number
  decayedMentionWeight: number
  /** log1p(mentionCount7d) / log1p(50) capped — light boost for sustained buzz */
  mentionVolume01: number
}

/**
 * Combined score (roughly 0–100) from normalized parts and weights.
 */
export function combineTrendingScore(parts: TrendingParts): number {
  const w = trendingWeights()
  const sumW = w.favorite + w.rating + w.mention
  const norm = sumW > 0 ? sumW : 1

  const fav01 = Math.min(1, parts.decayedFavoriteWeight / 25)
  const men01 = Math.min(1, parts.decayedMentionWeight / 35)
  const vol = Math.min(1, parts.mentionVolume01)

  const combined =
    (w.favorite * fav01 +
      w.rating * parts.ratingSignal01 +
      w.mention * (0.75 * men01 + 0.25 * vol)) /
    norm

  return Math.round(combined * 1000) / 10
}

export function mentionVolumeSignal(mentionCount7d: number): number {
  const n = Math.max(0, mentionCount7d)
  return Math.log1p(n) / Math.log1p(50)
}

export function defaultMentionHalfLifeDays(): number {
  return trendingMentionHalfLifeDays()
}
