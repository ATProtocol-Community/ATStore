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
import { parseAtUriParts } from '#/lib/atproto/at-uri'
import { fetchBlueskyPublicProfileFields } from '#/lib/bluesky-public-profile'
import { COLLECTION } from '#/lib/atproto/nsids'
import {
  LISTING_LINK_LABEL_MAX_LENGTH,
  LISTING_LINK_MAX_COUNT,
  LISTING_LINK_URL_MAX_LENGTH,
  normalizeListingLinks,
  type FyiAtstoreListingDetail,
  type ListingLink,
} from '#/lib/atproto/listing-record'

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

function blobRefAcceptableForTap(raw: unknown): boolean {
  if (isBlob(raw) || isLegacyBlob(raw)) return true
  if (typeof raw !== 'object' || raw === null) return false
  const o = raw as Record<string, unknown>
  if (typeof o.mimeType !== 'string' || o.mimeType.length === 0) return false
  // Accept any blob shape we can actually resolve into a CID.
  return Boolean(getBlobCidString(raw))
}

const categorySlugLexicon = z
  .union([z.array(z.string()), z.string(), z.null()])
  .transform((v): string[] => {
    if (v == null) return ['misc']
    const arr = Array.isArray(v) ? v : [v]
    const out = arr.map((s) => String(s).trim()).filter(Boolean)
    return out.length > 0 ? out : ['misc']
  })

