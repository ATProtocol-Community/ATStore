import { describe, expect, it } from "vitest";

import { REFERRER_DID_PARAM, withReferrerDid } from "./referrer-did-url";

const DID = "did:plc:abc123";

describe("withReferrerDid", () => {
  it("appends the did to a bare https URL", () => {
    expect(withReferrerDid("https://app.example", DID)).toBe(
      `https://app.example/?${REFERRER_DID_PARAM}=did%3Aplc%3Aabc123`,
    );
  });

  it("preserves existing query params and hash", () => {
    expect(withReferrerDid("https://app.example/x?a=1#top", DID)).toBe(
      `https://app.example/x?a=1&${REFERRER_DID_PARAM}=did%3Aplc%3Aabc123#top`,
    );
  });

  it("overwrites a stale referrer_did", () => {
    expect(
      withReferrerDid(`https://app.example/?${REFERRER_DID_PARAM}=old`, DID),
    ).toBe(`https://app.example/?${REFERRER_DID_PARAM}=did%3Aplc%3Aabc123`);
  });

  it("returns the URL unchanged when there is no did", () => {
    const noDid: string | undefined = undefined;
    expect(withReferrerDid("https://app.example", null)).toBe(
      "https://app.example",
    );
    expect(withReferrerDid("https://app.example", noDid)).toBe(
      "https://app.example",
    );
  });

  it("leaves non-http(s) and unparseable URLs alone", () => {
    expect(withReferrerDid("mailto:hi@example.com", DID)).toBe(
      "mailto:hi@example.com",
    );
    expect(withReferrerDid("/relative/path", DID)).toBe("/relative/path");
  });

  it("returns undefined for empty input", () => {
    expect(withReferrerDid(null, DID)).toBeUndefined();
    expect(withReferrerDid(undefined, DID)).toBeUndefined();
    expect(withReferrerDid("", DID)).toBeUndefined();
  });
});
