"use client";

import * as stylex from "@stylexjs/stylex";
import { use } from "react";

import type { ButtonVariant, Size } from "../theme/types";

import { ButtonGroupContext } from "../button/context";
import { SizeContext } from "../context";
import { animationDuration } from "./animations.stylex";
import { primaryColor, uiColor } from "./color.stylex";
import { radius } from "./radius.stylex";
import { critical, ui } from "./semantic-color.stylex";
import {
  gap,
  horizontalSpace,
  size as sizeSpace,
} from "./semantic-spacing.stylex";
import { shadow } from "./shadow.stylex";
import { spacing } from "./spacing.stylex";
import { fontFamily, fontSize, fontWeight } from "./typography.stylex";

const styles = stylex.create({
  shadow: {
    boxShadow: shadow["xs"],
  },
  base: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",
    textDecoration: "none",

    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,

    gap: gap["xs"],
    alignItems: "center",
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: fontFamily["sans"],
    fontWeight: fontWeight["semibold"],
    justifyContent: "center",
    letterSpacing: "-0.005em",
    opacity: {
      ":disabled": 0.5,
    },
    pointerEvents: {
      ":disabled": "none",
    },
    transitionDuration: animationDuration.fast,
    transitionProperty:
      "background-color, border-color, color, opacity, transform",
    transitionTimingFunction: "ease-in-out",
    userSelect: "none",
    whiteSpace: "nowrap",
    transform: {
      default: null,
      ":is([data-pressed])": "scale(0.98)",
    },

    ":is(*) svg": {
      flexShrink: 0,
      pointerEvents: "none",
      height: sizeSpace["md"],
      width: sizeSpace["md"],
    },
  },
  small: {
    fontSize: fontSize["sm"],
    height: sizeSpace["3xl"],
    paddingLeft: {
      default: horizontalSpace["md"],
    },
    paddingRight: horizontalSpace["md"],

    ":is(*) svg": {
      flexShrink: 0,
      pointerEvents: "none",
      height: sizeSpace["md"],
      width: sizeSpace["md"],
    },
  },
  medium: {
    gap: gap["sm"],
    fontSize: fontSize["sm"],
    height: spacing["9"],
    paddingLeft: {
      default: horizontalSpace["xl"],
      ":has(svg+*)": horizontalSpace["md"],
    },
    paddingRight: horizontalSpace["xl"],
  },
  large: {
    gap: gap["md"],
    fontSize: "0.9375rem",
    height: sizeSpace["4xl"],
    paddingLeft: {
      default: horizontalSpace["3xl"],
      ":has(svg+*)": horizontalSpace["md"],
    },
    paddingRight: horizontalSpace["3xl"],
  },
  xl: {
    gap: gap["md"],
    fontSize: fontSize["lg"],
    height: sizeSpace["5xl"],
    paddingLeft: {
      default: horizontalSpace["4xl"],
      ":has(svg+*)": horizontalSpace["2xl"],
    },
    paddingRight: horizontalSpace["4xl"],
  },
  // Shelf: primary is a solid ink pill; secondary is a surface pill with a
  // hairline that darkens to ink on hover.
  primarySolid: {
    backgroundColor: {
      default: primaryColor.solid1,
      ":is([data-hovered])": primaryColor.solid2,
      ":disabled": primaryColor.solid1,
    },
    borderColor: primaryColor.solid1,
    color: primaryColor.textContrast,
  },
  secondary: {
    backgroundColor: uiColor.bg,
    borderColor: {
      default: uiColor.border2,
      ":is([data-hovered])": uiColor.text2,
      ":is([data-pressed])": uiColor.text2,
    },
  },
  tertiary: {
    borderColor: {
      default: "transparent",
      ":is([data-hovered])": uiColor.component2,
      ":is([data-pressed])": uiColor.component3,
    },
  },

  groupHorizontal: {
    borderBottomLeftRadius: { ":not(:first-child)": `0 !important` },
    borderBottomRightRadius: { ":not(:last-child)": `0 !important` },
    borderLeftWidth: { ":not(:first-child)": `0 !important` },
    borderTopLeftRadius: { ":not(:first-child)": `0 !important` },
    borderTopRightRadius: { ":not(:last-child)": `0 !important` },
  },
  secondaryGroupedHorizontal: {
    borderRightColor: { ":not(:last-child)": uiColor.border2 },
  },
  groupVertical: {
    borderBottomLeftRadius: { ":not(:last-child)": `0 !important` },
    borderBottomRightRadius: { ":not(:last-child)": `0 !important` },
    borderTopLeftRadius: { ":not(:first-child)": `0 !important` },
    borderTopRightRadius: { ":not(:first-child)": `0 !important` },
    borderTopWidth: { ":not(:first-child)": `0 !important` },
  },
  secondaryGroupedVertical: {
    borderBottomColor: { ":not(:last-child)": uiColor.border2 },
  },
  separate: {
    flexBasis:
      "calc((1 / var(--items-per-row)) * (100% - (var(--toggle-button-group-gap) * (var(--items-per-row) - 1))))",
    flexGrow: 1,
    flexShrink: 1,
  },
});

export const useButtonStyles = ({
  variant = "primary",
  size: sizeProp,
}: {
  variant?: ButtonVariant;
  size?: Size | "xl";
}) => {
  const size = sizeProp || use(SizeContext);
  const group = use(ButtonGroupContext);

  return [
    group?.orientation === "horizontal" &&
      group.variant === "grouped" &&
      styles.groupHorizontal,
    group?.orientation === "vertical" &&
      group.variant === "grouped" &&
      styles.groupVertical,
    variant === "primary" && styles.primarySolid,
    variant === "secondary" && [
      styles.secondary,
      ui.text,
      group?.orientation === "horizontal" &&
        group.variant === "grouped" &&
        styles.secondaryGroupedHorizontal,
      group?.orientation === "vertical" &&
        group.variant === "grouped" &&
        styles.secondaryGroupedVertical,
    ],
    variant === "tertiary" && [
      ui.bgGhost,
      styles.tertiary,
      ui.text,
      group?.orientation === "horizontal" &&
        group.variant === "grouped" &&
        styles.secondaryGroupedHorizontal,
      group?.orientation === "vertical" &&
        group.variant === "grouped" &&
        styles.secondaryGroupedVertical,
    ],
    variant === "outline" && [
      ui.borderInteractive,
      ui.bgGhost,
      ui.text,
      styles.shadow,
    ],
    variant === "critical" && [
      critical.bgSolidAction,
      critical.borderInteractive,
      critical.textContrast,
      styles.shadow,
    ],
    variant === "critical-outline" && [
      critical.borderInteractive,
      critical.bgUi,
      critical.text,
      styles.shadow,
    ],
    size === "sm" && styles.small,
    size === "md" && styles.medium,
    size === "lg" && styles.large,
    size === "xl" && styles.xl,
    group?.variant === "separate" && styles.separate,
    styles.base,
  ];
};
