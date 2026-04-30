/**
 * App tags: normalized lowercase strings for storage and comparison.
 * Display can title-case when needed; canonical form is lowercase.
 */

const MAX_TAG_LENGTH = 80;

export function normalizeAppTag(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null;
  }

  const trimmed = raw.trim().toLowerCase().replaceAll(/\s+/g, " ");
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.length > MAX_TAG_LENGTH
    ? trimmed.slice(0, MAX_TAG_LENGTH)
    : trimmed;
}

export function normalizeAppTags(
  tags: Iterable<string | null | undefined>,
): Array<string> {
  const seen = new Set<string>();
  const out: Array<string> = [];

  for (const t of tags) {
    const n = normalizeAppTag(t ?? undefined);
    if (!n || seen.has(n)) {
      continue;
    }

    seen.add(n);
    out.push(n);
  }

  return out.toSorted((a, b) => a.localeCompare(b));
}

export function tagsEqual(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean {
  const left = normalizeAppTags(a);
  const right = normalizeAppTags(b);

  if (left.length !== right.length) {
    return false;
  }

  return left.every((tag, index) => tag === right[index]);
}

function tokenizeMetadata(value: string | null | undefined): Array<string> {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/[/,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Derive tag candidates from listing metadata and category slug segments.
 */
export function suggestAppTagsFromListing(input: {
  scope: string | null;
  productType: string | null;
  domain: string | null;
  vertical: string | null;
  rawCategoryHint: string | null;
  categorySlug: string | null;
}): Array<string> {
  const parts: Array<string> = [];

  for (const v of [
    input.scope,
    input.productType,
    input.vertical,
    input.rawCategoryHint,
  ]) {
    if (v) {
      parts.push(...tokenizeMetadata(v));
    }
  }

  if (input.domain) {
    const host = input.domain.replace(/^https?:\/\//, "").split("/")[0] ?? "";
    const noWww = host.replace(/^www\./, "");
    const firstLabel = noWww.split(".")[0];
    if (firstLabel && firstLabel.length > 1) {
      parts.push(firstLabel);
    }
  }

  if (input.categorySlug) {
    const segments = input.categorySlug.split("/").filter(Boolean);
    for (const seg of segments) {
      parts.push(seg.replaceAll(/[-_]+/g, " "));
    }
  }

  return normalizeAppTags(parts);
}

/**
 * Tags used elsewhere in the DB, sorted by frequency (for suggestions).
 */
export function popularTagsFromAllAssignments(
  allTagLists: ReadonlyArray<ReadonlyArray<string>>,
  limit: number,
): Array<string> {
  const counts = new Map<string, number>();

  for (const list of allTagLists) {
    for (const t of normalizeAppTags(list)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .toSorted((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Suggested tags to show for hybrid pickers: metadata + popular, excluding already assigned.
 */
export function suggestedTagsForListing(
  assigned: ReadonlyArray<string>,
  metadataSuggestions: ReadonlyArray<string>,
  popular: ReadonlyArray<string>,
  maxSuggestions: number,
): Array<string> {
  const assignedSet = new Set(normalizeAppTags(assigned));
  const ordered: Array<string> = [];
  const seen = new Set<string>();

  function pushCandidate(tag: string) {
    const n = normalizeAppTag(tag);
    if (!n || assignedSet.has(n) || seen.has(n)) {
      return;
    }

    seen.add(n);
    ordered.push(n);
  }

  for (const t of metadataSuggestions) {
    pushCandidate(t);
    if (ordered.length >= maxSuggestions) {
      return ordered;
    }
  }

  for (const t of popular) {
    pushCandidate(t);
    if (ordered.length >= maxSuggestions) {
      return ordered;
    }
  }

  return ordered;
}
