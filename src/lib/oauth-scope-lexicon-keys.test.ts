import { describe, expect, it } from "vitest";

import type { SummaryScopeHumanRow } from "./oauth-listing-auth-probe";

import { PERMISSION_GRANT_RECORDS_LIST_LABEL } from "./oauth-permission-grant-ui";
import {
  extractLexiconKeysFromOAuthScopeTokens,
  extractOAuthLexiconKeysForStorefrontProbe,
  filterLexiconKeysForCrossAppMatching,
  formatLexiconClusterPageTitle,
  formatLexiconNsidRecordTitle,
  formatOAuthLexiconKeyClusterStyleHeadline,
  formatOAuthLexiconKeyHeadline,
  isAppBskyOAuthLexiconKey,
  isBareWildcardOAuthLexiconNsid,
  isRepoLexiconKeyForLexiconHub,
  parseOAuthLexiconKey,
  pickPrimaryOAuthLexiconBrowseKey,
  stringifyLexiconClusterSearchParam,
  tryParseLexiconClusterSearchParam,
} from "./oauth-scope-lexicon-keys";

describe("isBareWildcardOAuthLexiconNsid", () => {
  it("is true only for a lone asterisk", () => {
    expect(isBareWildcardOAuthLexiconNsid("*")).toBe(true);
    expect(isBareWildcardOAuthLexiconNsid(" * ")).toBe(true);
    expect(isBareWildcardOAuthLexiconNsid("com.example.*")).toBe(false);
    expect(isBareWildcardOAuthLexiconNsid("")).toBe(false);
  });
});

describe("filterLexiconKeysForCrossAppMatching", () => {
  it("drops keys whose NSID is only *", () => {
    expect(
      filterLexiconKeysForCrossAppMatching(
        ["repo:*", "repo:site.standard.document"],
        { isBlueskyPlatformListing: false },
      ),
    ).toEqual(["repo:site.standard.document"]);
  });

  it("drops app.bsky.* keys for normal listings", () => {
    expect(
      filterLexiconKeysForCrossAppMatching(
        ["repo:app.bsky.actor.profile", "repo:site.standard.document"],
        { isBlueskyPlatformListing: false },
      ),
    ).toEqual(["repo:site.standard.document"]);
  });

  it("keeps app.bsky.* keys for the Bluesky platform listing", () => {
    expect(
      filterLexiconKeysForCrossAppMatching(
        ["repo:app.bsky.actor.profile", "repo:site.standard.document"],
        { isBlueskyPlatformListing: true },
      ),
    ).toEqual(["repo:app.bsky.actor.profile", "repo:site.standard.document"]);
  });
});

describe("isAppBskyOAuthLexiconKey", () => {
  it("detects repo keys in the Bluesky namespace", () => {
    expect(isAppBskyOAuthLexiconKey("repo:app.bsky.feed.post")).toBe(true);
    expect(isAppBskyOAuthLexiconKey("repo:site.standard.document")).toBe(false);
  });
});

describe("extractOAuthLexiconKeysForStorefrontProbe", () => {
  it("adds repo NSIDs from resolved include bundle checklists", () => {
    const scopeHumanReadable: Array<SummaryScopeHumanRow> = [
      {
        token: "include:leaflet.standard.auth",
        description: "test",
        includePermissionSet: {
          resolved: true,
          nsid: "leaflet.standard.auth",
          sourceKind: "remote",
          sourceUrl: "https://example.com/lexicons/leaflet.standard.auth.json",
          structuredLines: [
            {
              kind: "unorderedList",
              label: PERMISSION_GRANT_RECORDS_LIST_LABEL,
              items: ["site.standard.document", "site.standard.publication"],
            },
          ],
        },
      },
    ];
    expect(
      extractOAuthLexiconKeysForStorefrontProbe({
        oauthScopesDistinct: ["include:leaflet.standard.auth"],
        scopeHumanReadable,
      }),
    ).toEqual([
      "include:leaflet.standard.auth",
      "repo:site.standard.document",
      "repo:site.standard.publication",
    ]);
  });
});

describe("extractLexiconKeysFromOAuthScopeTokens", () => {
  it("omits repo collection *", () => {
    expect(
      extractLexiconKeysFromOAuthScopeTokens([
        "repo?collection=*&action=read",
        "repo?collection=com.example.foo",
      ]).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["repo:com.example.foo"]);
  });

  it("collects include colon and query forms into the same key", () => {
    expect(
      extractLexiconKeysFromOAuthScopeTokens([
        "include:fyi.atstore.authBasic",
        "include?nsid=app.bsky.feed.post",
      ]).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["include:app.bsky.feed.post", "include:fyi.atstore.authBasic"]);
  });

  it("collects repo collection NSIDs", () => {
    expect(
      extractLexiconKeysFromOAuthScopeTokens([
        "repo?collection=com.example.foo&collection=com.example.bar&action=read",
      ]),
    ).toEqual(["repo:com.example.bar", "repo:com.example.foo"]);
  });

  it("collects rpc lxm NSIDs", () => {
    expect(
      extractLexiconKeysFromOAuthScopeTokens([
        "rpc?lxm=com.atproto.identity.resolveHandle",
      ]),
    ).toEqual(["rpc:com.atproto.identity.resolveHandle"]);
  });
});

