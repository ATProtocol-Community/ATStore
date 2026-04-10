import type { DirectoryListing } from '#/db/schema'

const PLACEHOLDER_ICON = 'https://placehold.co/64x64/png'

export type FyiAtstoreListingDetail = {
  $type: 'fyi.atstore.listing.detail'
  slug: string
  name: string
  tagline: string
  description?: string
  externalUrl: string
  icon: string
  heroImage: string
  categorySlug: string
  screenshots?: string[]
  createdAt: string
  updatedAt: string
}

function isHttpsUri(s: string | null | undefined): s is string {
  if (!s?.trim()) return false
  try {
    const u = new URL(s.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** Prefer https; fall back to first valid URL in candidates. */
export function pickUri(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const c of candidates) {
    if (isHttpsUri(c)) return c!.trim()
  }
  return undefined
}

/**
 * Map a `directory_listings` row to a `fyi.atstore.listing.detail` record.
 * Uses sensible fallbacks so legacy rows without every asset still validate.
 */
export function directoryListingToDetailRecord(
  row: DirectoryListing,
): FyiAtstoreListingDetail {
  const externalUrl =
    pickUri(row.externalUrl, row.sourceUrl) ?? 'https://bsky.app'
  const icon =
    pickUri(row.iconUrl, row.screenshotUrls?.[0], externalUrl) ??
    PLACEHOLDER_ICON
  const hero =
    pickUri(
      row.heroImageUrl,
      row.screenshotUrls?.[0],
      row.iconUrl,
      externalUrl,
    ) ?? icon
  const tagline = row.tagline?.trim() || '—'
  const categorySlug = row.categorySlug?.trim() || 'misc'
  const createdAt = row.createdAt.toISOString()
  const updatedAt = row.updatedAt.toISOString()

  const record: FyiAtstoreListingDetail = {
    $type: 'fyi.atstore.listing.detail',
    slug: row.slug,
    name: row.name,
    tagline,
    externalUrl,
    icon,
    heroImage: hero,
    categorySlug,
    createdAt,
    updatedAt,
  }

  const desc = row.fullDescription?.trim()
  if (desc) record.description = desc

  const shots = row.screenshotUrls.filter((u) => isHttpsUri(u))
  if (shots.length > 0) record.screenshots = shots

  return record
}
