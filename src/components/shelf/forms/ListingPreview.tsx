import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../../../design-system/theme/color.stylex";
import { fontWeight } from "../../../design-system/theme/typography.stylex";
import { ListingCard } from "../ListingCard";
import { ListingRow } from "../ListingRow";

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: 16,
  },
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  block: {
    padding: 16,
    borderColor: uiColor.border2,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
  },
  blockLabel: {
    color: uiColor.text1,
    fontSize: 12,
    marginBottom: 6,
  },
  inert: {
    // Previews are links in the real directory; keep them from navigating away
    // from an unsaved form.
    pointerEvents: "none",
  },
});

export type ListingPreviewValues = {
  name: string;
  slug: string;
  tagline: string;
  iconUrl: string | null;
  productAccountHandle: string;
  appTags: Array<string>;
  rating: number | string | null;
  reviewCount: number;
};

/**
 * Live preview of how a listing will look in the directory, as a compact list
 * row and as a card. Fed from the form state; non-interactive.
 */
export function ListingPreview({ values }: { values: ListingPreviewValues }) {
  const listing = {
    name: values.name.trim() || "Your app",
    slug: values.slug || "preview",
    tagline: values.tagline.trim() || "Its tagline goes here",
    iconUrl: values.iconUrl,
    rating: values.rating,
    reviewCount: values.reviewCount,
    productAccountHandle: values.productAccountHandle.trim() || null,
    appTags: values.appTags,
  };

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.eyebrow)}>Preview</div>
      {/* Hidden from assistive tech: it repeats what the fields already say. */}
      <div inert aria-hidden {...stylex.props(styles.root, styles.inert)}>
        <div {...stylex.props(styles.block)}>
          <div {...stylex.props(styles.blockLabel)}>In lists</div>
          <ListingRow
            key={`row-${listing.iconUrl ?? ""}`}
            listing={listing}
            variant="compact"
          />
        </div>
        <div {...stylex.props(styles.block)}>
          <div {...stylex.props(styles.blockLabel)}>As a card</div>
          <ListingCard
            key={`card-${listing.iconUrl ?? ""}`}
            listing={listing}
          />
        </div>
      </div>
    </div>
  );
}
