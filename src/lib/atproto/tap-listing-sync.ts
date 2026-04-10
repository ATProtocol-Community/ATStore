import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { COLLECTION } from '#/lib/atproto/nsids'
import type { FyiAtstoreListingDetail } from '#/lib/atproto/listing-record'

const listingBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  tagline: z.string(),
  description: z.string().optional(),
  externalUrl: z.string().min(1),
  icon: z.string().min(1),
  heroImage: z.string().min(1),
  categorySlug: z.string(),
  screenshots: z.array(z.string()).optional(),
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
  if (d.screenshots?.length) rec.screenshots = d.screenshots
  return rec
}

function atUriFor(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingDetail}/${rkey}`
}

/**
 * Upsert a directory row from a Tap `fyi.atstore.listing.detail` create/update payload.
 * Conflicts on `slug` (stable lexicon key).
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
  const screenshots = record.screenshots?.filter(Boolean) ?? []
  const verificationStatus = trustedPublisher ? 'verified' : 'unverified'
  const now = new Date()

  await db
    .insert(schema.directoryListings)
    .values({
      sourceUrl,
      name: record.name,
      slug: record.slug,
      externalUrl: record.externalUrl,
      iconUrl: record.icon,
      screenshotUrls: screenshots,
      tagline: record.tagline,
      fullDescription: record.description,
      categorySlug: record.categorySlug,
      heroImageUrl: record.heroImage,
      atUri,
      repoDid: did,
      rkey,
      sourceAccountDid: did,
      classificationReason: 'tap-sync',
      verificationStatus,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.directoryListings.slug,
      set: {
        sourceUrl,
        name: record.name,
        externalUrl: record.externalUrl,
        iconUrl: record.icon,
        screenshotUrls: screenshots,
        tagline: record.tagline,
        fullDescription: record.description ?? null,
        categorySlug: record.categorySlug,
        heroImageUrl: record.heroImage,
        atUri,
        repoDid: did,
        rkey,
        sourceAccountDid: did,
        classificationReason: 'tap-sync',
        verificationStatus,
        updatedAt: now,
      },
    })
}

/**
 * Mark a listing hidden when the record is deleted on the PDS (matched by repo + rkey).
 */
export async function markListingRemovedFromTap(input: {
  db: Database
  did: string
  rkey: string
}) {
  const { db, did, rkey } = input
  await db
    .update(schema.directoryListings)
    .set({
      verificationStatus: 'rejected',
      atUri: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.directoryListings.repoDid, did),
        eq(schema.directoryListings.rkey, rkey),
      ),
    )
}
