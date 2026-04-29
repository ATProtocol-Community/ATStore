import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Flex } from "../design-system/flex";
import { amber } from "../design-system/theme/colors/amber.stylex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { bronze } from "../design-system/theme/colors/bronze.stylex";
import { crimson } from "../design-system/theme/colors/crimson.stylex";
import { cyan } from "../design-system/theme/colors/cyan.stylex";
import { grass } from "../design-system/theme/colors/grass.stylex";
import { indigo } from "../design-system/theme/colors/indigo.stylex";
import { iris } from "../design-system/theme/colors/iris.stylex";
import { jade } from "../design-system/theme/colors/jade.stylex";
import { orange } from "../design-system/theme/colors/orange.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { plum } from "../design-system/theme/colors/plum.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { ruby } from "../design-system/theme/colors/ruby.stylex";
import { sky } from "../design-system/theme/colors/sky.stylex";
import { teal } from "../design-system/theme/colors/teal.stylex";
import { tomato } from "../design-system/theme/colors/tomato.stylex";
import { violet } from "../design-system/theme/colors/violet.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Text } from "../design-system/typography/text";
import { type DirectoryAppTagSummary } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagSlug,
} from "../lib/app-tag-metadata";
import {
  type AppTagAccent,
  getAppTagAccent,
  getAppTagEmoji,
} from "../lib/app-tag-visuals";
import {
  animationDuration,
  animationTimingFunction,
} from "../design-system/theme/animations.stylex";

