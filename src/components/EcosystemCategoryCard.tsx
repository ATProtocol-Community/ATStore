import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Flex } from "../design-system/flex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import type {
  DirectoryCategoryAccent,
  DirectoryCategoryTreeNode,
} from "../lib/directory-categories";
import { formatEcosystemListingCount } from "../lib/ecosystem-listings";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { getEcosystemCategoryEmoji } from "../lib/ecosystem-category-emoji";

const styles = stylex.create({
  cardContentLayout: {
    position: "absolute",
    inset: 0,
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["4xl"],
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  card: {
    aspectRatio: {
      default: "16 / 7",
      [breakpoints.sm]: "16 / 9",
    },
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["8xl"],
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
    textDecoration: "none",
    transitionProperty: "transform",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease-in-out",
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
    /**
     * Mirrors the `AppTagCard` parallax: 0 → 1 on hover, read by each emoji slot's
     * `transform` via `calc()`. Custom properties don't interpolate without `@property`
     * but the dependent `transform` on the children does, so the children's transitions
     * (defined on `transform`) handle the actual animation.
     */
    "--emoji-hover": {
      default: 0,
      ":hover": 1,
    },
  },
  cardContent: {
    position: "relative",
    zIndex: 1,
  },
  cardFooter: {
    position: "relative",
    zIndex: 1,
  },
  chevron: {
    marginLeft: "auto",
  },
  softBlueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
    borderColor: blue.border1,
  },
  softGreenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.border2} 0%, ${green.solid1} 100%)`,
    borderColor: green.border1,
  },
  softPinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
    borderColor: pink.border1,
  },
  softPurpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
    borderColor: purple.border1,
  },
  listingCount: {
    textShadow:
      "0 1px 2px color-mix(in srgb, black 45%, transparent), 0 8px 24px color-mix(in srgb, black 35%, transparent)",
  },
  title: {
    color: uiColor.textContrast,
    textShadow:
      "0 1px 2px color-mix(in srgb, black 45%, transparent), 0 8px 24px color-mix(in srgb, black 35%, transparent)",
  },
  description: {
    color: uiColor.textContrast,
    maxWidth: "36rem",
    textShadow:
      "0 1px 2px color-mix(in srgb, black 42%, transparent), 0 6px 20px color-mix(in srgb, black 30%, transparent)",
  },
  eyebrow: {
    color: uiColor.textContrast,
    letterSpacing: "0.16em",
    textShadow:
      "0 1px 2px color-mix(in srgb, black 42%, transparent), 0 4px 16px color-mix(in srgb, black 28%, transparent)",
    textTransform: "uppercase",
  },
  /**
   * Decorative emoji scatter behind the title/footer. Same pattern as `AppTagCard`:
   *   - absolute positioning (each slot picks its own top/left/right/bottom + rotate),
   *   - pointer-events: none so the parent <a> still receives clicks,
   *   - userSelect: none so emojis don't get caught in text selection,
   *   - transition on transform so the parent's `--emoji-hover` flip animates smoothly,
   *   - color-emoji font stack (Linux/headless fallbacks render greyscale text glyphs otherwise).
   *
   * The card is a 16:9 banner rather than a square, so slots are spread along the width:
   * one cluster anchored center-right (largest), one peeking from the left, and supporting
   * glyphs around them — keeping the visual mass biased to the right of the title.
   */
  emojiBackdrop: {
    fontSize: "1rem",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 0,
  },
  emojiBase: {
    filter: "drop-shadow(0 2px 4px rgb(0 0 0 / 0.35))",
    fontFamily:
      '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
    lineHeight: 1,
    pointerEvents: "none",
    position: "absolute",
    transitionProperty: "transform",
    transitionDuration: "500ms",
    transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    userSelect: "none",
    zIndex: 0,
  },
  emojiSlot1: {
    fontSize: "7em",
    opacity: 0.22,
    right: "6%",
    top: "12%",
    transform:
      "translate(calc(var(--emoji-hover) * 12px), calc(var(--emoji-hover) * -8px)) rotate(-12deg)",
  },
  emojiSlot2: {
    bottom: "10%",
    fontSize: "4em",
    opacity: 0.18,
    right: "26%",
    transform:
      "translate(calc(var(--emoji-hover) * 6px), calc(var(--emoji-hover) * 10px)) rotate(16deg)",
  },
  emojiSlot3: {
    fontSize: "3.25em",
    left: "42%",
    opacity: 0.2,
    top: "16%",
    transform:
      "translate(calc(var(--emoji-hover) * -7px), calc(var(--emoji-hover) * -10px)) rotate(22deg)",
  },
  emojiSlot4: {
    bottom: "18%",
    fontSize: "2.5em",
    opacity: 0.24,
    right: "44%",
    transform:
      "translate(calc(var(--emoji-hover) * 9px), calc(var(--emoji-hover) * 8px)) rotate(-18deg)",
  },
});

type EcosystemCategoryCardProps = {
  category: DirectoryCategoryTreeNode;
};

export function EcosystemCategoryCard({
  category,
}: EcosystemCategoryCardProps) {
  const accent = category.accent;
  const slotEmojis = pickSlotEmojis(category);

  return (
    <RouterLink
      to="/categories/$categoryId"
      params={{ categoryId: category.id }}
      search={{ sort: "popular" }}
      {...stylex.props(styles.card, getSoftAccentSurface(accent))}
    >
      <div aria-hidden="true" {...stylex.props(styles.emojiBackdrop)}>
        <span {...stylex.props(styles.emojiBase, styles.emojiSlot1)}>
          {slotEmojis[0]}
        </span>
        <span {...stylex.props(styles.emojiBase, styles.emojiSlot4)}>
          {slotEmojis[3]}
        </span>
      </div>
      <div {...stylex.props(styles.cardContentLayout)}>
        <Flex direction="column" gap="xl" style={styles.cardContent}>
          <SmallBody style={styles.eyebrow}>
            {category.pathLabels.slice(0, -1).join(" / ")}
          </SmallBody>
          <Text size="3xl" weight="semibold" style={styles.title}>
            {category.label}
          </Text>
          <SmallBody style={styles.description}>
            {category.description}
          </SmallBody>
        </Flex>
        <Flex
          align="center"
          justify="between"
          gap="md"
          style={styles.cardFooter}
        >
          <SmallBody style={styles.listingCount}>
            {formatEcosystemListingCount(category.count)}
          </SmallBody>
          <ChevronRight {...stylex.props(styles.chevron)} />
        </Flex>
      </div>
    </RouterLink>
  );
}

function getSoftAccentSurface(accent: DirectoryCategoryAccent) {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
}

const SLOT_COUNT = 4;

/**
 * Build the per-slot emoji list. Strategy:
 *   1. Start with the category's *own* emoji as the anchor (slot 1 is the largest, so this
 *      is the glyph users associate with the card).
 *   2. Walk the category's children and append each child's emoji, skipping duplicates so
 *      the scatter reads varied — resolved via `getEcosystemCategoryEmoji` (directory-aware,
 *      not the app-tag ✨ fallback).
 *   3. If the dedup'd pool is still shorter than the slot count (leaf categories or shallow
 *      trees), recursively descend grandchildren before falling back to repeating the
 *      anchor emoji. This makes top-level "Apps" and "Protocol Tools" — which have many
 *      grandchildren — visually rich, while small categories degrade gracefully.
 */
function pickSlotEmojis(category: DirectoryCategoryTreeNode): string[] {
  const anchor = getEcosystemCategoryEmoji(category.label);
  const seen = new Set<string>([anchor]);
  const pool: string[] = [anchor];

  const visit = (nodes: DirectoryCategoryTreeNode[]) => {
    for (const node of nodes) {
      if (pool.length >= SLOT_COUNT) return;
      const emoji = getEcosystemCategoryEmoji(node.label);
      if (seen.has(emoji)) continue;
      seen.add(emoji);
      pool.push(emoji);
    }
  };

  visit(category.children);
  if (pool.length < SLOT_COUNT) {
    for (const child of category.children) {
      if (pool.length >= SLOT_COUNT) break;
      visit(child.children);
    }
  }

  while (pool.length < SLOT_COUNT) {
    pool.push(anchor);
  }

  return pool;
}
