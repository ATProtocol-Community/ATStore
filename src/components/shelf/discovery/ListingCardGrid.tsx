import * as stylex from "@stylexjs/stylex";

import type { CardListing } from "../ListingCard";

import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { ListingCard } from "../ListingCard";

const styles = stylex.create({
  grid: {
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
      [breakpoints.xl]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: 16,
  },
});

/** A plain responsive grid of text-first listing cards. */
export function ListingCardGrid({
  listings,
}: {
  listings: Array<CardListing & { id: string }>;
}) {
  return (
    <div {...stylex.props(styles.grid)}>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
