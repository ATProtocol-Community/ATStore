import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { COLLECTION, NSID } from '#/lib/atproto/nsids'

const reviewBodySchema = z.object({
  subject: z
    .string()
    .min(1)
    .refine((s) => s.startsWith('at://'), {
      message: 'subject must be an at:// URI',
    }),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(8000).optional(),
  createdAt: z.string().min(1),
})

export type FyiAtstoreListingReview = {
  $type: typeof NSID.listingReview
  subject: string
  rating: number
  text?: string
  createdAt: string
}

export type ListingReviewParseResult =
  | { ok: true; record: FyiAtstoreListingReview }
  | {
      ok: false
      reason: string
      stage: 'no_body' | 'zod' | 'datetime'
      zodError?: z.ZodError
    }

export function tryParseListingReviewRecord(
  body: Record<string, unknown> | undefined,
): ListingReviewParseResult {
  if (!body) {
    return {
      ok: false,
      reason: 'record body is missing',
      stage: 'no_body',
    }
  }

  const parsed = reviewBodySchema.safeParse(body)
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
  const created = new Date(d.createdAt)
  if (Number.isNaN(created.getTime())) {
    return {
      ok: false,
      reason: 'createdAt is not a valid datetime',
      stage: 'datetime',
    }
  }

  const rec: FyiAtstoreListingReview = {
    $type: NSID.listingReview,
    subject: d.subject,
    rating: d.rating,
    createdAt: d.createdAt,
  }
  const t = d.text?.trim()
  if (t) rec.text = t
  return { ok: true, record: rec }
}

function atUriForReview(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingReview}/${rkey}`
}

export async function recomputeListingReviewAggregates(
  db: Database,
  storeListingId: string,
) {
  const [agg] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
      avg: sql<string | null>`avg(${schema.storeListingReviews.rating}::double precision)`,
    })
    .from(schema.storeListingReviews)
    .where(eq(schema.storeListingReviews.storeListingId, storeListingId))

  const count = Number(agg?.cnt ?? 0)
  const avgRaw = agg?.avg
  const averageRating =
    count === 0 || avgRaw == null || avgRaw === ''
      ? null
      : Number.parseFloat(avgRaw)

  await db
    .update(schema.storeListings)
    .set({
      reviewCount: count,
      averageRating,
      updatedAt: new Date(),
    })
    .where(eq(schema.storeListings.id, storeListingId))
}

/**
 * Upsert `store_listing_reviews` from Tap (`fyi.atstore.listing.review`).
 */
export async function upsertListingReviewFromTap(input: {
  db: Database
  did: string
  rkey: string
  record: FyiAtstoreListingReview
}) {
  const { db, did, rkey, record } = input
  const atUri = atUriForReview(did, rkey)

  const [listing] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.atUri, record.subject))
    .limit(1)

  if (!listing) {
    console.warn(
      `[tap-review] skip review — no store_listings row for subject=${record.subject} did=${did} rkey=${rkey}`,
    )
    return
  }

  const reviewCreatedAt = new Date(record.createdAt)
  const text =
    record.text && record.text.trim() !== '' ? record.text.trim() : null

  await db
    .insert(schema.storeListingReviews)
    .values({
      storeListingId: listing.id,
      authorDid: did,
      rkey,
      atUri,
      rating: record.rating,
      text,
      reviewCreatedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.storeListingReviews.authorDid,
        schema.storeListingReviews.rkey,
      ],
      set: {
        storeListingId: listing.id,
        atUri,
        rating: record.rating,
        text,
        reviewCreatedAt,
        updatedAt: new Date(),
      },
    })

  await recomputeListingReviewAggregates(db, listing.id)
}

export async function deleteListingReviewFromTap(input: {
  db: Database
  did: string
  rkey: string
}) {
  const { db, did, rkey } = input

  const deleted = await db
    .delete(schema.storeListingReviews)
    .where(
      and(
        eq(schema.storeListingReviews.authorDid, did),
        eq(schema.storeListingReviews.rkey, rkey),
      ),
    )
    .returning({ storeListingId: schema.storeListingReviews.storeListingId })

  for (const row of deleted) {
    await recomputeListingReviewAggregates(db, row.storeListingId)
  }
}
