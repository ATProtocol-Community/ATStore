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
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { getListingLabels } from "../lib/listing-labels";
import { HeroImage } from "./HeroImage";

export type AppCardSize = "large" | "medium" | "small";

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
  heroSurface: {
    borderRadius: radius["3xl"],
    boxShadow: "none",
    transform: "none",
  },
  content: {
    gap: gap["4xl"],
    boxSizing: "border-box",
    flexGrow: 1,
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  contentAfterImage: {
    paddingTop: 0,
  },
  identity: {
    minWidth: 0,
  },
  identityText: {
    minWidth: 0,
  },
  name: {
    overflowWrap: "anywhere",
  },
  tagline: {
    flexGrow: 1,
  },
  labels: {
    gap: gap["sm"],
    overflow: "hidden",
    alignItems: "center",
    display: "flex",
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
    gap: gap["md"],
    alignItems: "center",
    display: "flex",
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

  if (size === "large" && listing.heroImageUrl) {
    return (
      <AppCardLink listing={listing}>
        <div {...stylex.props(styles.surface, styles.heroSurface)}>
          <HeroImage
            alt={getDirectoryListingHeroImageAlt(listing)}
            glowIntensity={0}
            src={listing.heroImageUrl}
          />
        </div>
      </AppCardLink>
    );
  }

  const showImage = size === "medium" && Boolean(listing.heroImageUrl);

  return (
    <AppCardLink
      listing={listing}
      labelledBy={nameId}
      describedBy={[
        listing.tagline ? taglineId : null,
        getListingLabels(listing).length > 0 ? labelsId : null,
        ratingId,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Card style={styles.surface}>
        {showImage && listing.heroImageUrl ? (
          <CardImage aspectRatio={16 / 9} alt="" src={listing.heroImageUrl} />
        ) : null}
        <Flex
          direction="column"
          style={[styles.content, showImage && styles.contentAfterImage]}
        >
          <Flex align="center" gap="2xl" style={styles.identity}>
            <Avatar
              alt=""
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="xl" style={styles.identityText}>
              <Text
                id={nameId}
                size={size === "small" ? "xl" : { default: "2xl", sm: "3xl" }}
                weight="semibold"
                style={styles.name}
              >
                {listing.name}
              </Text>
              <SmallBody variant="secondary">@{getHandle(listing)}</SmallBody>
            </Flex>
          </Flex>
          {size === "small" ? (
            <Body id={taglineId} variant="secondary" style={styles.tagline}>
              {listing.tagline}
            </Body>
          ) : (
            <Text
              id={taglineId}
              size="lg"
              variant="secondary"
              style={styles.tagline}
            >
              {listing.tagline}
            </Text>
          )}
          <Flex direction="column" gap="xl">
            <AppCardLabels id={labelsId} listing={listing} />
            <Flex align="center" justify="between" gap="xl">
              <AppCardRating
                id={ratingId}
                rating={listing.rating}
                reviewCount={listing.reviewCount}
              />
              <ChevronRight aria-hidden {...stylex.props(styles.chevron)} />
            </Flex>
          </Flex>
        </Flex>
      </Card>
    </AppCardLink>
  );
}

const MAX_VISIBLE_LABELS = 2;

/**
 * Category + tag chips. Capped so they always fit on one line; overflow is
 * summarised as "+N". Chips are plain labels, never links, so the card stays a
 * single click target.
 */
export function AppCardLabels({
  id,
  listing,
}: {
  id?: string;
  listing: Pick<DirectoryListingCard, "categorySlugs" | "appTags">;
}) {
  const labels = getListingLabels(listing);
  if (labels.length === 0) return null;

  const visible = labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenCount = labels.length - visible.length;

  return (
    <div id={id} {...stylex.props(styles.labels)}>
      {visible.map((label, index) => (
        <Badge
          key={label.key}
          size="sm"
          variant={label.kind === "tag" ? "primary" : "default"}
          style={[styles.label, index === 0 && styles.firstLabel]}
        >
          <span {...stylex.props(styles.labelText)}>
            {label.emoji ? (
              <span aria-hidden {...stylex.props(styles.labelEmoji)}>
                {label.emoji}
              </span>
            ) : null}
            {label.label}
          </span>
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge size="sm" style={styles.moreLabel}>
          +{hiddenCount}
          <VisuallyHidden> more</VisuallyHidden>
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Stars plus the score and review count. Unrated apps show empty stars and
 * "No reviews yet" so every card keeps the same footer shape.
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
      <span aria-hidden>
        <StarRating
          rating={hasReviews ? rating : null}
          showReviewCount={false}
          size={14}
        />
      </span>
      {hasReviews ? (
        <SmallBody variant="secondary">
          <VisuallyHidden>Rated </VisuallyHidden>
          {rating.toFixed(1)}
          <VisuallyHidden> out of 5,</VisuallyHidden> ({reviewCount}
          <VisuallyHidden>
            {reviewCount === 1 ? " review" : " reviews"}
          </VisuallyHidden>
          )
        </SmallBody>
      ) : (
        <SmallBody variant="secondary">No reviews yet</SmallBody>
      )}
    </div>
  );
}
