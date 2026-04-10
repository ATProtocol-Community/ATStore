import type { Client } from '@atcute/client'
import type { Blob as AtprotoBlob } from '@atcute/lexicons/interfaces'

import type { DirectoryListing } from '#/db/schema'

import { uploadImageBlob } from '#/lib/atproto/blob-upload'
import { resolveUrlToImageBytes } from '#/lib/atproto/resolve-image-bytes'

const PLACEHOLDER_ICON = 'https://placehold.co/64x64/png'

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
  categorySlug: string
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
    pickUri(row.iconUrl, row.screenshotUrls?.[0], externalUrl) ??
    PLACEHOLDER_ICON
  const heroUrl =
    pickUri(
      row.heroImageUrl,
      row.screenshotUrls?.[0],
      row.iconUrl,
      externalUrl,
    ) ?? iconUrl
  const screenshotUrls = row.screenshotUrls.filter((u) => isHttpsUri(u))

  const tagline = row.tagline?.trim() || '—'
  const categorySlug = row.categorySlug?.trim() || 'misc'
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
