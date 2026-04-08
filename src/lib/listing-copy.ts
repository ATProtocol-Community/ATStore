const EMBEDDED_METADATA_LINE_RE =
  /^(Category|Alternative to|Platforms|Status|Last checked):\s+/i

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function stripEmbeddedListingMetadata(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return null
  }

  const cleaned = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !EMBEDDED_METADATA_LINE_RE.test(line))
    .join('\n')

  const collapsed = normalizeWhitespace(cleaned)
  return collapsed.length > 0 ? collapsed : null
}

export function sanitizeListingTagline(value: string | null | undefined) {
  const cleaned = stripEmbeddedListingMetadata(value)
  if (!cleaned) {
    return null
  }

  const firstLine = cleaned.split('\n')[0]?.trim() ?? ''
  return firstLine || null
}

export function sanitizeListingDescription(value: string | null | undefined) {
  return stripEmbeddedListingMetadata(value)
}

export function isMeaningfulListingCopy(
  value: string | null | undefined,
  options?: { minLength?: number },
) {
  const cleaned = sanitizeListingDescription(value)
  const minLength = options?.minLength ?? 40
  return typeof cleaned === 'string' && cleaned.length >= minLength
}
