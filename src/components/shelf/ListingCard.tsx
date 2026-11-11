import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";

import { animationDuration } from "../../design-system/theme/animations.stylex";
import { uiColor } from "../../design-system/theme/color.stylex";
import { shadow } from "../../design-system/theme/shadow.stylex";
import { fontWeight } from "../../design-system/theme/typography.stylex";
import { formatAppTagLabel } from "../../lib/app-tag-metadata";
import { getDirectoryListingSlug } from "../../lib/directory-listing-slugs";
import { ListingIcon } from "./ListingIcon";
import { ListingRating } from "./ListingRating";

const styles = stylex.create({
  card: {
    padding: 20,
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    boxShadow: { default: shadow.none, ":hover": shadow.md },
    color: "inherit",
    columnGap: 16,
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 16,
    transform: { default: null, ":hover": "translateY(-2px)" },
    transitionDuration: animationDuration.slow,
    transitionProperty: "border-color, box-shadow, transform",
    minWidth: 0,
  },
  name: {
    overflow: "hidden",
    color: uiColor.text2,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.01em",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagline: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 14,
    lineHeight: 1.45,
    marginTop: 4,
  },
  foot: {
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 8,
    display: "flex",
    fontSize: 13,
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: "auto",
  },
  tag: {
    borderRadius: 999,
    overflow: "hidden",
    paddingBlock: 2,
    paddingInline: 8,
    backgroundColor: uiColor.component1,
    color: uiColor.text2,
    fontSize: 12,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export type CardListing = {
  name: string;
  slug?: string | null;
  iconUrl: string | null;
  tagline: string;
  rating: number | string | null;
  reviewCount: number;
  appTags?: Array<string>;
  listingType?: string | null;
};

/**
 * Text-first listing card: icon, name, two-line tagline, and a footer with the
 * rating (or a custom `meta`, e.g. "Added today") and the first tag.
 */
export function ListingCard({
  listing,
  meta,
}: {
  listing: CardListing;
  /** Replaces the rating in the footer. */
  meta?: ReactNode;
}) {
  const tag =
    listing.listingType === "game"
      ? "Game"
      : listing.appTags?.[0]
        ? formatAppTagLabel(listing.appTags[0])
        : null;

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.card)}
    >
      <ListingIcon name={listing.name} src={listing.iconUrl} size={52} />
      <div>
        <div {...stylex.props(styles.name)}>{listing.name}</div>
        <div {...stylex.props(styles.tagline)}>{listing.tagline}</div>
      </div>
      <div {...stylex.props(styles.foot)}>
        {meta ?? (
          <ListingRating
            rating={listing.rating}
            reviewCount={listing.reviewCount}
          />
        )}
        {tag ? <span {...stylex.props(styles.tag)}>{tag}</span> : null}
      </div>
    </RouterLink>
  );
}
