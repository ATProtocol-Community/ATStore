import {
  EMAIL_SCOPE,
  hasEmailScope,
  resolveRequestScope,
} from "#/integrations/auth/scope";
import { describe, expect, it } from "vitest";

import { isDigestEmpty, toDigestApp } from "./builder";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

describe("unsubscribe tokens", () => {
  it("round-trips the user id", () => {
    const token = makeUnsubscribeToken("user-123");
    expect(verifyUnsubscribeToken(token)).toBe("user-123");
  });

  it("rejects a token signed for a different user", () => {
    const [, sig] = makeUnsubscribeToken("user-123").split(".");
    expect(verifyUnsubscribeToken(`user-456.${sig}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("no-signature")).toBeNull();
    expect(verifyUnsubscribeToken(".sig")).toBeNull();
  });
});

describe("resolveRequestScope", () => {
  const metadata = `atproto include:fyi.atstore.authBasic ${EMAIL_SCOPE}`;

  it("drops the email scope unless the user opted in", () => {
    expect(resolveRequestScope(metadata, { email: false })).toBe(
      "atproto include:fyi.atstore.authBasic",
    );
    expect(resolveRequestScope(metadata, { email: true })).toBe(metadata);
  });

  it("detects a granted email scope", () => {
    expect(hasEmailScope(metadata)).toBe(true);
    expect(hasEmailScope("atproto")).toBe(false);
    expect(hasEmailScope(null)).toBe(false);
  });
});

describe("toDigestApp", () => {
  const row = {
    id: "1",
    name: "Skylight",
    slug: "skylight",
    tagline: "Short-form video",
    fullDescription: null,
    iconUrl: "https://cdn.example/icon.png",
    reviewCount: 3,
    averageRating: 4.333,
  };

  it("builds an absolute product URL and rounds the rating", () => {
    const app = toDigestApp(row, "https://atstore.fyi");
    expect(app.url).toBe("https://atstore.fyi/products/skylight");
    expect(app.rating).toBe(4.3);
    expect(app.iconUrl).toBe("https://cdn.example/icon.png");
  });

  it("omits the rating with no reviews and drops non-https icons", () => {
    const app = toDigestApp(
      { ...row, reviewCount: 0, iconUrl: "/generated/x.png" },
      "https://atstore.fyi",
    );
    expect(app.rating).toBeNull();
    expect(app.iconUrl).toBeNull();
  });

  it("treats a digest with no apps as empty", () => {
    expect(isDigestEmpty({ newApps: [], trendingApps: [] })).toBe(true);
  });
});
