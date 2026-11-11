import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../../design-system/theme/color.stylex";
import { ListingIcon } from "./ListingIcon";

const styles = stylex.create({
  stack: {
    display: "inline-flex",
    flexShrink: 0,
  },
  item: {
    boxShadow: `0 0 0 2px ${uiColor.bgSubtle}`,
    marginLeft: { default: -6, ":first-child": 0 },
  },
});

/** Up to four overlapping app icons, e.g. "apps that use this data". */
export function IconStack({
  listings,
  size = 24,
  max = 4,
}: {
  listings: Array<{ name: string; iconUrl: string | null }>;
  size?: number;
  max?: number;
}) {
  if (listings.length === 0) return null;
  return (
    <span aria-hidden {...stylex.props(styles.stack)}>
      {listings.slice(0, max).map((listing) => (
        <ListingIcon
          key={listing.name}
          name={listing.name}
          src={listing.iconUrl}
          size={size}
          style={styles.item}
        />
      ))}
    </span>
  );
}
