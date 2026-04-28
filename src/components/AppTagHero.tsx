import * as stylex from "@stylexjs/stylex";

import { Flex } from "../design-system/flex";
import { ui } from "../design-system/theme/semantic-color.stylex";
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
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { resolveBannerRecordUrl } from "../lib/banner-record-url";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import type { AppTagAccent } from "../lib/app-tag-visuals";

interface AppTagHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /**
   * When provided, render an accent-tinted banner panel (gradient surface + emoji scatter)
   * above the copy. Mirrors the visual language of `AppTagCard` so tag/category index pages
   * read as part of the same family. Takes precedence over `imageSrc`.
   */
  accent?: AppTagAccent;
  /**
   * Emoji glyphs to scatter across the accent banner. The list is cycled to fill 5 slots,
   * so a single-emoji array repeats one glyph (good for app tags) and a multi-emoji array
   * varies across slots (good for categories with mixed children).
   */
  emojis?: string[];
  imageSrc?: string | null;
  action?: React.ReactNode;
}

const styles = stylex.create({
  root: {
    width: "100%",
    position: "relative",
    zIndex: 1,
  },
  imageFrame: {
    borderRadius: radius["2xl"],
    cornerShape: "squircle",
    maxHeight: "240px",
    overflow: "hidden",
    width: "100%",
  },
  image: {
    display: "block",
    height: {
      default: "140px",
      [breakpoints.sm]: "240px",
    },
    objectFit: "cover",
    objectPosition: "center",
    width: "100%",
  },
  imageFallback: {
    background:
      "linear-gradient(135deg, rgba(87, 112, 255, 0.18) 0%, rgba(229, 76, 180, 0.16) 50%, rgba(70, 195, 161, 0.16) 100%)",
    height: "240px",
    width: "100%",
  },
  /**
   * The accent banner is a narrower variant of `AppTagCard`'s surface — same gradient/border
   * but stretched into a wide panel. It's purely decorative (no text overlaid), so the
   * emoji scatter can spread across the full width without competing with copy.
   */
  accentBanner: {
    borderRadius: radius["2xl"],
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    height: {
      default: "140px",
      [breakpoints.sm]: "200px",
    },
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  copy: {
    paddingTop: {
      default: verticalSpace["2xl"],
      [breakpoints.sm]: verticalSpace["6xl"],
    },
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: "min(100%, 24rem)",
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  action: {
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
    flexShrink: 0,
  },
  /**
   * Soft accent surfaces — concrete duplicate of `AppTagCard`'s `softXxxSurface` styles.
   * Keeping them inline (rather than extracting a shared module) avoids cross-file stylex
   * coupling; the data table for which accent maps where lives in `app-tag-visuals.ts`.
   */
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
  /**
   * Emoji scatter — same parallax approach as `AppTagCard` / `EcosystemCategoryCard`. The
   * banner's wider 16:5-ish shape leaves room for a denser scatter, so we use 5 slots
   * spread across the width with a strong right-side anchor to balance the title sitting
   * to the left when the page renders.
   */
  emojiBackdrop: {
    fontSize: "1rem",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  emojiBase: {
    color: uiColor.textContrast,
    filter: "drop-shadow(0 2px 4px rgb(0 0 0 / 0.35))",
    fontFamily:
      '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
    lineHeight: 1,
    pointerEvents: "none",
    position: "absolute",
    userSelect: "none",
  },
  emojiSlot1: {
    fontSize: "5em",
    opacity: 0.24,
    right: "8%",
    top: "16%",
    transform: "rotate(-12deg)",
  },
  emojiSlot2: {
    bottom: "12%",
    fontSize: "3.25em",
    opacity: 0.2,
    right: "30%",
    transform: "rotate(16deg)",
  },
  emojiSlot3: {
    fontSize: "3em",
    left: "44%",
    opacity: 0.22,
    top: "10%",
    transform: "rotate(22deg)",
  },
  emojiSlot4: {
    bottom: "16%",
    fontSize: "2.5em",
    left: "26%",
    opacity: 0.24,
    transform: "rotate(-18deg)",
  },
  emojiSlot5: {
    fontSize: "2.25em",
    left: "8%",
    opacity: 0.22,
    top: "24%",
    transform: "rotate(10deg)",
  },
});

export function AppTagHero({
  eyebrow,
  title,
  description,
  accent,
  emojis,
  imageSrc,
  action,
}: AppTagHeroProps) {
  const bannerSrc = resolveBannerRecordUrl(imageSrc);
  const slotEmojis = buildSlotEmojis(emojis);

  return (
    <Flex direction="column" gap="4xl" style={styles.root}>
      {accent ? (
        <div
          aria-hidden="true"
          {...stylex.props(styles.accentBanner, getSoftAccentSurface(accent))}
        >
          {slotEmojis ? (
            <div {...stylex.props(styles.emojiBackdrop)}>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot1)}>
                {slotEmojis[0]}
              </span>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot2)}>
                {slotEmojis[1]}
              </span>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot3)}>
                {slotEmojis[2]}
              </span>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot4)}>
                {slotEmojis[3]}
              </span>
              <span {...stylex.props(styles.emojiBase, styles.emojiSlot5)}>
                {slotEmojis[4]}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div {...stylex.props(styles.imageFrame, ui.bgSubtle)}>
          {bannerSrc ? (
            <img {...stylex.props(styles.image)} alt="" src={bannerSrc} />
          ) : (
            <div {...stylex.props(styles.imageFallback)} aria-hidden="true" />
          )}
        </div>
      )}

      <Flex justify="between" gap="5xl" align="end" wrap>
        <Flex direction="column" gap="5xl" style={styles.copy}>
          {eyebrow ? (
            <SmallBody style={styles.eyebrow}>{eyebrow}</SmallBody>
          ) : null}
          <Text size={{ default: "4xl", sm: "6xl" }} weight="semibold">
            {title}
          </Text>
          {description ? <Body variant="secondary">{description}</Body> : null}
        </Flex>
        {action ? (
          <Flex align="center" justify="end" gap="md" style={styles.action}>
            {action}
          </Flex>
        ) : null}
      </Flex>
    </Flex>
  );
}

const SLOT_COUNT = 5;

/**
 * Cycle the caller-supplied emoji list to fill the 5 scatter slots. Returns `null` when
 * no emojis were provided so the banner can render bare-gradient (used for "any tag" /
 * "any category" landing pages where there's no obvious emoji to anchor on).
 */
function buildSlotEmojis(emojis: string[] | undefined): string[] | null {
  if (!emojis || emojis.length === 0) {
    return null;
  }

  const slots: string[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const emoji = emojis[i % emojis.length];
    slots.push(emoji ?? emojis[0]);
  }
  return slots;
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
