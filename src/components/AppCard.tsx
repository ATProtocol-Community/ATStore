import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { VisuallyHidden } from "react-aria";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Card, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { StarRating } from "../design-system/star-rating";
import {
  animationDuration,
  animationTimingFunction,
} from "../design-system/theme/animations.stylex";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
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

/**
 * - large: hero slot. Image on top, full details underneath.
 * - medium: promo slot. Same anatomy as large, in a smaller slot.
 * - small: details only, no image.
 */
export type AppCardSize = "large" | "medium" | "small";

/**
 * The card surface is a size container, so a card adapts to the width it is
 * given (e.g. a row of three on a tablet) rather than to the viewport.
 */
const NARROW_CARD = "@container (max-width: 16rem)";

const styles = stylex.create({
  /**
   * The link is the hit area. It never moves, so the pointer can't slip off
   * its edge mid-hover (which made the cursor flicker between arrow and hand).
   * All motion and the focus ring live on the surface inside it.
   */
  link: {
    WebkitTapHighlightColor: "transparent",
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    display: "block",
    outlineStyle: "none",
    height: "100%",
    // Let grid/flex parents shrink the card; long labels truncate instead.
    minWidth: 0,
  },
  surface: {
    borderRadius: radius.lg,
    cornerShape: "squircle",
    boxShadow: {
      default: shadow.sm,
      [stylex.when.ancestor(":hover")]: shadow.lg,
    },
    boxSizing: "border-box",
    containerType: "inline-size",
    outlineColor: primaryColor.solid1,
    outlineOffset: 2,
    outlineStyle: {
      default: "none",
      [stylex.when.ancestor(":focus-visible")]: "solid",
    },
    outlineWidth: 2,
    transform: {
      default: "none",
      [stylex.when.ancestor(":hover")]: "translateY(-2px)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform, box-shadow",
    transitionTimingFunction: animationTimingFunction.easeOut,
    height: "100%",
  },
  image: {
    transform: {
      default: "scale(1)",
      [stylex.when.ancestor(":hover")]: "scale(1.02)",
    },
    transitionDuration: animationDuration.verySlow,
    transitionProperty: "transform",
    transitionTimingFunction: animationTimingFunction.easeOut,
  },
  content: {
    gap: {
      [NARROW_CARD]: gap["3xl"],
      default: gap["4xl"],
    },
    boxSizing: "border-box",
    flexGrow: 1,
    paddingBottom: {
      [NARROW_CARD]: verticalSpace["3xl"],
      default: verticalSpace["4xl"],
    },
    paddingLeft: {
      [NARROW_CARD]: horizontalSpace["3xl"],
      default: horizontalSpace["4xl"],
    },
    paddingRight: {
      [NARROW_CARD]: horizontalSpace["3xl"],
      default: horizontalSpace["4xl"],
    },
    paddingTop: {
      [NARROW_CARD]: verticalSpace["3xl"],
      default: verticalSpace["4xl"],
    },
  },
  contentAfterImage: {
    paddingTop: 0,
  },
  // A large card's image absorbs any spare height (e.g. when the hero sits
  // beside a taller column of spotlights) so the card never has an empty band.
  // It only ever grows past 16:9, cropping the sides, never shrinks below it.
  imageFill: {
    flexGrow: 1,
  },
  noGrow: {
    flexGrow: 0,
  },
  // Narrow cards stack the icon above the name so long names keep the full
  // card width instead of breaking mid-word beside the icon.
  identity: {
    gap: gap["2xl"],
    alignItems: {
      [NARROW_CARD]: "flex-start",
      default: "center",
    },
    display: "flex",
    flexDirection: {
      [NARROW_CARD]: "column",
      default: "row",
    },
    minWidth: 0,
  },
  identityText: {
    minWidth: 0,
  },
  name: {
    overflowWrap: "anywhere",
  },
  // Spare height goes above the footer, so footers line up across a row.
  // (Growing the tagline instead would reveal lines past its clamp.)
  footer: {
    marginTop: "auto",
  },
  footerRow: {
    gap: {
      [NARROW_CARD]: gap["md"],
      default: gap["xl"],
    },
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  taglineClamped: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
    display: "-webkit-box",
  },
  labels: {
    gap: gap["sm"],
    overflow: "hidden",
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  labelsWrapped: {
    overflow: "visible",
    flexWrap: "wrap",
    rowGap: gap["sm"],
  },
  labelWrapped: {
    maxWidth: "100%",
    minWidth: 0,
  },
  // Only the first label may shrink; later ones keep their natural width up
  // to a cap, so a short tag like "Work" never collapses to "W…".
  label: {
    flexShrink: 0,
    maxWidth: "10rem",
    minWidth: 0,
  },
  firstLabel: {
    flexShrink: 1,
    maxWidth: "none",
  },
  wideOnly: {
    display: {
      [NARROW_CARD]: "none",
      default: "flex",
    },
  },
  narrowOnly: {
    display: {
      [NARROW_CARD]: "flex",
      default: "none",
    },
  },
  wideOnlyInline: {
    display: {
      [NARROW_CARD]: "none",
      default: "inline",
    },
  },
  narrowOnlyInline: {
    display: {
      [NARROW_CARD]: "inline",
      default: "none",
    },
  },
  labelEmoji: {
    marginRight: "0.3em",
  },
  labelText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  moreLabel: {
    flexShrink: 0,
  },
  rating: {
    alignItems: "center",
    columnGap: {
      [NARROW_CARD]: gap["sm"],
      default: gap["md"],
    },
    display: "flex",
    flexWrap: "wrap",
    rowGap: gap["xs"],
    minWidth: 0,
  },
  chevron: {
    color: uiColor.text1,
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

function getHandle(listing: DirectoryListingCard) {
  return listing.productAccountHandle?.replace(/^@/, "") || "unknown";
}

/**
 * The whole card is a single link. Keep everything inside it non-interactive
 * (no buttons, no nested links) so there is exactly one click target.
 */
function AppCardLink({
  listing,
  labelledBy,
  describedBy,
  children,
}: {
  listing: DirectoryListingCard;
  labelledBy?: string;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      {...stylex.props(styles.link, stylex.defaultMarker())}
    >
      {children}
    </RouterLink>
  );
}

export function AppCard({
  listing,
  size,
}: {
  listing: DirectoryListingCard;
  size: AppCardSize;
}) {
  const nameId = useId();
  const taglineId = useId();
  const labelsId = useId();
  const ratingId = useId();

  const isSmall = size === "small";
  const imageUrl = isSmall ? null : listing.heroImageUrl;
  const fillWithImage = size === "large" && Boolean(imageUrl);
  const hasLabels = getListingLabels(listing).length > 0;

  return (
    <AppCardLink
      listing={listing}
      labelledBy={nameId}
      describedBy={[
        listing.tagline ? taglineId : null,
        hasLabels ? labelsId : null,
        ratingId,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Card style={styles.surface}>
        {imageUrl ? (
          <CardImage
            aspectRatio={16 / 9}
            alt=""
            src={imageUrl}
            imageStyle={styles.image}
            style={fillWithImage ? styles.imageFill : null}
          />
        ) : null}
        <Flex
          direction="column"
          style={[
            styles.content,
            imageUrl ? styles.contentAfterImage : null,
            fillWithImage ? styles.noGrow : null,
          ]}
        >
          <div {...stylex.props(styles.identity)}>
            <Avatar
              alt=""
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="xl" style={styles.identityText}>
              <Text
                id={nameId}
                size={isSmall ? "xl" : { default: "2xl", sm: "3xl" }}
                weight="semibold"
                style={styles.name}
              >
                {listing.name}
              </Text>
              <SmallBody variant="secondary">@{getHandle(listing)}</SmallBody>
            </Flex>
          </div>
          {isSmall ? (
            <Body
              id={taglineId}
              variant="secondary"
              style={styles.taglineClamped}
            >
              {listing.tagline}
            </Body>
          ) : (
            <Text id={taglineId} size="lg" variant="secondary">
              {listing.tagline}
            </Text>
          )}
          <Flex direction="column" gap="xl" style={styles.footer}>
            <AppCardLabels id={labelsId} listing={listing} />
            <div {...stylex.props(styles.footerRow)}>
              <AppCardRating
                id={ratingId}
                rating={listing.rating}
                reviewCount={listing.reviewCount}
              />
              <ChevronRight aria-hidden {...stylex.props(styles.chevron)} />
            </div>
          </Flex>
        </Flex>
      </Card>
    </AppCardLink>
  );
}

/**
 * Category + tag chips, capped so they always fit on one line with the rest
 * summarised as "+N": two chips normally, one in a narrow card. Chips are
 * plain labels, never links, so the card stays a single click target.
 *
 * Screen readers get the full list as text; the chips are visual only.
 */
export function AppCardLabels({
  id,
  listing,
  showAll = false,
}: {
  id?: string;
  listing: Pick<DirectoryListingCard, "categorySlugs" | "appTags">;
  /** Show every label, wrapping onto more lines (list rows have the room). */
  showAll?: boolean;
}) {
  const labels = getListingLabels(listing);
  if (labels.length === 0) return null;

  const visible = showAll ? labels : labels.slice(0, 2);
  const moreWhenWide = labels.length - visible.length;
  const moreWhenNarrow = showAll ? 0 : labels.length - 1;

  return (
    <div
      id={id}
      {...stylex.props(styles.labels, showAll && styles.labelsWrapped)}
    >
      <VisuallyHidden>
        {labels.map((label) => label.label).join(", ")}
      </VisuallyHidden>
      {visible.map((label, index) => (
        <Badge
          key={label.key}
          aria-hidden
          size="sm"
          variant={label.kind === "tag" ? "primary" : "default"}
          style={
            showAll
              ? styles.labelWrapped
              : [
                  styles.label,
                  index === 0 ? styles.firstLabel : styles.wideOnly,
                ]
          }
        >
          <span {...stylex.props(styles.labelText)}>
            {label.emoji ? (
              <span {...stylex.props(styles.labelEmoji)}>{label.emoji}</span>
            ) : null}
            {label.label}
          </span>
        </Badge>
      ))}
      {moreWhenWide > 0 ? (
        <Badge
          aria-hidden
          size="sm"
          style={[styles.moreLabel, styles.wideOnly]}
        >
          +{moreWhenWide}
        </Badge>
      ) : null}
      {moreWhenNarrow > 0 ? (
        <Badge
          aria-hidden
          size="sm"
          style={[styles.moreLabel, styles.narrowOnly]}
        >
          +{moreWhenNarrow}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Stars plus the score and review count. Unrated apps show empty stars and
 * "No reviews yet" so every card keeps the same footer shape. Narrow cards
 * drop the numeric score (the stars already show it) and shorten the copy.
 *
 * Screen readers get one plain sentence; the visual parts are hidden.
 */
export function AppCardRating({
  id,
  rating,
  reviewCount,
}: {
  id?: string;
  rating: number | null;
  reviewCount: number;
}) {
  const hasReviews = rating != null && reviewCount > 0;

  return (
    <div id={id} {...stylex.props(styles.rating)}>
      <VisuallyHidden>
        {hasReviews
          ? `Rated ${rating.toFixed(1)} out of 5, ${String(reviewCount)} ${reviewCount === 1 ? "review" : "reviews"}`
          : "No reviews yet"}
      </VisuallyHidden>
      <span aria-hidden>
        <StarRating
          rating={hasReviews ? rating : null}
          showReviewCount={false}
          size={14}
        />
      </span>
      <SmallBody variant="secondary" aria-hidden>
        {hasReviews ? (
          <>
            <span {...stylex.props(styles.wideOnlyInline)}>
              {rating.toFixed(1)}{" "}
            </span>
            ({reviewCount})
          </>
        ) : (
          <>
            <span {...stylex.props(styles.wideOnlyInline)}>No reviews yet</span>
            <span {...stylex.props(styles.narrowOnlyInline)}>No reviews</span>
          </>
        )}
      </SmallBody>
    </div>
  );
}
