import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { VisuallyHidden } from "react-aria";

import type { DirectoryAppTagGroup } from "../../../integrations/tanstack-query/api-directory-listings.functions";

import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagLinkOptions,
} from "../../../lib/app-tag-metadata";
import { IconStack } from "../IconStack";
import {
  getWrittenAppTagDescription,
  orderTagGroups,
  summarizeTagApps,
} from "./tag-index";

const styles = stylex.create({
  index: {
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
    rowGap: 0,
    borderTopColor: uiColor.text2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  tile: {
    textDecoration: "none",
    color: "inherit",
    columnGap: 10,
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 10,
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    minWidth: 0,
    paddingBottom: 24,
    paddingTop: 22,
  },
  top: {
    alignItems: "baseline",
    columnGap: 12,
    display: "flex",
    justifyContent: "space-between",
    rowGap: 12,
  },
  name: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 24, [breakpoints.md]: 28 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.022em",
    lineHeight: 1.1,
    textDecorationColor: {
      default: "transparent",
      [stylex.when.ancestor(":hover")]: uiColor.border3,
    },
    textDecorationLine: "underline",
    textDecorationThickness: 2,
    textUnderlineOffset: 5,
    transitionDuration: animationDuration.default,
    transitionProperty: "text-decoration-color",
  },
  count: {
    color: uiColor.text1,
    flexShrink: 0,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
  },
  text: {
    margin: 0,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 14,
    lineHeight: 1.5,
    minHeight: "1.5em",
  },
  oneLine: {
    WebkitLineClamp: 1,
  },
});

/** The tag index on /apps/tags: a ruled three-column list of text-first tiles. */
export function TagIndex({ groups }: { groups: Array<DirectoryAppTagGroup> }) {
  return (
    <div {...stylex.props(styles.index)}>
      {orderTagGroups(groups).map((group) => (
        <TagTile key={group.tag} group={group} />
      ))}
    </div>
  );
}

function TagTile({ group }: { group: DirectoryAppTagGroup }) {
  const label = formatAppTagLabel(group.tag);
  const description = getWrittenAppTagDescription(group.tag);

  return (
    <RouterLink
      {...getAppTagLinkOptions(group.tag)}
      {...stylex.props(styles.tile)}
    >
      <span {...stylex.props(styles.top)}>
        <h3 {...stylex.props(styles.name)}>{label}</h3>
        <span {...stylex.props(styles.count)}>
          <span aria-hidden>{group.count}</span>
          <VisuallyHidden>{formatAppTagCount(group.count)}</VisuallyHidden>
        </span>
      </span>
      <p {...stylex.props(styles.text, !description && styles.oneLine)}>
        {description ?? summarizeTagApps(group)}
      </p>
      <IconStack listings={group.listings} size={28} />
    </RouterLink>
  );
}