const styles = stylex.create({
  cardLink: {
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    transitionProperty: "transform",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease-in-out",
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
    boxShadow: shadow.md,
    borderRadius: radius["2xl"],
    cornerShape: "squircle",
  },
  card: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["8xl"],
    justifyContent: "space-between",
    position: "relative",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["4xl"],
    flexGrow: 1,

    /**
     * Drives the emoji-scatter parallax: 0 → 1 on hover. Each emoji's `transform` reads this
     * via `calc()` so individual glyphs can drift in different directions/distances while
     * still being controlled by a single parent state. Custom properties aren't interpolatable
     * without `@property`, but the dependent `transform` is — so the children's transitions
     * (defined on `transform`) handle the actual animation.
     */
    "--emoji-hover": {
      default: 0,
      ":hover": 1,
    },
  },
  cardShadow: {
    position: "relative",

    "::before": {
      content: "''",
      position: "absolute",
      inset: 0,
      borderRadius: radius.xl,
      boxShadow: shadow["xl"],
      cornerShape: "squircle",
      opacity: 0,
      transitionProperty: "opacity",
      transitionDuration: animationDuration.default,
      transitionTimingFunction: animationTimingFunction.linear,
    },
    ":hover::before": {
      opacity: 1,
    },
  },
  cardContent: {
    flexGrow: 1,
    position: "relative",
    zIndex: 1,
  },
  cardFooter: {
    position: "relative",
    zIndex: 1,
  },
  cardImage: {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    opacity: 0.64,
    position: "absolute",
    width: "100%",
  },
  cardOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 34%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 62%, transparent) 48%, color-mix(in srgb, ${uiColor.overlayBackdrop} 92%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  footerText: {
    color: uiColor.textContrast,
    textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
  },
  chevron: {
    color: uiColor.textContrast,
    marginLeft: "auto",
    filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.45))",
  },
  softAmberSurface: {
    backgroundImage: `linear-gradient(135deg, ${amber.border2} 0%, ${amber.solid1} 100%)`,
    borderColor: amber.border1,
  },
  softBlueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
    borderColor: blue.border1,
  },
  softBronzeSurface: {
    backgroundImage: `linear-gradient(135deg, ${bronze.border2} 0%, ${bronze.solid1} 100%)`,
    borderColor: bronze.border1,
  },
  softCrimsonSurface: {
    backgroundImage: `linear-gradient(135deg, ${crimson.border2} 0%, ${crimson.solid1} 100%)`,
    borderColor: crimson.border1,
  },
  softCyanSurface: {
    backgroundImage: `linear-gradient(135deg, ${cyan.border2} 0%, ${cyan.solid1} 100%)`,
    borderColor: cyan.border1,
  },
  softGrassSurface: {
    backgroundImage: `linear-gradient(135deg, ${grass.border2} 0%, ${grass.solid1} 100%)`,
    borderColor: grass.border1,
  },
  softIndigoSurface: {
    backgroundImage: `linear-gradient(135deg, ${indigo.border2} 0%, ${indigo.solid1} 100%)`,
    borderColor: indigo.border1,
  },
  softIrisSurface: {
    backgroundImage: `linear-gradient(135deg, ${iris.border2} 0%, ${iris.solid1} 100%)`,
    borderColor: iris.border1,
  },
  softJadeSurface: {
    backgroundImage: `linear-gradient(135deg, ${jade.border2} 0%, ${jade.solid1} 100%)`,
    borderColor: jade.border1,
  },
  softOrangeSurface: {
    backgroundImage: `linear-gradient(135deg, ${orange.border2} 0%, ${orange.solid1} 100%)`,
    borderColor: orange.border1,
  },
  softPinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
    borderColor: pink.border1,
  },
  softPlumSurface: {
    backgroundImage: `linear-gradient(135deg, ${plum.border2} 0%, ${plum.solid1} 100%)`,
    borderColor: plum.border1,
  },
  softPurpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
    borderColor: purple.border1,
  },
  softRubySurface: {
    backgroundImage: `linear-gradient(135deg, ${ruby.border2} 0%, ${ruby.solid1} 100%)`,
    borderColor: ruby.border1,
  },
  softSkySurface: {
    backgroundImage: `linear-gradient(135deg, ${sky.border2} 0%, ${sky.solid1} 100%)`,
    borderColor: sky.border1,
  },
  softTealSurface: {
    backgroundImage: `linear-gradient(135deg, ${teal.border2} 0%, ${teal.solid1} 100%)`,
    borderColor: teal.border1,
  },
  softTomatoSurface: {
    backgroundImage: `linear-gradient(135deg, ${tomato.border2} 0%, ${tomato.solid1} 100%)`,
    borderColor: tomato.border1,
  },
  softVioletSurface: {
    backgroundImage: `linear-gradient(135deg, ${violet.border2} 0%, ${violet.solid1} 100%)`,
    borderColor: violet.border1,
  },
  title: {
    color: uiColor.textContrast,
    textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
  },
  /**
   * Decorative emoji scatter behind the title/footer. All three slots inherit:
   *   - absolute positioning (each slot picks its own top/left/right/bottom + rotate),
   *   - pointer-events: none so the parent <a> still receives clicks,
   *   - userSelect: none so emojis don't get caught in text selection,
   *   - transition on transform so the parent's `--emoji-hover` flip animates smoothly,
   *   - color-emoji font stack (Linux/headless fallbacks render greyscale text glyphs otherwise).
   */
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
  /**
   * Per-slot scale × rotation × position × hover-drift. Drift directions are picked so the
   * scatter "explodes outward" slightly on hover — top-left emoji drifts up+left, bottom-right
   * drifts down+right, etc. — instead of every glyph translating the same way.
   */
  /**
   * Slot sizes are expressed in `em` so a single `fontSize` on the wrapper (`emojiBackdrop`)
   * scales the entire scatter at once — featured cards just bump that wrapper to grow every
   * glyph proportionally.
   */
  /**
   * Three glyphs scattered roughly around the card's center. The largest sits on the right
   * edge for a single anchored "peek"; the other two are pulled inward so the visual mass
   * sits near the middle rather than the top-left corner. Each one drifts in its own
   * direction on hover so the cluster expands rather than translating in unison.
   */
  emojiSlot1: {
    fontSize: "4.25em",
    left: "36%",
    opacity: 0.22,
    top: "12%",
    transform:
      "translate(calc(var(--emoji-hover) * 3px), calc(var(--emoji-hover) * -11px)) rotate(-16deg)",
  },
  emojiSlot2: {
    fontSize: "5.5em",
    opacity: 0.18,
    right: "-1.6rem",
    top: "38%",
    transform:
      "translate(calc(var(--emoji-hover) * 13px), calc(var(--emoji-hover) * -3px)) rotate(11deg)",
  },
  emojiSlot3: {
    bottom: "16%",
    fontSize: "3em",
    left: "22%",
    opacity: 0.24,
    transform:
      "translate(calc(var(--emoji-hover) * -9px), calc(var(--emoji-hover) * 9px)) rotate(24deg)",
  },
  /**
   * Slots 4 + 5 are only mounted on featured (2×2) cards — the extra real estate would otherwise
   * leave the scatter feeling sparse, but the same density on a 1×1 card crowds the title.
   * Positions are chosen to fill the *opposite* corners from slots 1 & 3, so the extended
   * scatter still distributes evenly around the card's center rather than clumping.
   */
  emojiSlot4: {
    fontSize: "3.75em",
    left: "4%",
    opacity: 0.2,
    top: "26%",
    transform:
      "translate(calc(var(--emoji-hover) * -8px), calc(var(--emoji-hover) * -7px)) rotate(18deg)",
  },
  emojiSlot5: {
    bottom: "28%",
    fontSize: "2.5em",
    opacity: 0.26,
    right: "30%",
    transform:
      "translate(calc(var(--emoji-hover) * 7px), calc(var(--emoji-hover) * 11px)) rotate(-22deg)",
  },
  /**
   * Wrapper that establishes the `em` reference for slot sizes and is the single knob to scale
   * the whole scatter (featured cards bump this).
   */
  emojiBackdrop: {
    fontSize: "1rem",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 0,
    overflow: "hidden",
  },
  emojiBackdropFeatured: {
    fontSize: "1.5rem",
  },
  cardFeatured: {
    gridColumn: "span 2",
    gridRow: "span 2",
  },
});

