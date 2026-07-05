/**
 * Bluesky rich-text mechanics for posting `app.bsky.feed.post` records: grapheme-aware
 * truncation (Bluesky enforces a 300-grapheme limit, not a byte or UTF-16 limit) and
 * byte-offset mention facets.
 */

export const BLUESKY_POST_MAX_GRAPHEMES = 300;

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const textEncoder = new TextEncoder();

export function graphemeLength(text: string): number {
  return [...graphemeSegmenter.segment(text)].length;
}

function truncateGraphemes(text: string, max: number): string {
  if (max <= 0) return "";
  return [...graphemeSegmenter.segment(text)]
    .slice(0, max)
    .map((s) => s.segment)
    .join("");
}

/** Keep only full sentences that fit the grapheme budget; falls back to a word-boundary cut. */
export function truncateGraphemesToCompleteSentences(
  text: string,
  max: number,
): string {
  if (max <= 0) return "";
  if (graphemeLength(text) <= max) return text;

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [];
  let result = "";
  for (const sentence of sentences) {
    const candidate = `${result}${sentence}`;
    if (graphemeLength(candidate.trim()) <= max) {
      result = candidate;
    } else {
      break;
    }
  }

  const trimmed = result.trimEnd();
  if (trimmed.length > 0) return trimmed;

  const hardCut = truncateGraphemes(text, max);
  const spaceIdx = hardCut.lastIndexOf(" ");
  return (spaceIdx > 0 ? hardCut.slice(0, spaceIdx) : hardCut).trimEnd();
}

export function mentionDisplayText(handle: string): string {
  return `@${handle.trim().replace(/^@/, "")}`;
}

export type BlueskyMentionFacet = {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: "app.bsky.richtext.facet#mention"; did: string }>;
};

/** Byte-offset facet for an `@handle` mention already present verbatim in `text`. */
export function buildMentionFacet(
  text: string,
  mention: { did: string; handle: string },
): Array<BlueskyMentionFacet> | undefined {
  const display = mentionDisplayText(mention.handle);
  const start = text.indexOf(display);
  if (start === -1) return undefined;
  const byteStart = textEncoder.encode(text.slice(0, start)).length;
  const byteEnd = textEncoder.encode(
    text.slice(0, start + display.length),
  ).length;
  return [
    {
      index: { byteStart, byteEnd },
      features: [
        { $type: "app.bsky.richtext.facet#mention", did: mention.did },
      ],
    },
  ];
}

/** Headroom for sanitize drift and LLM overshoot. */
const PROMO_BODY_BUFFER_GRAPHEMES = 12;

/** Grapheme budget left for LLM-generated prose once the mention suffix is reserved. */
export function maxPromoBodyGraphemes(
  handle?: string | null,
  maxTotal = BLUESKY_POST_MAX_GRAPHEMES,
): number {
  const mentionSuffix = handle?.trim()
    ? `\n\n${mentionDisplayText(handle)}`
    : "";
  return Math.max(
    0,
    maxTotal - graphemeLength(mentionSuffix) - PROMO_BODY_BUFFER_GRAPHEMES,
  );
}

/**
 * Combine LLM prose with an optional trailing `@mention` line, trimmed to Bluesky's
 * grapheme budget with headroom reserved for the mention suffix.
 */
export function assembleListingPromoPost(
  body: string,
  mention: { did: string; handle: string } | null,
): { text: string; facets: Array<BlueskyMentionFacet> | undefined } {
  const mentionSuffix = mention
    ? `\n\n${mentionDisplayText(mention.handle)}`
    : "";
  const maxBody = Math.max(
    0,
    BLUESKY_POST_MAX_GRAPHEMES - graphemeLength(mentionSuffix),
  );
  const trimmedBody = truncateGraphemesToCompleteSentences(
    body.trim(),
    maxBody,
  );
  const text =
    trimmedBody.length > 0
      ? `${trimmedBody}${mentionSuffix}`
      : mentionSuffix.trimStart();
  const facets = mention ? buildMentionFacet(text, mention) : undefined;
  return { text, facets };
}
