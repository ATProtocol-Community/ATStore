import * as stylex from "@stylexjs/stylex";
import type { Key, ReactNode } from "react";

import { Grid } from "../design-system/grid";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { gap } from "../design-system/theme/semantic-spacing.stylex";
import type { StyleXComponentProps } from "#/design-system/theme";

const styles = stylex.create({
  grid: {
    display: "grid",
    gap: gap["2xl"],
    gridAutoFlow: "dense",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.xl]: "repeat(3, minmax(0, 1fr))",
    },
  },
  item: {
    minWidth: 0,
  },
  featuredItem: {
    aspectRatio: 16 / 9,
    gridColumn: {
      default: "auto",
      [breakpoints.sm]: "span 2",
    },
    gridRow: {
      default: "auto",
      [breakpoints.sm]: "span 2",
    },
  },
});

interface FeaturedListingGridProps<T> {
  hasFeatured?: boolean;
  items: T[];
  getKey: (item: T, index: number) => Key;
  isFeatured?: (item: T, index: number) => boolean;
  renderItem: (
    item: T,
    options: {
      featured: boolean;
      index: number;
    },
  ) => ReactNode;
}

export function FeaturedListingGrid<T>({
  items,
  hasFeatured = false,
  getKey,
  isFeatured = (_, index) => index % 9 === 0,
  renderItem,
  style,
}: StyleXComponentProps<FeaturedListingGridProps<T>>) {
  return (
    <Grid style={[styles.grid, style]}>
      {items.map((item, index) => {
        const featured = hasFeatured ? isFeatured(item, index) : false;

        return (
          <div
            key={getKey(item, index)}
            {...stylex.props(styles.item, featured && styles.featuredItem)}
          >
            {renderItem(item, { featured, index })}
          </div>
        );
      })}
    </Grid>
  );
}
