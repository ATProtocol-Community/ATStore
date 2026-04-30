import * as stylex from "@stylexjs/stylex";

import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { gap } from "../design-system/theme/semantic-spacing.stylex";

export const ecosystemListingGridStyles = stylex.create({
  grid: {
    gap: gap["xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
});
