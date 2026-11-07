import { formatAppTagLabel } from "./app-tag-metadata";
import { getAppTagEmoji } from "./app-tag-visuals";
import { getBrowseCategoryLabel } from "./browse-listings";

export interface ListingLabel {
  key: string;
  kind: "category" | "tag";
  label: string;
  emoji?: string;
}

/**
 * Display labels for an app, in the order browse shows them: the ecosystem
 * category first, then editorial app tags.
 *
 * Top-level apps sit in their own `apps/<name>` category, which adds nothing
 * as a label, so only ecosystem tools and protocol categories are included.
 */
export function getListingLabels(listing: {
  categorySlugs: Array<string>;
  appTags: Array<string>;
}): Array<ListingLabel> {
  const category = listing.categorySlugs.find(
    (slug) => !(slug.startsWith("apps/") && slug.split("/").length === 2),
  );

  return [
    ...(category
      ? [
          {
            key: `category:${category}`,
            kind: "category" as const,
            label: getBrowseCategoryLabel(category),
          },
        ]
      : []),
    ...listing.appTags.map((tag) => ({
      key: `tag:${tag}`,
      kind: "tag" as const,
      label: formatAppTagLabel(tag),
      emoji: getAppTagEmoji(tag),
    })),
  ];
}
