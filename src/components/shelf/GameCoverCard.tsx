import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";

import { animationDuration } from "../../design-system/theme/animations.stylex";
import { uiColor } from "../../design-system/theme/color.stylex";
import { breakpoints } from "../../design-system/theme/media-queries.stylex";
import { shadow } from "../../design-system/theme/shadow.stylex";
import { fontWeight } from "../../design-system/theme/typography.stylex";
import { getDirectoryListingSlug } from "../../lib/directory-listing-slugs";
import { ListingIcon } from "./ListingIcon";

const styles = stylex.create({
  card: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    outlineColor: uiColor.text2,
    outlineOffset: 4,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    minWidth: 0,
  },
  cover: {
    borderRadius: 16,
    overflow: "hidden",
    placeItems: "center",
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.component1,
    boxShadow: {
      default: shadow.none,
      [stylex.when.ancestor(":hover")]: shadow.md,
    },
    display: "grid",
    position: "relative",
    transitionDuration: animationDuration.slow,
    transitionProperty: "box-shadow",
    "::after": {
      inset: 0,
      borderRadius: "inherit",
      boxShadow: `inset 0 0 0 1px ${uiColor.border1}`,
      content: "''",
      pointerEvents: "none",
      position: "absolute",
    },
  },
  noCover: {
    backgroundImage: `radial-gradient(circle at 50% 40%, ${uiColor.bg}, ${uiColor.component1})`,
  },
  image: {
    display: "block",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  row: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    rowGap: 12,
    marginTop: 14,
  },
  text: {
    minWidth: 0,
  },
  rowIcon: {
    display: { default: "none", [breakpoints.sm]: "inline-grid" },
  },
  name: {
    overflow: "hidden",
    color: uiColor.text2,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 1,
  },
});

/** A game (or any listing with a 16:9 cover) as cover art plus a name line. */
export function GameCoverCard({
  listing,
}: {
  listing: {
    name: string;
    slug?: string | null;
    iconUrl: string | null;
    heroImageUrl: string | null;
    tagline: string;
  };
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = Boolean(listing.heroImageUrl) && !coverFailed;

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.card)}
    >
      <div
        data-listing-hero={hasCover ? "" : undefined}
        {...stylex.props(styles.cover, !hasCover && styles.noCover)}
      >
        {hasCover ? (
          <img
            alt=""
            src={listing.heroImageUrl ?? undefined}
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
            {...stylex.props(styles.image)}
          />
        ) : (
          <ListingIcon name={listing.name} src={listing.iconUrl} size={64} />
        )}
      </div>
      <div {...stylex.props(styles.row)}>
        <ListingIcon
          name={listing.name}
          src={listing.iconUrl}
          size={36}
          style={styles.rowIcon}
        />
        <div {...stylex.props(styles.text)}>
          <div {...stylex.props(styles.name)}>{listing.name}</div>
          <div {...stylex.props(styles.tagline)}>{listing.tagline}</div>
        </div>
      </div>
    </RouterLink>
  );
}
