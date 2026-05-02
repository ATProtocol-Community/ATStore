import { describe, expect, it } from "vitest";

import {
  bayesianAverageRating,
  combineTrendingScore,
  decayFactorForAgeMs,
  mentionVolumeSignal,
  ratingSignalFromAverage,
} from "#/lib/trending/score";

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
