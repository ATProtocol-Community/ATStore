import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useId } from "react";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { Avatar } from "../design-system/avatar";
import { Card, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
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
      describedBy={listing.tagline ? taglineId : undefined}
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
          <Flex align="center" justify="end" gap="xl">
            <ChevronRight aria-hidden {...stylex.props(styles.chevron)} />
          </Flex>
        </Flex>
      </Card>
    </AppCardLink>
  );
}
