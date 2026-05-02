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
import { describe, expect, it } from "vitest";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("decayFactorForAgeMs", () => {
  it("is 1 at age 0", () => {
    expect(decayFactorForAgeMs(0, 7)).toBe(1);
  });

  it("halves near one half-life", () => {
    const halfLifeMs = 7 * 24 * 60 * 60 * 1000;
    const f = decayFactorForAgeMs(halfLifeMs, 7);
    expect(f).toBeCloseTo(0.5, 5);
  });
});

describe("bayesianAverageRating", () => {
  it("returns prior when no reviews", () => {
    const v = bayesianAverageRating({ reviewCount: 0, averageRating: null });
    expect(v).toBeGreaterThan(1);
    expect(v).toBeLessThan(5);
  });
});

describe("combineTrendingScore", () => {
  it("returns a bounded score", () => {
    const s = combineTrendingScore({
      decayedFavoriteWeight: 10,
      ratingSignal01: 0.8,
      decayedMentionWeight: 5,
      mentionVolume01: 0.5,
    });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("mentionVolumeSignal", () => {
  it("increases with count", () => {
    expect(mentionVolumeSignal(10)).toBeGreaterThan(mentionVolumeSignal(0));
  });
});

describe("ratingSignalFromAverage", () => {
  it("maps 1–5 to 0–1", () => {
    expect(ratingSignalFromAverage(1)).toBe(0);
    expect(ratingSignalFromAverage(5)).toBe(1);
  });
});

describe("decayedBayesianRating", () => {
  const now = Date.UTC(2024, 0, 1, 0, 0, 0);

  it("returns the prior when no reviews are provided", () => {
    const v = decayedBayesianRating([], 30, now);
    expect(v).toBeGreaterThan(1);
    expect(v).toBeLessThan(5);
  });

  it("weights recent reviews more heavily than old ones", () => {
    const halfLife = 30;
    const recentLow = decayedBayesianRating(
      [
        { rating: 5, createdAtMs: now - 365 * DAY_MS }, // very old 5★
        { rating: 1, createdAtMs: now - 1 * DAY_MS }, // fresh 1★
      ],
      halfLife,
      now,
    );
    const recentHigh = decayedBayesianRating(
      [
        { rating: 1, createdAtMs: now - 365 * DAY_MS }, // very old 1★
        { rating: 5, createdAtMs: now - 1 * DAY_MS }, // fresh 5★
      ],
      halfLife,
      now,
    );
    expect(recentLow).toBeLessThan(recentHigh);
  });

  it("ignores out-of-range ratings", () => {
    const v = decayedBayesianRating(
      [
        { rating: 0, createdAtMs: now },
        { rating: 99, createdAtMs: now },
      ],
      30,
      now,
    );
    // No usable reviews → falls back to the prior.
    const prior = decayedBayesianRating([], 30, now);
    expect(v).toBe(prior);
  });
});

describe("blendRatingSignals", () => {
  it("returns the all-time signal when recent weight is 0", () => {
    expect(blendRatingSignals(0.2, 0.9, 0)).toBeCloseTo(0.2, 6);
  });

  it("returns the recent signal when recent weight is 1", () => {
    expect(blendRatingSignals(0.2, 0.9, 1)).toBeCloseTo(0.9, 6);
  });

  it("clamps the blend weight to [0,1]", () => {
    expect(blendRatingSignals(0.2, 0.9, -1)).toBeCloseTo(0.2, 6);
    expect(blendRatingSignals(0.2, 0.9, 5)).toBeCloseTo(0.9, 6);
  });
});

describe("favoriteVelocitySignal", () => {
  const base = {
    recentDays: 3,
    baselineDays: 30,
    prior: 1,
    squashK: 4,
  };

  it("is 0 when no recent activity", () => {
    expect(
      favoriteVelocitySignal({
        ...base,
        recentCount: 0,
        baselineCount: 50,
      }),
    ).toBe(0);
  });

  it("is bounded in [0,1]", () => {
    const sig = favoriteVelocitySignal({
      ...base,
      recentCount: 1000,
      baselineCount: 0,
    });
    expect(sig).toBeGreaterThanOrEqual(0);
    expect(sig).toBeLessThanOrEqual(1);
  });

  it("is dampened on small samples by the prior", () => {
    // Cold-start: 3 favs in 3 days vs 0 baseline. Prior keeps it well below 1.
    const sig = favoriteVelocitySignal({
      ...base,
      recentCount: 3,
      baselineCount: 0,
    });
    expect(sig).toBeLessThan(0.6);
  });

  it("rewards growth over a steady baseline", () => {
    const flat = favoriteVelocitySignal({
      ...base,
      recentCount: 5, // ~1.67/day
      baselineCount: 50, // ~1.67/day
    });
    const accelerating = favoriteVelocitySignal({
      ...base,
      recentCount: 30, // ~10/day
      baselineCount: 50, // ~1.67/day baseline
    });
    expect(accelerating).toBeGreaterThan(flat);
  });
});

describe("combineTrendingScore — favorite velocity", () => {
  it("raises the score when velocity is high, all else equal", () => {
    const baseline = combineTrendingScore({
      decayedFavoriteWeight: 5,
      ratingSignal01: 0.5,
      decayedMentionWeight: 5,
      mentionVolume01: 0.2,
      favoriteVelocity01: 0,
    });
    const accelerating = combineTrendingScore({
      decayedFavoriteWeight: 5,
      ratingSignal01: 0.5,
      decayedMentionWeight: 5,
      mentionVolume01: 0.2,
      favoriteVelocity01: 1,
    });
    expect(accelerating).toBeGreaterThan(baseline);
  });
});
