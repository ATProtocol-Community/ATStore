import { describe, expect, it } from "vitest";

import { getListingLabels } from "./listing-labels";

describe("getListingLabels", () => {
  it("puts the ecosystem category before editorial tags", () => {
    const labels = getListingLabels({
      categorySlugs: ["apps/bluesky/client"],
      appTags: ["social", "video"],
    });

    expect(labels.map((label) => label.kind)).toEqual([
      "category",
      "tag",
      "tag",
    ]);
    expect(labels[0]?.label).toBe("Bluesky › Client");
    expect(labels[1]?.label).toBe("Social");
    expect(labels[1]?.emoji).toBeTruthy();
  });

  it("skips a top-level app's own apps/<name> category", () => {
    const labels = getListingLabels({
      categorySlugs: ["apps/smoke-signal"],
      appTags: ["events"],
    });

    expect(labels.map((label) => label.kind)).toEqual(["tag"]);
  });

  it("returns nothing when there is no category or tag", () => {
    expect(
      getListingLabels({ categorySlugs: ["apps/solo"], appTags: [] }),
    ).toEqual([]);
  });
});
