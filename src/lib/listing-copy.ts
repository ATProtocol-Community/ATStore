const EMBEDDED_METADATA_LINE_RE =
  /^(Category|Alternative to|Platforms|Status|Last checked):\s+/i;

function normalizeWhitespace(value: string): string {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .replaceAll(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripEmbeddedListingMetadata(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const cleaned = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !EMBEDDED_METADATA_LINE_RE.test(line))
    .join("\n");

  const collapsed = normalizeWhitespace(cleaned);
  return collapsed.length > 0 ? collapsed : null;
}

export function sanitizeListingTagline(value: string | null | undefined) {
  const cleaned = stripEmbeddedListingMetadata(value);
  if (!cleaned) {
    return null;
  }

  const firstLine = cleaned.split("\n")[0]?.trim() ?? "";
  return firstLine || null;
}

export function sanitizeListingDescription(value: string | null | undefined) {
  return stripEmbeddedListingMetadata(value);
}

export function isMeaningfulListingCopy(
  value: string | null | undefined,
  options?: { minLength?: number },
) {
  const cleaned = sanitizeListingDescription(value);
  const minLength = options?.minLength ?? 40;
  return typeof cleaned === "string" && cleaned.length >= minLength;
}

const HERO_IMAGE_ALT_MAX_SUMMARY_LENGTH = 140;

/**
 * Build descriptive alt text for a featured listing hero image.
 *
 * Combines the listing name with its tagline (or the first sentence of the
 * description as a fallback) so screen-reader users get the same context that
 * sighted users get from the artwork. Falls back to just the name when no
 * usable copy is available.
 */
export function getDirectoryListingHeroImageAlt(listing: {
  name: string;
  tagline?: string | null;
  description?: string | null;
}): string {
  const name = listing.name?.trim() || "Product";

  const tagline = sanitizeListingTagline(listing.tagline);
  let summary = tagline?.trim() ?? "";

  if (!summary) {
    const description = sanitizeListingDescription(listing.description);
    if (description) {
      const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim();
      summary = firstSentence || description;
    }
  }

  if (!summary) {
    return name;
  }

  if (summary.length > HERO_IMAGE_ALT_MAX_SUMMARY_LENGTH) {
    summary =
      summary
        .slice(0, HERO_IMAGE_ALT_MAX_SUMMARY_LENGTH)
        .replace(/\s+\S*$/, "") + "…";
  }

  return `${name} — ${summary}`;
}