type AppTagCardProps = {
  tag: Pick<DirectoryAppTagSummary, "tag" | "count">;
  isFeatured?: boolean;
};

export function AppTagCard({ tag, isFeatured }: AppTagCardProps) {
  const accent = getAppTagAccent(tag.tag);
  const emoji = getAppTagEmoji(tag.tag);

  return (
    <RouterLink
      to="/apps/$tag"
      params={{ tag: getAppTagSlug(tag.tag) }}
      search={{ sort: "popular" }}
      {...stylex.props(
        styles.cardLink,
        styles.cardShadow,
        isFeatured && styles.cardFeatured,
      )}
    >
      <div {...stylex.props(styles.card, getSoftAccentSurface(accent))}>
        <div
          aria-hidden="true"
          {...stylex.props(
            styles.emojiBackdrop,
            isFeatured && styles.emojiBackdropFeatured,
          )}
        >
          <span {...stylex.props(styles.emojiBase, styles.emojiSlot1)}>
            {emoji}
          </span>
          <span {...stylex.props(styles.emojiBase, styles.emojiSlot2)}>
            {emoji}
          </span>
          <span {...stylex.props(styles.emojiBase, styles.emojiSlot3)}>
            {emoji}
          </span>
          {isFeatured ? (
            <>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot4)}>
                {emoji}
              </span>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot5)}>
                {emoji}
              </span>
            </>
          ) : null}
        </div>
        <Flex direction="column" gap="2xl" style={styles.cardContent}>
          <Text
            size={
              isFeatured
                ? { default: "3xl", sm: "4xl" }
                : { default: "xl", sm: "2xl" }
            }
            weight="semibold"
            style={styles.title}
          >
            {formatAppTagLabel(tag.tag)}
          </Text>
        </Flex>
        <Flex
          align="center"
          justify="between"
          gap="md"
          style={styles.cardFooter}
        >
          <Text
            style={styles.footerText}
            size={
              isFeatured
                ? { default: "xl", sm: "2xl" }
                : { default: "sm", sm: "base" }
            }
          >
            {formatAppTagCount(tag.count)}
          </Text>
          <ChevronRight {...stylex.props(styles.chevron)} />
        </Flex>
      </div>
    </RouterLink>
  );
}

function getSoftAccentSurface(accent: AppTagAccent) {
  switch (accent) {
    case "amber":
      return styles.softAmberSurface;
    case "blue":
      return styles.softBlueSurface;
    case "bronze":
      return styles.softBronzeSurface;
    case "crimson":
      return styles.softCrimsonSurface;
    case "cyan":
      return styles.softCyanSurface;
    case "grass":
      return styles.softGrassSurface;
    case "indigo":
      return styles.softIndigoSurface;
    case "iris":
      return styles.softIrisSurface;
    case "jade":
      return styles.softJadeSurface;
    case "orange":
      return styles.softOrangeSurface;
    case "pink":
      return styles.softPinkSurface;
    case "plum":
      return styles.softPlumSurface;
    case "purple":
      return styles.softPurpleSurface;
    case "ruby":
      return styles.softRubySurface;
    case "sky":
      return styles.softSkySurface;
    case "teal":
      return styles.softTealSurface;
    case "tomato":
      return styles.softTomatoSurface;
    case "violet":
      return styles.softVioletSurface;
  }
}
