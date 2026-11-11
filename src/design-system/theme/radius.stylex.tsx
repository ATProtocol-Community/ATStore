import * as stylex from "@stylexjs/stylex";

/**
 * Shelf radii: plain rounded corners (no squircle-specific bumps) so cards,
 * images and inputs look the same in every browser. Buttons and chips use
 * `full` for pills.
 */
export const radius = stylex.defineVars({
  xs: "0.375rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.75rem",
  "4xl": "2rem",
  full: "calc(infinity * 1px)",
});
