/** Below this many reviews an average says more about one person than the app. */
export const MIN_REVIEWS_FOR_AVERAGE = 3;

export function formatReviewCount(count: number) {
  return `${count} ${count === 1 ? "review" : "reviews"}`;
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/** "yesterday", "3 days ago", "2 months ago". */
export function formatTimeAgo(iso: string) {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > -30) return relativeTimeFormat.format(days, "day");
  if (days > -365) {
    return relativeTimeFormat.format(Math.round(days / 30), "month");
  }
  return relativeTimeFormat.format(Math.round(days / 365), "year");
}