describe("parseOAuthLexiconKey", () => {
  it("parses include keys", () => {
    expect(parseOAuthLexiconKey("include:fyi.atstore.authBasic")).toEqual({
      kind: "include",
      nsid: "fyi.atstore.authBasic",
    });
  });
});

describe("pickPrimaryOAuthLexiconBrowseKey", () => {
  it("prefers include keys over repo/rpc", () => {
    expect(
      pickPrimaryOAuthLexiconBrowseKey([
        "repo:com.example.a",
        "include:fyi.b",
        "rpc:com.example.c",
      ]),
    ).toBe("include:fyi.b");
  });
});

describe("formatLexiconNsidRecordTitle", () => {
  it("uses the last segment with camelCase split and title case", () => {
    expect(formatLexiconNsidRecordTitle("at.margin.someThing")).toBe(
      "Some Thing",
    );
  });

  it("title-cases a single plain last segment", () => {
    expect(formatLexiconNsidRecordTitle("site.standard.document")).toBe(
      "Document",
    );
  });

  it("splits authBasic-style tails", () => {
    expect(formatLexiconNsidRecordTitle("fyi.atstore.authBasic")).toBe(
      "Auth Basic",
    );
  });
});

describe("formatOAuthLexiconKeyHeadline", () => {
  it("strips repo prefix and formats the NSID tail", () => {
    expect(formatOAuthLexiconKeyHeadline("repo:at.margin.someThing")).toBe(
      "Some Thing",
    );
  });

  it("falls back to the raw key when unparsable", () => {
    expect(formatOAuthLexiconKeyHeadline("not-a-key")).toBe("not-a-key");
  });
});

describe("formatOAuthLexiconKeyClusterStyleHeadline", () => {
  it("uses Standard.Site-style producer dot plus record name", () => {
    expect(
      formatOAuthLexiconKeyClusterStyleHeadline("repo:site.standard.document"),
    ).toBe("Standard.Site Document");
  });

  it("uses only producer dot for two-segment NSIDs", () => {
    expect(formatOAuthLexiconKeyClusterStyleHeadline("repo:fyi.atstore")).toBe(
      "Atstore.Fyi",
    );
  });

  it("handles app.bsky tails", () => {
    expect(
      formatOAuthLexiconKeyClusterStyleHeadline("repo:app.bsky.actor.profile"),
    ).toBe("Bsky.App Profile");
  });
});

describe("formatLexiconClusterPageTitle", () => {
  it("joins and truncates", () => {
    expect(
      formatLexiconClusterPageTitle([
        "repo:site.standard.document",
        "repo:site.standard.publication",
      ]),
    ).toBe("Standard.Site Document · Standard.Site Publication");
    expect(
      formatLexiconClusterPageTitle(["repo:a.b.c", "repo:a.b.d", "repo:a.b.e"]),
    ).toBe("B.A C · B.A D +1");
  });
});

describe("tryParseLexiconClusterSearchParam", () => {
  it("round-trips hub keys", () => {
    const keys = ["repo:com.example.a", "repo:com.example.b"];
    const raw = stringifyLexiconClusterSearchParam(keys);
    expect(tryParseLexiconClusterSearchParam(raw)).toEqual(
      keys.toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it("keeps only repo hub-eligible keys", () => {
    const raw = stringifyLexiconClusterSearchParam(["repo:com.example.a"]);
    const parsed = JSON.parse(raw) as { v: number; keys: Array<string> };
    parsed.keys.push("include:foo", "repo:app.bsky.feed.post");
    expect(tryParseLexiconClusterSearchParam(JSON.stringify(parsed))).toEqual(
      ["repo:com.example.a", "repo:app.bsky.feed.post"].toSorted((a, b) =>
        a.localeCompare(b),
      ),
    );
  });

  it("returns null on garbage", () => {
    expect(tryParseLexiconClusterSearchParam("")).toBeNull();
    expect(tryParseLexiconClusterSearchParam("{}")).toBeNull();
    expect(tryParseLexiconClusterSearchParam('{"v":1,"keys":[]}')).toBeNull();
  });
});

describe("isRepoLexiconKeyForLexiconHub", () => {
  it("matches repo keys including app.bsky; not include or repo:*", () => {
    expect(isRepoLexiconKeyForLexiconHub("repo:com.example.foo")).toBe(true);
    expect(isRepoLexiconKeyForLexiconHub("repo:app.bsky.actor.profile")).toBe(
      true,
    );
    expect(isRepoLexiconKeyForLexiconHub("include:fyi.atstore.authBasic")).toBe(
      false,
    );
    expect(isRepoLexiconKeyForLexiconHub("repo:*")).toBe(false);
  });
});
