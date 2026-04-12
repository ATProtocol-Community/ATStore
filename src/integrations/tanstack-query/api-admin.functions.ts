import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { adminFnMiddleware } from '#/middleware/auth'
import { protocolRecordImageUrlOrNull } from '#/lib/atproto/protocol-record-image-url'

import { dbMiddleware } from './db-middleware'

const HOME_HERO_SLOT_COUNT = 3

const setListingVerificationInput = z.object({
  listingId: z.string().uuid(),
  status: z.enum(['verified', 'rejected', 'unverified']),
})

const setClaimStatusInput = z.object({
  claimId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
})

const setHomePageHeroListingsInput = z.object({
  listingIds: z
    .array(z.string().uuid())
    .length(HOME_HERO_SLOT_COUNT)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'listingIds must be unique',
    }),
})

function hasAppTwoSegmentCategory(categorySlugs: string[]) {
  return categorySlugs.some((slug) => {
    const trimmed = slug.trim()
    if (!trimmed.startsWith('apps/')) {
      return false
    }
    return trimmed.split('/').length === 2
  })
}

const getAdminDashboard = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const listings = schema.storeListings
    const claims = schema.listingClaims
    const homeHero = schema.homePageHeroListings

    const [unverified, pendingClaims, homePageHeroListings] = await Promise.all([
      db
        .select({
          id: listings.id,
          name: listings.name,
          slug: listings.slug,
          categorySlugs: listings.categorySlugs,
          externalUrl: listings.externalUrl,
          tagline: listings.tagline,
          iconUrl: listings.iconUrl,
          heroImageUrl: listings.heroImageUrl,
          verificationStatus: listings.verificationStatus,
          atUri: listings.atUri,
          updatedAt: listings.updatedAt,
        })
        .from(listings)
        .where(eq(listings.verificationStatus, 'unverified'))
        .orderBy(desc(listings.updatedAt)),
      db
        .select({
          id: claims.id,
          storeListingId: claims.storeListingId,
          claimantDid: claims.claimantDid,
          status: claims.status,
          createdAt: claims.createdAt,
        })
        .from(claims)
        .where(eq(claims.status, 'pending'))
        .orderBy(desc(claims.createdAt)),
      db
        .select({
          position: homeHero.position,
          id: listings.id,
          name: listings.name,
          slug: listings.slug,
        })
        .from(homeHero)
        .innerJoin(listings, eq(homeHero.storeListingId, listings.id))
        .orderBy(asc(homeHero.position)),
    ])

    return {
      unverified: unverified.map((row) => ({
        ...row,
        iconUrl: protocolRecordImageUrlOrNull(row.iconUrl),
        heroImageUrl: protocolRecordImageUrlOrNull(row.heroImageUrl),
      })),
      pendingClaims,
      homePageHeroListings,
    }
  })

const getAdminDashboardQueryOptions = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: async () => getAdminDashboard(),
})

const setListingVerification = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setListingVerificationInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    await context.db
      .update(table)
      .set({
        verificationStatus: data.status,
        updatedAt: new Date(),
      })
      .where(eq(table.id, data.listingId))
    return { ok: true as const }
  })

const setClaimStatus = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setClaimStatusInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context
    const claimTable = schema.listingClaims
    const listingTable = schema.storeListings

    const [claim] = await db
      .select()
      .from(claimTable)
      .where(eq(claimTable.id, data.claimId))
      .limit(1)

    if (!claim) {
      throw new Error('Claim not found')
    }

    await db
      .update(claimTable)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(claimTable.id, data.claimId))

    if (data.status === 'approved') {
      await db
        .update(listingTable)
        .set({
          claimedByDid: claim.claimantDid,
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listingTable.id, claim.storeListingId))
    }

    return { ok: true as const }
  })

const setHomePageHeroListings = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setHomePageHeroListingsInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context
    const listings = schema.storeListings
    const homeHero = schema.homePageHeroListings

    const selectedListings = await db
      .select({
        id: listings.id,
        categorySlugs: listings.categorySlugs,
      })
      .from(listings)
      .where(
        and(
          inArray(listings.id, data.listingIds),
          eq(listings.verificationStatus, 'verified'),
        ),
      )

    const validSelectedListings = selectedListings.filter((row) =>
      hasAppTwoSegmentCategory(row.categorySlugs ?? []),
    )

    if (validSelectedListings.length !== data.listingIds.length) {
      throw new Error(
        'Every homepage hero listing must be a verified app listing (apps/*).',
      )
    }

    await db.transaction(async (tx) => {
      await tx.delete(homeHero)
      await tx.insert(homeHero).values(
        data.listingIds.map((listingId, index) => ({
          position: index,
          storeListingId: listingId,
          updatedAt: new Date(),
        })),
      )
    })

    return { ok: true as const }
  })

export const adminApi = {
  getAdminDashboard,
  getAdminDashboardQueryOptions,
  setListingVerification,
  setClaimStatus,
  setHomePageHeroListings,
}
