"use client";

import * as stylex from "@stylexjs/stylex";
import { animationDuration } from "#/design-system/theme/animations.stylex";
import { uiColor } from "#/design-system/theme/color.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import { horizontalSpace } from "#/design-system/theme/semantic-spacing.stylex";
import { fontFamily, fontSize } from "#/design-system/theme/typography.stylex";
import { Tooltip } from "#/design-system/tooltip";
import { Link as AriaLink } from "react-aria-components";

const styles = stylex.create({
  chip: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    color: uiColor.text2,
    columnGap: 6,
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: 500,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    height: 30,
  },
  chipMd: {
    paddingInline: horizontalSpace["2xl"],
    fontSize: fontSize.base,
    height: 36,
  },
  chipSm: {
    paddingInlineStart: 6,
  },
  germIcon: {
    display: "block",
    flexShrink: 0,
    objectFit: "contain",
  },
  germIconMd: {
    height: 24,
    width: 24,
  },
  germIconSm: {
    height: 20,
    width: 20,
  },
});

export function GermNetworkBadge({
  href,
  size: sizeProp = "sm",
}: {
  /** Germ deep link: `${messageMeUrl}/web#[profileDid]+[viewerDid]` */
  href: string;
  size?: "sm" | "md";
}) {
  const isMd = sizeProp === "md";

  return (
    <Tooltip text="Open an encrypted Germ DM with this account (AT Protocol).">
      <AriaLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...stylex.props(styles.chip, isMd ? styles.chipMd : styles.chipSm)}
        aria-label="Open Germ DM"
      >
        <img
          src="/germ-logo.png"
          alt=""
          decoding="async"
          {...stylex.props(
            styles.germIcon,
            isMd ? styles.germIconMd : styles.germIconSm,
          )}
          draggable={false}
        />
        Germ DM
      </AriaLink>
    </Tooltip>
  );
}
