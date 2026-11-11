import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { animationDuration } from "../../design-system/theme/animations.stylex";
import { uiColor } from "../../design-system/theme/color.stylex";
import { breakpoints } from "../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../design-system/theme/typography.stylex";
import { getDirectoryListingSlug } from "../../lib/directory-listing-slugs";
import { getListingLabels } from "../../lib/listing-labels";
import { formatTimeAgo } from "./format";
import { ListingIcon } from "./ListingIcon";
import { ListingRating } from "./ListingRating";

export type RowListing = {
  name: string;
  slug?: string | null;
  iconUrl: string | null;
  tagline: string;
  rating: number | string | null;
  reviewCount: number;
  productAccountHandle?: string | null;
  categorySlugs?: Array<string>;
  appTags?: Array<string>;
  updatedAt?: string;
};

const styles = stylex.create({
  row: {
    borderRadius: 12,
    marginInline: -12,
    paddingBlock: 14,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    color: "inherit",
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto 18px",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color",
    // Hairline between rows, inset to the content so hover can bleed past it.
    "::before": {
      insetInline: 12,
      backgroundColor: uiColor.border1,
      content: "''",
      position: "absolute",
      height: 1,
      top: 0,
    },
  },
  ranked: {
    gridTemplateColumns: "28px auto minmax(0, 1fr) auto 18px",
  },
  rank: {
    color: uiColor.text1,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.03em",
  },
  body: {
    columnGap: 3,
    display: "flex",
    flexDirection: "column",
    rowGap: 3,
    minWidth: 0,
  },
  top: {
    alignItems: "baseline",
    columnGap: 8,
    display: "flex",
    rowGap: 8,
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
  handle: {
    overflow: "hidden",
    color: uiColor.text1,
    display: { default: "none", [breakpoints.sm]: "block" },
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 14,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chips: {
    columnGap: 6,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 6,
    marginTop: 5,
  },
  chip: {
    borderRadius: 999,
    paddingInline: 9,
    alignItems: "center",
    backgroundColor: uiColor.component1,
    color: uiColor.text2,
    display: "inline-flex",
    fontSize: 12,
    whiteSpace: "nowrap",
    height: 24,
  },
  aside: {
    alignItems: "flex-end",
    columnGap: 4,
    display: { default: "none", [breakpoints.md]: "flex" },
    flexDirection: "column",
    fontSize: 13,
    rowGap: 4,
  },
  // Compact rows only show the short rating, so it fits on phones too.
  asideCompact: {
    display: "flex",
  },
  muted: {
    color: uiColor.text1,
    whiteSpace: "nowrap",
  },
  chevron: {
    color: {
      default: uiColor.border3,
      [stylex.when.ancestor(":hover")]: uiColor.text2,
    },
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "translateX(2px)",
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "color, transform",
  },
});

/**
 * One listing as a list row: icon, name and handle, tagline, optional label
 * chips, and rating / last update on the right. The whole row is the link.
 *
 * Variants: `detailed` (Browse) shows chips and "Updated …"; `compact` is a
 * single-line row for side-by-side lists; `rank` adds a leading number.
 */
export function ListingRow({
  listing,
  rank,
  variant = "detailed",
  badge,
  byline,
}: {
  listing: RowListing;
  rank?: number;
  variant?: "detailed" | "compact";
  badge?: ReactNode;
  /** Replaces the @handle beside the name (e.g. a game's developer). */
  byline?: string | null;
}) {
  const detailed = variant === "detailed";
  const handle = listing.productAccountHandle?.replace(/^@/, "");
  const aside = byline ?? (handle ? `@${handle}` : null);
  const labels =
    detailed && listing.categorySlugs && listing.appTags
      ? getListingLabels({
          categorySlugs: listing.categorySlugs,
          appTags: listing.appTags,
        }).slice(0, 3)
      : [];

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.row, rank != null && styles.ranked)}
    >
      {rank == null ? null : (
        <span aria-hidden {...stylex.props(styles.rank)}>
          {rank}
        </span>
      )}
      <ListingIcon
        name={listing.name}
        src={listing.iconUrl}
        size={detailed ? 56 : 48}
      />
      <span {...stylex.props(styles.body)}>
        <span {...stylex.props(styles.top)}>
          <span {...stylex.props(styles.name)}>{listing.name}</span>
          {badge}
          {aside ? <span {...stylex.props(styles.handle)}>{aside}</span> : null}
        </span>
        <span {...stylex.props(styles.tagline)}>{listing.tagline}</span>
        {labels.length > 0 ? (
          <span {...stylex.props(styles.chips)}>
            {labels.map((label) => (
              <span key={label.key} {...stylex.props(styles.chip)}>
                {label.label}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span {...stylex.props(styles.aside, !detailed && styles.asideCompact)}>
        <ListingRating
          rating={listing.rating}
          reviewCount={listing.reviewCount}
          showCount
          emptyLabel={detailed ? "No reviews yet" : undefined}
        />
        {detailed && listing.updatedAt ? (
          <span {...stylex.props(styles.muted)}>
            Updated {formatTimeAgo(listing.updatedAt)}
          </span>
        ) : null}
      </span>
      <ChevronRight size={18} aria-hidden {...stylex.props(styles.chevron)} />
    </RouterLink>
  );
}
