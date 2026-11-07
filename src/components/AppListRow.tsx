import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight, Heart } from "lucide-react";
import { useId } from "react";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";
import type { BrowseListingCard } from "../lib/browse-listings";

import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import {
  animationDuration,
  animationTimingFunction,
} from "../design-system/theme/animations.stylex";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getListingLabels } from "../lib/listing-labels";
import { AppCardLabels, AppCardRating } from "./AppCard";

/**
 * List rows for apps. Two variants share one look and one interaction:
 * - RankedAppRow: compact, numbered (home "Trending").
 * - DetailedAppRow: labels, rating, favorites, last update (Browse).
 *
 * Like AppCard, the whole row is a single link that never moves; the surface
 * inside it tints on hover and draws the keyboard focus ring.
 */

const styles = stylex.create({
  link: {
    WebkitTapHighlightColor: "transparent",
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    display: "block",
    outlineStyle: "none",
    minWidth: 0,
  },
  // Rows sit flush against each other. This padding is the visual gap between
  // rows but still belongs to the link, so the pointer never falls into a dead
  // zone (and flips back to an arrow) while moving down the list.
  rankedLink: {
    paddingBottom: verticalSpace.xs,
    paddingTop: verticalSpace.xs,
  },
  detailedLink: {
    paddingBottom: verticalSpace.sm,
    paddingTop: verticalSpace.sm,
  },
  surface: {
    borderRadius: radius.md,
    cornerShape: "squircle",
    backgroundColor: {
      default: uiColor.bg,
      [stylex.when.ancestor(":hover")]: uiColor.component1,
    },
    boxShadow: {
      default: shadow.none,
      [stylex.when.ancestor(":hover")]: shadow.lg,
    },
    outlineColor: primaryColor.solid1,
    outlineOffset: 2,
    outlineStyle: {
      default: "none",
      [stylex.when.ancestor(":focus-visible")]: "solid",
    },
    outlineWidth: 2,
    transitionDuration: animationDuration.slow,
    transitionProperty: "background-color, box-shadow",
    transitionTimingFunction: animationTimingFunction.easeOut,
  },
  detailedSurface: {
    borderRadius: radius.lg,
    containIntrinsicSize: "auto 7rem",
    boxShadow: {
      default: shadow.sm,
      [stylex.when.ancestor(":hover")]: shadow.lg,
    },
    contentVisibility: "auto",
  },
  rankedBody: {
    gap: gap.xl,
    alignItems: "center",
    display: "flex",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
  rank: {
    minWidth: "1.25rem",
  },
  rankedText: {
    flexBasis: "0%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  detailedBody: {
    gridTemplateAreas: {
      default: '"avatar main chevron" "avatar stats chevron"',
      [breakpoints.md]: '"avatar main stats chevron"',
    },
    alignItems: "start",
    columnGap: gap["3xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr) auto",
      [breakpoints.md]: "auto minmax(0, 1fr) auto auto",
    },
    rowGap: gap.md,
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["3xl"],
  },
  avatarArea: {
    gridColumnEnd: "avatar",
    gridColumnStart: "avatar",
    gridRowEnd: "avatar",
    gridRowStart: "avatar",
  },
  mainArea: {
    gridColumnEnd: "main",
    gridColumnStart: "main",
    gridRowEnd: "main",
    gridRowStart: "main",
    minWidth: 0,
  },
  nameLine: {
    flexWrap: "wrap",
    rowGap: gap.sm,
  },
  statsArea: {
    alignItems: {
      default: "center",
      [breakpoints.md]: "flex-end",
    },
    columnGap: gap["2xl"],
    display: "flex",
    flexDirection: {
      default: "row",
      [breakpoints.md]: "column",
    },
    flexWrap: "wrap",
    gridColumnEnd: "stats",
    gridColumnStart: "stats",
    gridRowEnd: "stats",
    gridRowStart: "stats",
    rowGap: gap.sm,
    whiteSpace: "nowrap",
  },
  statLine: {
    gap: gap.xs,
    alignItems: "center",
    color: uiColor.text1,
    display: "inline-flex",
  },
  chevronArea: {
    alignSelf: "center",
    gridColumnEnd: "chevron",
    gridColumnStart: "chevron",
    gridRowEnd: "chevron",
    gridRowStart: "chevron",
  },
  chevron: {
    color: uiColor.text1,
    display: "block",
    flexShrink: 0,
    transform: {
      default: "none",
      [stylex.when.ancestor(":hover")]: "translateX(2px)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform",
    transitionTimingFunction: animationTimingFunction.easeOut,
  },
});

type RowListing = {
  name: string;
  slug?: string | null;
};

function AppRowLink({
  listing,
  labelledBy,
  describedBy,
  style,
  children,
}: {
  listing: RowListing;
  labelledBy: string;
  describedBy: string;
  style: stylex.StyleXStyles;
  children: ReactNode;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      {...stylex.props(styles.link, style, stylex.defaultMarker())}
    >
      {children}
    </RouterLink>
  );
}

function RowChevron() {
  return <ChevronRight aria-hidden {...stylex.props(styles.chevron)} />;
}

/**
 * Compact numbered row. Render inside an `<ol>`: the list supplies the
 * position to screen readers, so the visible number is decorative.
 */
export function RankedAppRow({
  listing,
  rank,
}: {
  listing: DirectoryListingCard;
  rank: number;
}) {
  const nameId = useId();
  const taglineId = useId();

  return (
    <AppRowLink
      listing={listing}
      labelledBy={nameId}
      describedBy={taglineId}
      style={styles.rankedLink}
    >
      <div {...stylex.props(styles.surface, styles.rankedBody)}>
        <Text
          aria-hidden
          size="xl"
          weight="semibold"
          variant="secondary"
          style={styles.rank}
        >
          {rank}
        </Text>
        <Avatar
          alt=""
          fallback={getInitials(listing.name)}
          size="lg"
          src={listing.iconUrl || undefined}
        />
        <Flex direction="column" gap="lg" style={styles.rankedText}>
          <Text id={nameId} size="lg" weight="semibold">
            {listing.name}
          </Text>
          <SmallBody id={taglineId} variant="secondary">
            {listing.tagline}
          </SmallBody>
        </Flex>
        <RowChevron />
      </div>
    </AppRowLink>
  );
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatUpdatedAgo(iso: string) {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > -30) return relativeTimeFormat.format(days, "day");
  if (days > -365) {
    return relativeTimeFormat.format(Math.round(days / 30), "month");
  }
  return relativeTimeFormat.format(Math.round(days / 365), "year");
}

/** Full-detail row for Browse: every label, rating, favorites, last update. */
export function DetailedAppRow({ listing }: { listing: BrowseListingCard }) {
  const nameId = useId();
  const taglineId = useId();
  const labelsId = useId();
  const ratingId = useId();
  const handle = listing.productAccountHandle?.replace(/^@/, "");

  return (
    <AppRowLink
      listing={listing}
      labelledBy={nameId}
      describedBy={[
        taglineId,
        getListingLabels(listing).length > 0 ? labelsId : null,
        ratingId,
      ]
        .filter(Boolean)
        .join(" ")}
      style={styles.detailedLink}
    >
      <Card style={[styles.surface, styles.detailedSurface]}>
        <div {...stylex.props(styles.detailedBody)}>
          <div {...stylex.props(styles.avatarArea)}>
            <Avatar
              alt=""
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
          </div>

          <Flex direction="column" gap="md" style={styles.mainArea}>
            <Flex align="center" gap="md" style={styles.nameLine}>
              <Text id={nameId} size="lg" weight="semibold">
                {listing.name}
              </Text>
              {handle ? (
                <SmallBody variant="secondary">@{handle}</SmallBody>
              ) : null}
            </Flex>
            <Body id={taglineId} variant="secondary">
              {listing.tagline}
            </Body>
            <AppCardLabels id={labelsId} listing={listing} showAll />
          </Flex>

          <div {...stylex.props(styles.statsArea)}>
            <AppCardRating
              id={ratingId}
              rating={listing.rating}
              reviewCount={listing.reviewCount}
            />
            <SmallBody style={styles.statLine}>
              <Heart size={12} aria-hidden />
              {`${listing.favoriteCount} ${listing.favoriteCount === 1 ? "favorite" : "favorites"}`}
            </SmallBody>
            <SmallBody variant="secondary">
              Updated {formatUpdatedAgo(listing.updatedAt)}
            </SmallBody>
          </div>

          <div {...stylex.props(styles.chevronArea)}>
            <RowChevron />
          </div>
        </div>
      </Card>
    </AppRowLink>
  );
}
