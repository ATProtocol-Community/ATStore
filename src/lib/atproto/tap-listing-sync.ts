import {
  isBlob,
  isLegacyBlob,
  type Blob as AtprotoBlob,
} from '@atcute/lexicons/interfaces'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import {
  blobLikeToBskyCdnUrl,
  explainMissingBlobUrl,
  getBlobCidString,
} from '#/lib/atproto/blob-cdn-url'
import { fetchBlueskyPublicProfileFields } from '#/lib/bluesky-public-profile'
import { COLLECTION } from '#/lib/atproto/nsids'
import type { FyiAtstoreListingDetail } from '#/lib/atproto/listing-record'

/**
 * `isBlob()` requires `$type: "blob"`, exactly four keys, etc. Tap / repo JSON often omits
 * `$type` or adds fields — ingest only needs scalars for Postgres; accept any blob ref we can recognize.
 */
/** Short shape summary for logs (no blob bytes). */
export function summarizeBlobRefForDebug(raw: unknown): string {
  if (raw === null || raw === undefined) return 'null'
  if (typeof raw !== 'object') return `typeof ${typeof raw}`
  const o = raw as Record<string, unknown>
  const keys = Object.keys(o)
  const keySample = keys.slice(0, 12).join(', ') || '(no keys)'
  const mime =
    typeof o.mimeType === 'string' ? o.mimeType : `mimeType=${typeof o.mimeType}`
  const ref = o.ref
  const refKeys =
    ref && typeof ref === 'object'
      ? Object.keys(ref as object).slice(0, 8).join(', ')
      : String(ref)
  const link =
    ref && typeof ref === 'object'
      ? (ref as Record<string, unknown>).$link
      : undefined
  const linkShort =
    typeof link === 'string'
      ? `${link.slice(0, 16)}…`
      : link === undefined
        ? 'none'
        : String(link)
  const cid = typeof o.cid === 'string' ? `${o.cid.slice(0, 16)}…` : 'none'
  let refExtra = ''
  if (ref && typeof ref === 'object') {
    const r = ref as Record<string, unknown>
    if (r.hash !== undefined) {
      const h = r.hash
      if (h instanceof Uint8Array) {
        refExtra = ` ref.hash=Uint8Array(${h.byteLength})`
      } else if (typeof h === 'object' && h !== null && 'length' in h) {
        refExtra = ` ref.hash=array-like(${(h as { length?: number }).length ?? '?'})`
      } else {
        refExtra = ` ref.hash=${typeof h}`
      }
    }
    if (r.code !== undefined || r.version !== undefined) {
      refExtra += ` code=${String(r.code)} version=${String(r.version)}`
    }
  }
  const t = o.$type
  return `{ $type=${t ?? 'n/a'} keys=${keys.length} [${keySample}] ${mime} ref.keys=[${refKeys}] ref.$link=${linkShort} top.cid=${cid}${refExtra} }`
}

/** True if `ref` looks like a CID pointer (JSON, DAG-CBOR, or Tap/indigo multihash struct). */
function refLooksLikeBlobPointer(ref: object): boolean {
  const r = ref as Record<string, unknown>
  if (typeof r.$link === 'string' && r.$link.length > 0) return true
  if (r.bytes !== undefined) return true
  // Tap / indigo often serialize blob refs as { code, version, hash } (multihash) instead of { $link }.
  if (r.hash !== undefined) return true
  return false
}

function blobRefAcceptableForTap(raw: unknown): boolean {
  if (isBlob(raw) || isLegacyBlob(raw)) return true
  if (typeof raw !== 'object' || raw === null) return false
  const o = raw as Record<string, unknown>
  if (typeof o.mimeType !== 'string' || o.mimeType.length === 0) return false
  if (typeof o.cid === 'string' && o.cid.length > 0) return true
  const ref = o.ref
  if (ref && typeof ref === 'object' && refLooksLikeBlobPointer(ref)) return true
  return false
}

const categorySlugLexicon = z
  .union([z.array(z.string()), z.string(), z.null()])
  .transform((v): string[] => {
    if (v == null) return ['misc']
    const arr = Array.isArray(v) ? v : [v]
    const out = arr.map((s) => String(s).trim()).filter(Boolean)
    return out.length > 0 ? out : ['misc']
  })

const listingBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  tagline: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      const t = s == null ? '' : String(s)
      return t.trim() === '' ? '—' : t
    }),
  description: z.string().optional(),
  externalUrl: z.string().min(1),
  icon: z.unknown(),
  heroImage: z.unknown(),
  categorySlug: categorySlugLexicon,
  screenshots: z.array(z.unknown()).optional(),
  appTags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  productAccountDid: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return undefined
      const t = String(s).trim()
      return t.length > 0 ? t : undefined
    }),
  migratedFromAtUri: z
    .string()
    .optional()
    .refine((s) => !s || s.startsWith('at://'), {
      message: 'migratedFromAtUri must be an at:// URI',
    }),
})

export type ListingDetailParseResult =
  | { ok: true; record: FyiAtstoreListingDetail }
  | {
      ok: false
      reason: string
      stage: 'no_body' | 'zod' | 'blob_icon' | 'blob_hero' | 'blob_screenshot'
      zodError?: z.ZodError
      screenshotIndex?: number
      blobField?: 'icon' | 'heroImage' | 'screenshots'
      blobSummary?: string
    }

/**
 * Same as {@link parseListingDetailRecord} but returns why parsing failed (for logging).
 */
export function tryParseListingDetailRecord(
  body: Record<string, unknown> | undefined,
): ListingDetailParseResult {
  if (!body) {
    return {
      ok: false,
      reason: 'record body is missing',
      stage: 'no_body',
    }
  }

  const parsed = listingBodySchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.flatten()
    const fieldErrors = issues.fieldErrors
    const formErrors = issues.formErrors
    const detail = [
      ...Object.entries(fieldErrors).flatMap(([k, v]) =>
        v?.map((m) => `${k}: ${m}`) ?? [],
      ),
      ...(formErrors ?? []),
    ].join('; ')
    return {
      ok: false,
      reason: detail || parsed.error.message,
      stage: 'zod',
      zodError: parsed.error,
    }
  }

  const d = parsed.data
  if (!blobRefAcceptableForTap(d.icon)) {
    return {
      ok: false,
      reason: `icon blob not recognized (${summarizeBlobRefForDebug(d.icon)})`,
      stage: 'blob_icon',
      blobField: 'icon',
      blobSummary: summarizeBlobRefForDebug(d.icon),
    }
  }
  if (!blobRefAcceptableForTap(d.heroImage)) {
    return {
      ok: false,
      reason: `heroImage blob not recognized (${summarizeBlobRefForDebug(d.heroImage)})`,
      stage: 'blob_hero',
      blobField: 'heroImage',
      blobSummary: summarizeBlobRefForDebug(d.heroImage),
    }
  }

  if (d.screenshots?.length) {
    const badIdx = d.screenshots.findIndex((s) => !blobRefAcceptableForTap(s))
    if (badIdx >= 0) {
      const s = d.screenshots[badIdx]
      return {
        ok: false,
        reason: `screenshots[${badIdx}] blob not recognized (${summarizeBlobRefForDebug(s)})`,
        stage: 'blob_screenshot',
        screenshotIndex: badIdx,
        blobField: 'screenshots',
        blobSummary: summarizeBlobRefForDebug(s),
      }
    }
  }

  const rec: FyiAtstoreListingDetail = {
    $type: 'fyi.atstore.listing.detail',
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    externalUrl: d.externalUrl,
    icon: d.icon as AtprotoBlob,
    heroImage: d.heroImage as AtprotoBlob,
    categorySlug: d.categorySlug,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
  if (d.description) rec.description = d.description
  if (d.screenshots?.length) {
    rec.screenshots = d.screenshots.filter(blobRefAcceptableForTap) as AtprotoBlob[]
  }
  if (d.appTags?.length) rec.appTags = d.appTags
  if (d.productAccountDid) rec.productAccountDid = d.productAccountDid
  const migrated = d.migratedFromAtUri?.trim()
  if (migrated) rec.migratedFromAtUri = migrated
  return { ok: true, record: rec }
}

export function parseListingDetailRecord(
  body: Record<string, unknown> | undefined,
): FyiAtstoreListingDetail | null {
  const r = tryParseListingDetailRecord(body)
  return r.ok ? r.record : null
}

