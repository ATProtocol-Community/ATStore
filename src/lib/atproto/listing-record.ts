import type { Client } from '@atcute/client'
import type { Blob as AtprotoBlob } from '@atcute/lexicons/interfaces'

import type { DirectoryListing } from '#/db/schema'

import { uploadImageBlob } from '#/lib/atproto/blob-upload'
import { resolveUrlToImageBytes } from '#/lib/atproto/resolve-image-bytes'

const PLACEHOLDER_ICON = 'https://placehold.co/64x64/png'

function normalizeListingCategorySlugs(row: DirectoryListing): string[] {
  const raw = row.categorySlugs ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of raw) {
    const t = s?.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.length > 0 ? out : ['misc']
}
const PLACEHOLDER_HERO = 'https://placehold.co/1200x630/png'

export type FyiAtstoreListingDetail = {
  $type: 'fyi.atstore.listing.detail'
  slug: string
  name: string
  tagline: string
  description?: string
  externalUrl: string
  icon: AtprotoBlob
  heroImage: AtprotoBlob
  screenshots?: AtprotoBlob[]
  /** Lexicon field name; ordered list, first is primary for legacy surfaces. */
  categorySlug: string[]
  createdAt: string
  updatedAt: string
  appTags?: string[]
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

/** Site-relative paths served from `./public` (see `resolveUrlToImageBytes`). */
function isPublicImagePath(s: string | null | undefined): s is string {
  const t = s?.trim()
  return Boolean(t?.startsWith('/'))
}

/** HTTPS URL or `/…` path usable with `resolveUrlToImageBytes`. */
function pickImageUri(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const c of candidates) {
    if (!c?.trim()) continue
    const t = c.trim()
    if (isPublicImagePath(t) || isHttpsUri(t)) return t
  }
  return undefined
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

export type ListingDetailDbUrls = {
  /** Same HTTPS (or `/…`) URLs we use for the web directory + DB columns. */
  iconUrl: string
  heroImageUrl: string
  screenshotUrls: string[]
}

/**
 * Build a lexicon record with blobs (Kitchen-style uploadBlob) plus the string URLs to store in Postgres for the site.
 */
export async function buildListingDetailRecordWithBlobs(
  client: Client,
  row: DirectoryListing,
): Promise<{ record: FyiAtstoreListingDetail; dbUrls: ListingDetailDbUrls }> {
  const externalUrl =
    pickUri(row.externalUrl, row.sourceUrl) ?? 'https://bsky.app'
  const iconUrl =
    pickImageUri(row.iconUrl, row.screenshotUrls?.[0]) ?? PLACEHOLDER_ICON
  // Hero must follow `heroImageUrl` (and `/generated/…` paths), not the icon/avatar.
  // `pickUri` alone skipped relative URLs, so we wrongly fell back to `iconUrl`.
  const heroUrl =
    pickImageUri(
      row.heroImageUrl,
      row.screenshotUrls?.[0],
      row.screenshotUrls?.[1],
    ) ?? PLACEHOLDER_HERO
  const heroKey = heroUrl.trim()
  const screenshotUrls = row.screenshotUrls
    .filter((u) => isHttpsUri(u) || isPublicImagePath(u))
    .filter((u) => u.trim() !== heroKey)

  const tagline = row.tagline?.trim() || '—'
  const categorySlug = normalizeListingCategorySlugs(row)
  const createdAt = row.createdAt.toISOString()
  const updatedAt = row.updatedAt.toISOString()

  const iconBytes = await resolveUrlToImageBytes(iconUrl)
  const heroBytes = await resolveUrlToImageBytes(heroUrl)
  if (!iconBytes.mimeType.startsWith('image/')) {
    throw new Error(`Icon is not an image: ${iconBytes.mimeType} (${iconUrl})`)
  }
  if (!heroBytes.mimeType.startsWith('image/')) {
    throw new Error(`Hero is not an image: ${heroBytes.mimeType} (${heroUrl})`)
  }

  const icon = await uploadImageBlob(client, iconBytes.bytes, iconBytes.mimeType)
  const heroImage = await uploadImageBlob(
    client,
    heroBytes.bytes,
    heroBytes.mimeType,
  )

  const screenshots: AtprotoBlob[] = []
  for (const u of screenshotUrls) {
    const { bytes, mimeType } = await resolveUrlToImageBytes(u)
    if (!mimeType.startsWith('image/')) continue
    screenshots.push(await uploadImageBlob(client, bytes, mimeType))
  }

  const record: FyiAtstoreListingDetail = {
    $type: 'fyi.atstore.listing.detail',
    slug: row.slug,
    name: row.name,
    tagline,
    externalUrl,
    icon,
    heroImage,
    categorySlug,
    createdAt,
    updatedAt,
  }

  const desc = row.fullDescription?.trim()
  if (desc) record.description = desc
  if (screenshots.length > 0) record.screenshots = screenshots
  const tags = row.appTags?.filter((t): t is string => Boolean(t?.trim()))
  if (tags && tags.length > 0) record.appTags = tags

  return {
    record,
    dbUrls: {
      iconUrl,
      heroImageUrl: heroUrl,
      screenshotUrls,
    },
  }
}