const listingLinkLexicon = z.object({
  type: z.string().trim().max(128).optional().default('other'),
  url: z.string().trim().min(1).max(LISTING_LINK_URL_MAX_LENGTH),
  label: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return undefined
      const t = String(s).trim()
      if (!t) return undefined
      return t.slice(0, LISTING_LINK_LABEL_MAX_LENGTH)
    }),
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
  links: z.array(listingLinkLexicon).max(LISTING_LINK_MAX_COUNT).optional(),
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
  /**
   * `heroImage` is optional in the lexicon — a record may omit it entirely. We only reject when
   * the field is present-but-malformed (e.g. wrong shape) so an undefined/null hero is treated
   * as "no hero" rather than an ingest failure.
   */
  if (d.heroImage != null && !blobRefAcceptableForTap(d.heroImage)) {
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
    categorySlug: d.categorySlug,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
  if (d.heroImage != null) rec.heroImage = d.heroImage as AtprotoBlob
  if (d.description) rec.description = d.description
  if (d.screenshots?.length) {
    rec.screenshots = d.screenshots.filter(blobRefAcceptableForTap) as AtprotoBlob[]
  }
  if (d.appTags?.length) rec.appTags = d.appTags
  if (d.productAccountDid) rec.productAccountDid = d.productAccountDid
  const migrated = d.migratedFromAtUri?.trim()
  if (migrated) rec.migratedFromAtUri = migrated
  if (d.links?.length) {
    const normalized = normalizeListingLinks(
      d.links.map((link): ListingLink => ({
        type: link.type,
        url: link.url,
        ...(link.label ? { label: link.label } : {}),
      })),
    )
    if (normalized.length > 0) rec.links = normalized
  }
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
 * Verified when: trusted store publisher; ingest is a no-op confirmation of an already-verified row
 * (handler-side claim has already updated the row to this exact `repoDid`+`rkey`); or the incoming
 * record satisfies the combined claim handshake — `claimPendingForDid` set on the existing row matches
 * the ingest repo DID **and** `migratedFromAtUri` points at the row's prior `at://<atstoreDid>/...rkey`.
 *
 * Lineage alone is intentionally insufficient: anyone can write `migratedFromAtUri` referencing a
 * known store record. The DID handshake bounds verification to the user who initiated the claim.
 */
function resolveListingVerificationStatus(input: {
  trustedPublisher: boolean
  record: FyiAtstoreListingDetail
  ingestRepoDid: string
  ingestRkey: string
  existingClaimPendingForDid: string | null
  existingPriorAtUri: string | null
  existingRepoDid: string | null
  existingRkey: string | null
  existingVerificationStatus: string | null
  atstoreDid: string | null
}): 'verified' | 'unverified' | 'rejected' {
  if (input.trustedPublisher) return 'verified'

  /** Admin moderation — do not downgrade via ingest; only API changes this. */
  if (input.existingVerificationStatus === 'rejected') return 'rejected'

  const repoDid = input.ingestRepoDid.trim()

  /**
   * Idempotent confirmation: the claim server fn already wrote this exact (repoDid, rkey) onto the
   * row and marked it `verified`. Tap is just replaying the firehose event afterwards.
   */
  if (
    input.existingVerificationStatus === 'verified' &&
    input.existingRepoDid?.trim() === repoDid &&
    input.existingRkey?.trim() === input.ingestRkey.trim()
  ) {
    return 'verified'
  }

  const pendingDid = input.existingClaimPendingForDid?.trim() ?? null
  if (!pendingDid || pendingDid !== repoDid) return 'unverified'

  const migrated = input.record.migratedFromAtUri?.trim()
  if (!migrated || !input.atstoreDid) return 'unverified'

  let prior: { repo: string; collection: string; rkey: string }
  try {
    prior = parseAtUriParts(migrated)
  } catch {
    return 'unverified'
  }
  if (prior.collection !== COLLECTION.listingDetail) return 'unverified'
  if (prior.repo.trim() !== input.atstoreDid.trim()) return 'unverified'

  /**
   * Lineage must point at *this row's* prior store record (when we know it), not just any store
   * record under the atstore DID. Without this, an attacker who knew any store rkey could forge a
   * lineage URI; the DID-pending check would still gate them, but pinning the rkey is cheap defense
   * in depth.
   */
  if (
    input.existingPriorAtUri &&
    input.existingPriorAtUri.trim() !== migrated
  ) {
    return 'unverified'
  }

  return 'verified'
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
  const atstoreDidRaw = process.env.ATSTORE_REPO_DID?.trim() ?? null
  const atstoreDid = atstoreDidRaw?.startsWith('did:') ? atstoreDidRaw : null

  const [existingRow] = await db
    .select({
      claimPendingForDid: schema.storeListings.claimPendingForDid,
      migratedFromAtUri: schema.storeListings.migratedFromAtUri,
      repoDid: schema.storeListings.repoDid,
      rkey: schema.storeListings.rkey,
      verificationStatus: schema.storeListings.verificationStatus,
    })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.slug, record.slug))
    .limit(1)
  const existingClaimPendingForDid =
    existingRow?.claimPendingForDid?.trim() ?? null
  const existingPriorAtUri = existingRow?.migratedFromAtUri?.trim() ?? null
  const existingRepoDid = existingRow?.repoDid ?? null
  const existingRkey = existingRow?.rkey ?? null
  const existingVerificationStatus = existingRow?.verificationStatus ?? null

  const verificationStatus = resolveListingVerificationStatus({
    trustedPublisher,
    record,
    ingestRepoDid: did,
    ingestRkey: rkey,
    existingClaimPendingForDid,
    existingPriorAtUri,
    existingRepoDid,
    existingRkey,
    existingVerificationStatus,
    atstoreDid,
  })

  /** Successful claim handshake — clear the pending marker so it cannot be reused. */
  const claimPendingForDidNext =
    verificationStatus === 'verified' && existingClaimPendingForDid
      ? null
      : (existingClaimPendingForDid ?? null)
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
  const links = normalizeListingLinks(record.links ?? null)

  try {
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
        links,
        productAccountDid: productDid,
        productAccountHandle,
        migratedFromAtUri,
        claimPendingForDid: claimPendingForDidNext,
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
          links,
          productAccountDid: productDid,
          productAccountHandle,
          migratedFromAtUri,
          claimPendingForDid: claimPendingForDidNext,
          updatedAt: now,
        },
      })
  } catch (err) {
    /**
     * Unique constraint on `source_url` only. The upsert resolves slug collisions, but two
     * different PDS users can publish listings with the same `externalUrl` and different slugs
     * (e.g. both pointing at `https://example.com`). The first row wins ownership of the URL;
     * the second insert hits `store_listings_source_url_idx` and Postgres returns 23505.
     *
     * Skip the offending event with a warning instead of throwing — otherwise tap-consumer
     * crashes its WebSocket loop on every duplicate-URL record it sees.
     */
    if (isSourceUrlUniqueViolation(err)) {
      const [conflictRow] = await db
        .select({
          atUri: schema.storeListings.atUri,
          slug: schema.storeListings.slug,
          repoDid: schema.storeListings.repoDid,
        })
        .from(schema.storeListings)
        .where(eq(schema.storeListings.sourceUrl, sourceUrl))
        .limit(1)
      console.warn(
        `[tap-ingest] skip listing ${atUri} slug=${record.slug} — sourceUrl=${sourceUrl} already owned by ${conflictRow?.atUri ?? '(unknown row)'} slug=${conflictRow?.slug ?? '?'} repoDid=${conflictRow?.repoDid ?? '?'}`,
      )
      return
    }
    throw err
  }
}

/**
 * Detect a Postgres `unique_violation` (SQLSTATE 23505) on `store_listings_source_url_idx`.
 * Drizzle wraps driver errors in `DrizzleQueryError`, so the Postgres error lives on `.cause`.
 */
function isSourceUrlUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>()
  let cur: unknown = err
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    const e = cur as { code?: unknown; constraint_name?: unknown; cause?: unknown }
    if (e.code === '23505' && e.constraint_name === 'store_listings_source_url_idx') {
      return true
    }
    cur = e.cause
  }
  return false
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
