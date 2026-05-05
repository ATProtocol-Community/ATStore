import { describe, expect, it } from "vitest";

import { getLexiconProducerSiteFromRepoNsid } from "./lexicon-producer-site";

describe("getLexiconProducerSiteFromRepoNsid", () => {
  it("maps site.standard.* to standard.site", () => {
    expect(
      getLexiconProducerSiteFromRepoNsid("site.standard.document"),
    ).toEqual({
      groupKey: "site.standard",
      siteLabel: "standard.site",
      siteOrigin: "https://standard.site",
    });
  });

  it("uses two-part NSID as full authority", () => {
    expect(getLexiconProducerSiteFromRepoNsid("fyi.atstore")).toEqual({
      groupKey: "fyi.atstore",
      siteLabel: "atstore.fyi",
      siteOrigin: "https://atstore.fyi",
    });
  });

  it("groups and links from the first two NSID segments only", () => {
    expect(
      getLexiconProducerSiteFromRepoNsid("app.bsky.actor.profile"),
    ).toEqual({
      groupKey: "app.bsky",
      siteLabel: "bsky.app",
      siteOrigin: "https://bsky.app",
    });
  });
});
