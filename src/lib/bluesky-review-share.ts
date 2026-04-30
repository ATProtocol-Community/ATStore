/**
 * Bluesky composer intent with the canonical reviews deep link (`?review=`),
 * matching the share control on listing review cards.
 */
export function blueskyReviewShareIntentHref(
  productSlug: string,
  reviewId: string,
): string {
  const path = `/products/${productSlug}/reviews?review=${reviewId}`;
  const origin =
    globalThis.window === undefined
      ? (process.env.BETTER_AUTH_URL ?? "").trim().replace(/\/+$/, "")
      : globalThis.window.location.origin;
  const absolute = origin ? `${origin}${path}` : path;
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(absolute)}`;
}
