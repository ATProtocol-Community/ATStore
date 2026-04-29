import type { Client } from '@atcute/client'
import type { Blob as AtprotoBlob } from '@atcute/lexicons/interfaces'

import type { StoreListing } from '#/db/schema'

import { blobLikeToBskyCdnUrl } from '#/lib/atproto/blob-cdn-url'
import { uploadImageBlob } from '#/lib/atproto/blob-upload'
import { resolveUrlToImageBytes } from '#/lib/atproto/resolve-image-bytes'

async function resolveUrlToImageBytesOrPlaceholder(
  url: string,
  placeholderUrl: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  try {
    return await resolveUrlToImageBytes(url)
  } catch {
    return await resolveUrlToImageBytes(placeholderUrl)
  }
}

const PLACEHOLDER_ICON = 'https://placehold.co/64x64/png'

function normalizeListingCategorySlugs(row: StoreListing): string[] {
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

/**
 * `knownValues` from `fyi.atstore.listing.detail#link.type`. Lexicon allows any string
 * for forward-compat; UI surfaces only render known kinds as labelled chips.
 */
export const LISTING_LINK_TYPES = [
  'privacy',
  'terms',
  'support',
  'contact',
  'docs',
  'blog',
  'changelog',
  'source',
  'status',
  'other',
] as const

export type ListingLinkType = (typeof LISTING_LINK_TYPES)[number]

export type ListingLink = {
  /** `knownValues` from the lexicon; unknown strings are allowed (`other` in UI). */
  type: string
  url: string
  /** Optional user-facing label; useful especially when `type === 'other'`. */
  label?: string
}

export type FyiAtstoreListingDetail = {
  $type: 'fyi.atstore.listing.detail'
  slug: string
  name: string
  tagline: string
  description?: string
  externalUrl: string
  icon: AtprotoBlob
  /**
   * Optional hero/cover blob. The lexicon allows listings without a hero (some sites have no
   * good source image and we'd rather render nothing than a generic AI placeholder); when
   * absent the directory falls back to the first screenshot, then to category-level art.
   */
  heroImage?: AtprotoBlob
  screenshots?: AtprotoBlob[]
  /** Lexicon field name; ordered list, first is primary for legacy surfaces. */
  categorySlug: string[]
  createdAt: string
  updatedAt: string
  appTags?: string[]
  /** Bluesky DID for the product (not the store publisher). */
  productAccountDid?: string
  /** Prior `fyi.atstore.listing.detail` record URI when this record supersedes one from another repo. */
  migratedFromAtUri?: string
  /** Trust / compliance / support / project links (`knownValues` + free-form `other`). */
  links?: ListingLink[]
}

/** Max length checks mirror `detail.json`: `links` ≤ 12 entries, label ≤ 100 chars. */
export const LISTING_LINK_MAX_COUNT = 12
export const LISTING_LINK_LABEL_MAX_LENGTH = 100
export const LISTING_LINK_URL_MAX_LENGTH = 2048

export function normalizeListingLinks(
  raw: readonly ListingLink[] | null | undefined,
): ListingLink[] {
  if (!raw?.length) return []
  const out: ListingLink[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry) continue
    const url = entry.url?.trim()
    if (!url || url.length > LISTING_LINK_URL_MAX_LENGTH) continue
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
    } catch {
      continue
    }
    const type = entry.type?.trim() || 'other'
    const label = entry.label?.trim()
    const key = `${type}\u0000${url.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const link: ListingLink = { type, url }
    if (label) {
      link.label = label.slice(0, LISTING_LINK_LABEL_MAX_LENGTH)
    }
    out.push(link)
    if (out.length >= LISTING_LINK_MAX_COUNT) break
  }
  return out
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
  /** Null when the listing intentionally has no hero (cleared via the admin tooling). */
  heroImageUrl: string | null
  screenshotUrls: string[]
}

/** In-memory image bytes uploaded via `com.atproto.repo.uploadBlob` (no `public/` file). */
export type ListingDetailInMemoryImage = {
  bytes: Uint8Array
  mimeType: string
}

export type ListingDetailBlobOverrides = {
  icon?: ListingDetailInMemoryImage
  heroImage?: ListingDetailInMemoryImage
  screenshots?: ListingDetailInMemoryImage[]
  /**
   * When true, publish the record without a `heroImage` blob and clear `heroImageUrl` in the
   * DB. Takes precedence over `heroImage` overrides and any prior blob ref for the slot — this
   * is the explicit "remove the hero" signal from the admin tooling.
   */
  clearHero?: boolean
}

/**
 * Already-uploaded blob refs from a prior version of the record (e.g. from `getRecord` against the
 * owner PDS). When supplied, fields without an explicit override are reused as-is — no re-download
 * from the CDN, no re-upload to the PDS, no orphan blobs piling up on the user's repo.
 */
export type ListingDetailExistingBlobs = {
  icon?: AtprotoBlob
  heroImage?: AtprotoBlob
  screenshots?: AtprotoBlob[]
}

export type ListingDetailRecordExtras = {
  /** Set when claiming a listing from the store repo onto the product owner PDS. */
  migratedFromAtUri?: string
}

/**
 * Reuse prior screenshot blob refs in the order of `desiredUrls`, without uploading.
 * Matches each URL to a blob via `blobLikeToBskyCdnUrl`; returns null when the multiset does
 * not line up (e.g. CDN URL mismatch, missing `repoDid`) so callers can fall back.
 */
function takeExistingScreenshotsInUrlOrder(
  desiredUrls: string[],
  existing: AtprotoBlob[],
  repoDid: string | null | undefined,
): AtprotoBlob[] | null {
  const did = repoDid?.trim()
  if (!did || existing.length === 0 || desiredUrls.length === 0) {
    return null
  }

  const queues = new Map<string, AtprotoBlob[]>()
  for (const blob of existing) {
    const cdnUrl = blobLikeToBskyCdnUrl(blob, did)
    if (!cdnUrl) continue
    const key = cdnUrl.trim()
    const arr = queues.get(key) ?? []
    arr.push(blob)
    queues.set(key, arr)
  }

  const out: AtprotoBlob[] = []
  for (const raw of desiredUrls.slice(0, 4)) {
    const key = raw.trim()
    const q = queues.get(key)
    if (!q || q.length === 0) return null
    const next = q.shift()
    if (next === undefined) return null
    out.push(next)
    if (q.length === 0) queues.delete(key)
  }

  for (const q of queues.values()) {
    if (q.length > 0) return null
  }
  return out
}

/**
 * Build a lexicon record with blobs (Kitchen-style uploadBlob) plus the string URLs to store in Postgres for the site.
 *
 * Blob resolution order per slot:
 *   1. `blobOverrides.<slot>` — fresh bytes the caller wants to upload now.
 *   2. `existingBlobs.<slot>` — reuse the prior record's blob ref (no network I/O).
 *   3. Download from the row's CDN URL and upload as a new blob (first publish / fallbacks).
 */
export async function buildListingDetailRecordWithBlobs(
  client: Client,
  row: StoreListing,
  blobOverrides?: ListingDetailBlobOverrides,
  extras?: ListingDetailRecordExtras,
  existingBlobs?: ListingDetailExistingBlobs,
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
  const screenshotUrls = (row.screenshotUrls ?? [])
    .filter((u) => isHttpsUri(u) || isPublicImagePath(u))
    .filter((u) => u.trim() !== heroKey)

  const tagline = row.tagline?.trim() || '—'
  const categorySlug = normalizeListingCategorySlugs(row)
  const createdAt = row.createdAt.toISOString()
  const updatedAt = row.updatedAt.toISOString()

  async function resolveImageSlot(
    slot: 'icon' | 'heroImage',
    override: ListingDetailInMemoryImage | undefined,
    existing: AtprotoBlob | undefined,
    fallbackUrl: string,
    placeholderUrl: string,
  ): Promise<AtprotoBlob> {
    if (override) {
      if (!override.mimeType.startsWith('image/')) {
        throw new Error(
          `${slot === 'icon' ? 'Icon' : 'Hero'} is not an image: ${override.mimeType} (in-memory)`,
        )
      }
      return uploadImageBlob(client, override.bytes, override.mimeType)
    }
    if (existing) return existing
    const bytes = await resolveUrlToImageBytesOrPlaceholder(
      fallbackUrl,
      placeholderUrl,
    )
    if (!bytes.mimeType.startsWith('image/')) {
      throw new Error(
        `${slot === 'icon' ? 'Icon' : 'Hero'} is not an image: ${bytes.mimeType} (${fallbackUrl})`,
      )
    }
    return uploadImageBlob(client, bytes.bytes, bytes.mimeType)
  }

  const icon = await resolveImageSlot(
    'icon',
    blobOverrides?.icon,
    existingBlobs?.icon,
    iconUrl,
    PLACEHOLDER_ICON,
  )
  /**
   * `clearHero` wins over both fresh-bytes overrides and the prior blob ref so the admin
   * "Remove hero" action actually removes the hero — otherwise the existing-blob branch in
   * `resolveImageSlot` would silently re-attach the prior hero on every republish.
   */
  const heroImage = blobOverrides?.clearHero
    ? undefined
    : await resolveImageSlot(
        'heroImage',
        blobOverrides?.heroImage,
        existingBlobs?.heroImage,
        heroUrl,
        PLACEHOLDER_HERO,
      )

  const screenshots: AtprotoBlob[] = []
  if (blobOverrides?.screenshots !== undefined) {
    for (const screenshot of blobOverrides.screenshots.slice(0, 4)) {
      if (!screenshot.mimeType.startsWith('image/')) continue
      screenshots.push(
        await uploadImageBlob(client, screenshot.bytes, screenshot.mimeType),
      )
    }
  } else if (existingBlobs?.screenshots !== undefined) {
    const reorder = takeExistingScreenshotsInUrlOrder(
      screenshotUrls,
      existingBlobs.screenshots,
      row.repoDid,
    )
    if (reorder) {
      for (const ref of reorder) screenshots.push(ref)
    } else {
      for (const ref of existingBlobs.screenshots.slice(0, 4)) {
        screenshots.push(ref)
      }
    }
  } else {
    for (const u of screenshotUrls.slice(0, 4)) {
      try {
        const { bytes, mimeType } = await resolveUrlToImageBytes(u)
        if (!mimeType.startsWith('image/')) continue
        screenshots.push(await uploadImageBlob(client, bytes, mimeType))
      } catch {
        /* Stale CDN URL or missing blob — omit screenshot */
      }
    }
  }

  const record: FyiAtstoreListingDetail = {
    $type: 'fyi.atstore.listing.detail',
    slug: row.slug,
    name: row.name,
    tagline,
    externalUrl,
    icon,
    categorySlug,
    createdAt,
    updatedAt,
  }
  if (heroImage) record.heroImage = heroImage

  const desc = row.fullDescription?.trim()
  if (desc) record.description = desc
  if (screenshots.length > 0) record.screenshots = screenshots
  const tags = row.appTags?.filter((t): t is string => Boolean(t?.trim()))
  if (tags && tags.length > 0) record.appTags = tags

  const productDid = row.productAccountDid?.trim()
  if (productDid) record.productAccountDid = productDid

  const migrated = extras?.migratedFromAtUri?.trim()
  if (migrated?.startsWith('at://')) {
    record.migratedFromAtUri = migrated
  }

  const links = normalizeListingLinks(row.links ?? null)
  if (links.length > 0) record.links = links

  return {
    record,
    dbUrls: {
      iconUrl,
      heroImageUrl: heroImage ? heroUrl : null,
      screenshotUrls,
    },
  }
}
