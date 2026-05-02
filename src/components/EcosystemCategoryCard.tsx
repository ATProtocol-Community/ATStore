import * as stylex from "@stylexjs/stylex";
import { LocaleLink as RouterLink } from "./LocaleLink";
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
import { resolveResizedBannerRecordUrl } from "../lib/banner-record-url";

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
  },
  cardContent: {
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
    opacity: 0.78,
    position: "absolute",
    width: "100%",
  },
  cardOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 28%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 58%, transparent) 45%, color-mix(in srgb, ${uiColor.overlayBackdrop} 94%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
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
});

type EcosystemCategoryCardProps = {
  category: DirectoryCategoryTreeNode;
  imageSrc?: string | null;
};

export function EcosystemCategoryCard({
  category,
  imageSrc,
}: EcosystemCategoryCardProps) {
  const accent = category.accent;
  const bannerSrc = resolveResizedBannerRecordUrl(imageSrc, {
    width: 1280,
    height: 720,
    mode: "fill",
  });

  return (
    <RouterLink
      to="/$locale/categories/$categoryId"
      params={{ categoryId: category.id }}
      {...stylex.props(styles.card, getSoftAccentSurface(accent))}
    >
      {bannerSrc ? (
        <img
          {...stylex.props(styles.cardImage)}
          alt=""
          aria-hidden="true"
          src={bannerSrc}
        />
      ) : null}
      <div {...stylex.props(styles.cardOverlay)} />
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
