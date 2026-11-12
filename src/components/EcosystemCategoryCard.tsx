import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { DirectoryCategoryTreeNode } from "../lib/directory-categories";

import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { formatEcosystemListingCount } from "../lib/ecosystem-listings";

const styles = stylex.create({
  card: {
    padding: 20,
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    boxShadow: { default: shadow.none, ":hover": shadow.md },
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 6,
    transform: { default: null, ":hover": "translateY(-2px)" },
    transitionDuration: animationDuration.slow,
    transitionProperty: "border-color, box-shadow, transform",
    minWidth: 0,
  },
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    color: uiColor.text2,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.006em",
  },
  description: {
    color: uiColor.text1,
    fontSize: 14,
    lineHeight: 1.45,
  },
  foot: {
    alignItems: "center",
    color: uiColor.text1,
    display: "flex",
    fontSize: 13,
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: 10,
  },
  arrow: {
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "translateX(2px)",
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "transform",
  },
});

type EcosystemCategoryCardProps = {
  category: DirectoryCategoryTreeNode;
};

/** Text-first card for one category inside an app's ecosystem. */
export function EcosystemCategoryCard({
  category,
}: EcosystemCategoryCardProps) {
  return (
    <RouterLink
      to="/apps"
      search={{ in: category.id }}
      {...stylex.props(styles.card)}
    >
      <span {...stylex.props(styles.eyebrow)}>
        {category.pathLabels.slice(1, -1).join(" / ") || category.pathLabels[0]}
      </span>
      <span {...stylex.props(styles.title)}>{category.label}</span>
      <span {...stylex.props(styles.description)}>{category.description}</span>
      <span {...stylex.props(styles.foot)}>
        {formatEcosystemListingCount(category.count)}
        <ArrowRight size={15} aria-hidden {...stylex.props(styles.arrow)} />
      </span>
    </RouterLink>
  );
}
