import * as stylex from "@stylexjs/stylex";

/** Warm-tinted shadows (ink at low alpha) that sit well on the paper background. */
export const shadow = stylex.defineVars({
  "2xs": "0 1px rgb(25 24 22 / 0.04)",
  xs: "0 1px 2px 0 rgb(25 24 22 / 0.05)",
  sm: "0 1px 2px rgb(25 24 22 / 0.04), 0 4px 12px -6px rgb(25 24 22 / 0.14)",
  md: "0 1px 2px rgb(25 24 22 / 0.04), 0 8px 24px -12px rgb(25 24 22 / 0.2)",
  lg: "0 2px 4px rgb(25 24 22 / 0.04), 0 16px 40px -16px rgb(25 24 22 / 0.28)",
  xl: "0 20px 50px -12px rgb(25 24 22 / 0.3)",
  "2xl": "0 30px 80px -20px rgb(25 24 22 / 0.4)",
  none: "0 0 #0000",
  inset: "inset 0 0 4px 0 rgb(25 24 22 / 0.1)",
  insetSm: "inset 0 0 4px 0 rgb(25 24 22 / 0.05)",
  insetMd: "inset 0 0 4px 0 rgb(25 24 22 / 0.1)",
  insetLg: "inset 0 0 8px 0 rgb(25 24 22 / 0.15)",
});
