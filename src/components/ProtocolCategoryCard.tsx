import * as stylex from "@stylexjs/stylex";
import { LocaleLink as RouterLink } from "./LocaleLink";
import { ChevronRight } from "lucide-react";

import { Flex } from "../design-system/flex";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { green } from "../design-system/theme/colors/green.stylex";
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
import type { DirectoryProtocolCategorySummary } from "../integrations/tanstack-query/api-directory-listings.functions";
import { resolveResizedBannerRecordUrl } from "../lib/banner-record-url";
import { getProtocolCategoryCoverAssetPathForSegment } from "../lib/protocol-category-hero-art";

const styles = stylex.create({
  card: {
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
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["4xl"],
    position: "relative",
    textDecoration: "none",
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
  title: {
    color: uiColor.textContrast,
    textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
  },
  eyebrow: {
    color: uiColor.textContrast,
    letterSpacing: "0.16em",
    textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
    textTransform: "uppercase",
  },
});

type ProtocolCategoryCardProps = {
  category: Pick<
    DirectoryProtocolCategorySummary,
    "segment" | "label" | "count"
  >;
};

export function ProtocolCategoryCard({ category }: ProtocolCategoryCardProps) {
  const accent = getProtocolCategoryAccent(category.segment);
  const coverSrc = resolveResizedBannerRecordUrl(
    getProtocolCategoryCoverAssetPathForSegment(category.segment),
    { width: 640, height: 480, mode: "fill" },
  );

  return (
    <RouterLink
      params={{ category: category.segment }}
      to="/$locale/protocol/$category"
      {...stylex.props(styles.card, getSoftAccentSurface(accent))}
    >
      {coverSrc ? (
        <img
          alt=""
          aria-hidden="true"
          src={coverSrc}
          {...stylex.props(styles.cardImage)}
        />
      ) : null}
      <div {...stylex.props(styles.cardOverlay)} />
      <Flex direction="column" gap="2xl" style={styles.cardContent}>
        <SmallBody style={styles.eyebrow}>Protocol</SmallBody>
        <Text size="2xl" weight="semibold" style={styles.title}>
          {category.label}
        </Text>
      </Flex>
      <Flex align="center" justify="between" gap="md" style={styles.cardFooter}>
        <SmallBody style={styles.footerText}>
          {formatProtocolCategoryCount(category.count)}
        </SmallBody>
        <ChevronRight {...stylex.props(styles.chevron)} />
      </Flex>
    </RouterLink>
  );
}

function formatProtocolCategoryCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getProtocolCategoryAccent(
  segment: string,
): "blue" | "pink" | "purple" | "green" {
  if (segment === "pds") return "purple";
  if (segment === "appview") return "green";

  return "purple";
}

function getSoftAccentSurface(accent: "blue" | "pink" | "purple" | "green") {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
}
