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
  /**
   * Optional predicate gating which items are eligible for a featured slot.
   * Items that fail this check are swapped out of featured positions so a
   * hero-less listing never lands in the oversized card. If no eligible item
   * exists for a slot, that slot falls back to the non-featured layout.
   */
  canFeature?: (item: T) => boolean;
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
  hasFeatured = true,
  getKey,
  isFeatured = (_, index) => index % 9 === 0,
  canFeature,
  renderItem,
  style,
}: StyleXComponentProps<FeaturedListingGridProps<T>>) {
  const arrangedItems = arrangeForFeaturing({
    items,
    hasFeatured,
    isFeatured,
    canFeature,
  });

  return (
    <Grid style={[styles.grid, style]}>
      {arrangedItems.map((item, index) => {
        const featured =
          hasFeatured &&
          isFeatured(item, index) &&
          (canFeature ? canFeature(item) : true);

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

function arrangeForFeaturing<T>({
  items,
  hasFeatured,
  isFeatured,
  canFeature,
}: {
  items: T[];
  hasFeatured: boolean;
  isFeatured: (item: T, index: number) => boolean;
  canFeature?: (item: T) => boolean;
}): T[] {
  if (!hasFeatured || !canFeature) return items;

  const arranged = items.slice();
  const featuredFlags = arranged.map((item, index) => isFeatured(item, index));

  let swapCursor = 0;
  for (let i = 0; i < arranged.length; i++) {
    if (!featuredFlags[i]) continue;
    if (canFeature(arranged[i])) continue;

    while (swapCursor < arranged.length) {
      if (!featuredFlags[swapCursor] && canFeature(arranged[swapCursor])) {
        const tmp = arranged[i];
        arranged[i] = arranged[swapCursor];
        arranged[swapCursor] = tmp;
        swapCursor++;
        break;
      }
      swapCursor++;
    }
  }

  return arranged;
}
