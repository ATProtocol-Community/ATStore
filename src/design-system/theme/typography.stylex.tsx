import * as stylex from "@stylexjs/stylex";

import { breakpoints } from "./media-queries.stylex";
import { verticalSpace } from "./semantic-spacing.stylex";

export const fontFamily = stylex.defineVars({
  title: "'Inter', sans-serif",
  sans: "'Inter', sans-serif",
  serif: "Georgia, serif",
  mono: "Monaco, monospace",
});

export const fontWeight = stylex.defineVars({
  thin: stylex.types.number(100),
  extralight: stylex.types.number(200),
  light: stylex.types.number(300),
  normal: stylex.types.number(400),
  medium: stylex.types.number(500),
  semibold: stylex.types.number(600),
  bold: stylex.types.number(700),
  extrabold: stylex.types.number(800),
  black: stylex.types.number(900),
});

export const fontSize = stylex.defineVars({
  xs: "0.75rem",
  sm: "0.85rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
  "7xl": "4.5rem",
  "8xl": "6rem",
  "9xl": "8rem",
});

export const lineHeight = stylex.defineVars({
  none: "1",
  xs: "0.8",
  sm: "1.25",
  base: "1.65",
  lg: "2",
  xl: "2.5",
  "2xl": "3",
  "3xl": "3.5",
});

export const tracking = stylex.defineVars({
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
});

export const typeramp = stylex.create({
  heading1: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["title"],
    fontSize: {
      default: fontSize["4xl"],
      [breakpoints.md]: fontSize["5xl"],
    },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["extrabold"],
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    scrollMarginBlockStart: verticalSpace["12xl"],
    marginRight: 0,
    marginTop: 0,
  },
  heading2: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["title"],
    fontSize: {
      default: fontSize["3xl"],
      [breakpoints.md]: fontSize["4xl"],
    },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight.semibold,
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    scrollMarginBlockStart: verticalSpace["12xl"],
    borderBottomWidth: 1,
    marginRight: 0,
    marginTop: 0,
  },
  heading3: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["title"],
    fontSize: { default: fontSize["xl"], [breakpoints.md]: fontSize["2xl"] },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["semibold"],
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    scrollMarginBlockStart: verticalSpace["12xl"],
    marginRight: 0,
    marginTop: 0,
  },
  heading4: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["title"],
    fontSize: { default: fontSize["xl"] },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["semibold"],
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    scrollMarginBlockStart: verticalSpace["12xl"],
    marginRight: 0,
    marginTop: 0,
  },
  heading5: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["title"],
    fontSize: { default: fontSize["lg"] },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["semibold"],
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    scrollMarginBlockStart: verticalSpace["12xl"],
    marginRight: 0,
    marginTop: 0,
  },
  body: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["sans"],
    fontSize: { default: fontSize["base"] },
    lineHeight: lineHeight.base,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
  },
  smallBody: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["sans"],
    fontSize: { default: fontSize["sm"] },
    lineHeight: lineHeight.base,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
  },
  label: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["sans"],
    fontSize: { default: fontSize["sm"] },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["semibold"],
    letterSpacing: tracking["tight"],
    lineHeight: lineHeight.sm,
    marginRight: 0,
    marginTop: 0,
  },
  sublabel: {
    textBoxEdge: "cap alphabetic",

    textBoxTrim: "trim-both",

    fontFamily: fontFamily["sans"],
    fontSize: { default: fontSize["xs"] },
    marginBottom: 0,
    marginLeft: 0,

    fontWeight: fontWeight["medium"],
    lineHeight: lineHeight.sm,
    marginRight: 0,
    marginTop: 0,
  },
});
