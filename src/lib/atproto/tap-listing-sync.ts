import { isBlob } from '@atcute/lexicons/interfaces'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { COLLECTION } from '#/lib/atproto/nsids'
import type { FyiAtstoreListingDetail } from '#/lib/atproto/listing-record'

const categorySlugLexicon = z.union([
  z.array(z.string().min(1)).min(1),
  z.string().min(1).transform((s) => [s]),
])

const listingBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  tagline: z.string(),
  description: z.string().optional(),
  externalUrl: z.string().min(1),
  icon: z.unknown(),
  heroImage: z.unknown(),
  categorySlug: categorySlugLexicon,
  screenshots: z.array(z.unknown()).optional(),
  appTags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export function parseListingDetailRecord(
  body: Record<string, unknown> | undefined,
): FyiAtstoreListingDetail | null {
  if (!body) return null
  const parsed = listingBodySchema.safeParse(body)
  if (!parsed.success) return null
  const d = parsed.data
  if (!isBlob(d.icon) || !isBlob(d.heroImage)) return null
  if (d.screenshots?.some((s) => !isBlob(s))) return null

  const rec: FyiAtstoreListingDetail = {
    $type: 'fyi.atstore.listing.detail',
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    externalUrl: d.externalUrl,
    icon: d.icon,
    heroImage: d.heroImage,
    categorySlug: d.categorySlug,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
  if (d.description) rec.description = d.description
  if (d.screenshots?.length) {
    rec.screenshots = d.screenshots.filter(isBlob)
  }
  if (d.appTags?.length) rec.appTags = d.appTags
  return rec
}

function atUriFor(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingDetail}/${rkey}`
}

/**
 * Upsert `store_listings` from Tap (`fyi.atstore.listing.detail` only — does not touch `directory_listings`).
 * Image blobs are not converted to URLs here; cached URL columns stay null until backfilled separately.
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

  await db
    .insert(schema.storeListings)
    .values({
      sourceUrl,
      name: record.name,
      slug: record.slug,
      externalUrl: record.externalUrl,
      iconUrl: null,
      screenshotUrls: [],
      tagline: record.tagline,
      fullDescription: record.description,
      categorySlugs,
      heroImageUrl: null,
      atUri,
      repoDid: did,
      rkey,
      sourceAccountDid: did,
      verificationStatus,
      appTags,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.storeListings.slug,
      set: {
        sourceUrl,
        name: record.name,
        externalUrl: record.externalUrl,
        tagline: record.tagline,
        fullDescription: record.description ?? null,
        categorySlugs,
        atUri,
        repoDid: did,
        rkey,
        sourceAccountDid: did,
        verificationStatus,
        appTags,
        updatedAt: now,
      },
    })
}

/**
 * Remove the mirrored `store_listings` row when the listing record is deleted on the PDS (matched by repo + rkey).
 */
export async function markListingRemovedFromTap(input: {
  db: Database
  did: string
  rkey: string
}) {
  const { db, did, rkey } = input
  await db.delete(schema.storeListings).where(
    and(
      eq(schema.storeListings.repoDid, did),
      eq(schema.storeListings.rkey, rkey),
    ),
  )
}
