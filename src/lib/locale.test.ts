import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  matchAcceptLanguage,
  parseLocale,
} from "./locale";

describe("isLocale", () => {
  it("accepts supported locales", () => {
    for (const l of LOCALES) expect(isLocale(l)).toBe(true);
  });
  it("rejects unsupported and non-strings", () => {
    expect(isLocale("not-a-locale")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("parseLocale", () => {
  it("returns default for unknown values", () => {
    expect(parseLocale("zz")).toBe(DEFAULT_LOCALE);
    expect(parseLocale(null)).toBe(DEFAULT_LOCALE);
  });
  it("passes through supported values", () => {
    expect(parseLocale("en-XA")).toBe("en-XA");
  });
});

describe("matchAcceptLanguage", () => {
  it("falls back to default with no header", () => {
    expect(matchAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(matchAcceptLanguage("")).toBe(DEFAULT_LOCALE);
  });
  it("matches exact tag", () => {
    expect(matchAcceptLanguage("en-XA")).toBe("en-XA");
  });
  it("matches base tag (en-US -> en)", () => {
    expect(matchAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });
  it("respects q-values when picking", () => {
    expect(matchAcceptLanguage("fr;q=0.9,en;q=1.0")).toBe("en");
  });
  it("falls back to default when no entry matches", () => {
    expect(matchAcceptLanguage("fr,de")).toBe(DEFAULT_LOCALE);
  });
});
