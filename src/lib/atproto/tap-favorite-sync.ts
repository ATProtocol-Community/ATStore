import { and, eq, or } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { COLLECTION, NSID } from '#/lib/atproto/nsids'
import { recomputeListingTrending } from '#/lib/trending/recompute-listing-trending'

const favoriteBodySchema = z.object({
  subject: z
    .string()
    .min(1)
    .refine((s) => s.startsWith('at://'), {
      message: 'subject must be an at:// URI',
    }),
  createdAt: z.string().min(1),
})

export type FyiAtstoreListingFavorite = {
  $type: typeof NSID.listingFavorite
  subject: string
  createdAt: string
}

export type ListingFavoriteParseResult =
  | { ok: true; record: FyiAtstoreListingFavorite }
  | {
      ok: false
      reason: string
      stage: 'no_body' | 'zod' | 'datetime'
      zodError?: z.ZodError
    }

export function tryParseListingFavoriteRecord(
  body: Record<string, unknown> | undefined,
): ListingFavoriteParseResult {
  if (!body) {
    return {
      ok: false,
      reason: 'record body is missing',
      stage: 'no_body',
    }
  }

  const parsed = favoriteBodySchema.safeParse(body)
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

  return {
    ok: true,
    record: {
      $type: NSID.listingFavorite,
      subject: d.subject,
      createdAt: d.createdAt,
    },
  }
}

function atUriForFavorite(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingFavorite}/${rkey}`
}

/** Upsert `store_listing_favorites` from Tap (`fyi.atstore.listing.favorite`). */
export async function upsertListingFavoriteFromTap(input: {
  db: Database
  did: string
  rkey: string
  record: FyiAtstoreListingFavorite
}) {
  const { db, did, rkey, record } = input
  const atUri = atUriForFavorite(did, rkey)

  const [listing] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(
      or(
        eq(schema.storeListings.atUri, record.subject),
        eq(schema.storeListings.migratedFromAtUri, record.subject),
      ),
    )
    .limit(1)

  if (!listing) {
    console.warn(
      `[tap-favorite] skip favorite - no store_listings row for subject=${record.subject} did=${did} rkey=${rkey}`,
    )
    return
  }

  const favoriteCreatedAt = new Date(record.createdAt)
  await db
    .insert(schema.storeListingFavorites)
    .values({
      storeListingId: listing.id,
      authorDid: did,
      rkey,
      atUri,
      favoriteCreatedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.storeListingFavorites.authorDid,
        schema.storeListingFavorites.rkey,
      ],
      set: {
        storeListingId: listing.id,
        atUri,
        favoriteCreatedAt,
        updatedAt: new Date(),
      },
    })

  await recomputeListingTrending(db, listing.id)
}

export async function deleteListingFavoriteFromTap(input: {
  db: Database
  did: string
  rkey: string
}) {
  const { db, did, rkey } = input

  const deleted = await db
    .delete(schema.storeListingFavorites)
    .where(
      and(
        eq(schema.storeListingFavorites.authorDid, did),
        eq(schema.storeListingFavorites.rkey, rkey),
      ),
    )
    .returning({ storeListingId: schema.storeListingFavorites.storeListingId })

  for (const row of deleted) {
    await recomputeListingTrending(db, row.storeListingId)
  }
}
