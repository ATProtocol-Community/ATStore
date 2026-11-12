import * as stylex from "@stylexjs/stylex";
import { Star } from "lucide-react";

import { uiColor } from "../../design-system/theme/color.stylex";
import { MIN_REVIEWS_FOR_AVERAGE, formatReviewCount } from "./format";

const styles = stylex.create({
  rate: {
    alignItems: "center",
    color: uiColor.text2,
    columnGap: "0.25em",
    display: "inline-flex",
    fontVariantNumeric: "tabular-nums",
    rowGap: "0.25em",
    whiteSpace: "nowrap",
  },
  count: {
    color: uiColor.text1,
  },
  muted: {
    color: uiColor.text1,
    whiteSpace: "nowrap",
  },
  star: {
    fill: "currentColor",
    flexShrink: 0,
  },
});

/**
 * Compact rating for rows and cards: "★ 4.8 (37)" once a listing has enough
 * reviews for an average to mean something, "1 review" below that, and
 * nothing (or `emptyLabel`) when there are none, so lists never show rows of
 * empty stars.
 */
export function ListingRating({
  rating,
  reviewCount,
  showCount = false,
  emptyLabel,
  style,
}: {
  rating: number | string | null | undefined;
  reviewCount: number;
  showCount?: boolean;
  emptyLabel?: string;
  style?: stylex.StyleXStyles;
}) {
  if (!reviewCount) {
    return emptyLabel ? (
      <span {...stylex.props(styles.muted, style)}>{emptyLabel}</span>
    ) : null;
  }
  if (reviewCount < MIN_REVIEWS_FOR_AVERAGE || rating == null) {
    return (
      <span {...stylex.props(styles.muted, style)}>
        {formatReviewCount(reviewCount)}
      </span>
    );
  }
  const value = Number(rating).toFixed(1);
  return (
    <span
      {...stylex.props(styles.rate, style)}
      aria-label={`Rated ${value} out of 5 from ${formatReviewCount(reviewCount)}`}
    >
      <Star size="0.95em" aria-hidden {...stylex.props(styles.star)} />
      {value}
      {showCount ? (
        <span {...stylex.props(styles.count)}>({reviewCount})</span>
      ) : null}
    </span>
  );
}
