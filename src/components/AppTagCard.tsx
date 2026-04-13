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
import {
  type DirectoryAppTagSummary,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagSlug,
} from "../lib/app-tag-metadata";
import { getAppTagHeroAssetPathForTag } from "../lib/app-tag-hero-art";
import { resolveResizedBannerRecordUrl } from "../lib/banner-record-url";

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
});

type AppTagCardProps = {
  tag: Pick<DirectoryAppTagSummary, "tag" | "count">;
};

export function AppTagCard({ tag }: AppTagCardProps) {
  const accent = getAppTagAccent(tag.tag);
  const imageSrc = resolveResizedBannerRecordUrl(
    getAppTagHeroAssetPathForTag(tag.tag),
    { width: 640, height: 360, mode: "fill" },
  );

  return (
    <RouterLink
      to="/apps/$tag"
      params={{ tag: getAppTagSlug(tag.tag) }}
      search={{ sort: "popular" }}
      {...stylex.props(styles.card, getSoftAccentSurface(accent))}
    >
      {imageSrc ? (
        <img
          {...stylex.props(styles.cardImage)}
          alt=""
          aria-hidden="true"
          src={imageSrc}
        />
      ) : null}
      <div {...stylex.props(styles.cardOverlay)} />
      <Flex direction="column" gap="2xl" style={styles.cardContent}>
        <Text
          size={{ default: "xl", sm: "2xl" }}
          weight="semibold"
          style={styles.title}
        >
          {formatAppTagLabel(tag.tag)}
        </Text>
      </Flex>
      <Flex align="center" justify="between" gap="md" style={styles.cardFooter}>
        <SmallBody style={styles.footerText}>
          {formatAppTagCount(tag.count)}
        </SmallBody>
        <ChevronRight {...stylex.props(styles.chevron)} />
      </Flex>
    </RouterLink>
  );
}

function getAppTagAccent(tag: string): DirectoryListingCard["accent"] {
  if (tag === "news") return "pink";
  if (tag === "social") return "purple";
  if (tag === "developers") return "green";

  return "blue";
}

function getSoftAccentSurface(accent: DirectoryListingCard["accent"]) {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
}