function atUriFor(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingDetail}/${rkey}`
}

/**
 * Upsert `store_listings` from Tap (`fyi.atstore.listing.detail` only — does not touch `directory_listings`).
 * Resolves icon / hero / screenshots to Bluesky CDN URLs from blob refs (Kitchen-style).
 */
export async function upsertDirectoryListingFromTap(input: {
  db: Database
  did: string
  rkey: string
  record: FyiAtstoreListingDetail
  trustedPublisher: boolean
}) {
  const { db, did, rkey, record, trustedPublisher } = input
  const atUri = atUriFor(did, rkey)
  const sourceUrl = record.externalUrl.trim()
  const verificationStatus = trustedPublisher ? 'verified' : 'unverified'
  const now = new Date()
  const appTags = record.appTags ?? []
  const categorySlugs = record.categorySlug

  const iconUrl = blobLikeToBskyCdnUrl(record.icon, did)
  const heroImageUrl = blobLikeToBskyCdnUrl(record.heroImage, did)
  const screenshotUrls = (record.screenshots ?? [])
    .map((b) => blobLikeToBskyCdnUrl(b, did))
    .filter((u): u is string => Boolean(u))

  const iconCid = getBlobCidString(record.icon)
  const heroCid = getBlobCidString(record.heroImage)
  const shotsParsed = (record.screenshots ?? []).length
  console.log(
    `[tap-ingest] slug=${record.slug} rkey=${rkey} images: icon=${iconUrl ? `cdn(${iconCid?.slice(0, 12)}…)` : `MISS:${explainMissingBlobUrl(record.icon)}`} hero=${heroImageUrl ? `cdn(${heroCid?.slice(0, 12)}…)` : `MISS:${explainMissingBlobUrl(record.heroImage)}`} screenshots=${screenshotUrls.length}/${shotsParsed}`,
  )

  const productDid = record.productAccountDid?.trim() ?? null
  let productAccountHandle: string | null = null
  if (productDid) {
    const profile = await fetchBlueskyPublicProfileFields(productDid)
    const h = profile?.handle?.trim()
    productAccountHandle = h && h.length > 0 ? h : null
  }

  const migratedFromAtUri = record.migratedFromAtUri?.trim() ?? null

  await db
    .insert(schema.storeListings)
    .values({
      sourceUrl,
      name: record.name,
      slug: record.slug,
      externalUrl: record.externalUrl,
      iconUrl,
      screenshotUrls,
      tagline: record.tagline,
      fullDescription: record.description,
      categorySlugs,
      heroImageUrl,
      atUri,
      repoDid: did,
      rkey,
      sourceAccountDid: did,
      verificationStatus,
      appTags,
      productAccountDid: productDid,
      productAccountHandle,
      migratedFromAtUri,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.storeListings.slug,
      set: {
        sourceUrl,
        name: record.name,
        externalUrl: record.externalUrl,
        iconUrl,
        heroImageUrl,
        screenshotUrls,
        tagline: record.tagline,
        fullDescription: record.description ?? null,
        categorySlugs,
        atUri,
        repoDid: did,
        rkey,
        sourceAccountDid: did,
        verificationStatus,
        appTags,
        productAccountDid: productDid,
        productAccountHandle,
        migratedFromAtUri,
        updatedAt: now,
      },
    })
}

/**
 * Remove the mirrored `store_listings` row when the listing record is deleted on the PDS (matched by repo + rkey).
 *
 * Skips the delete when some row records `migratedFromAtUri` equal to this record's AT URI — that means a product
 * claim repointed the mirror to the owner's repo first; a racing Tap delete for the **old** store record must not
 * wipe the surviving directory row (see claim flow in `claimProductListingToPds`).
 */
export async function markListingRemovedFromTap(input: {
  db: Database
  did: string
  rkey: string
}) {
  const { db, did, rkey } = input
  const deletedAtUri = atUriFor(did, rkey)

  const [superseded] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.migratedFromAtUri, deletedAtUri))
    .limit(1)

  if (superseded) {
    console.log(
      `[tap-ingest] skip listing delete for ${deletedAtUri} — URI recorded as migratedFromAtUri (claim / lineage); mirror row must stay`,
    )
    return
  }

  await db.delete(schema.storeListings).where(
    and(
      eq(schema.storeListings.repoDid, did),
      eq(schema.storeListings.rkey, rkey),
    ),
  )
}
