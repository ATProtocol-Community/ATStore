import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { adminFnMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

const setListingVerificationInput = z.object({
  listingId: z.string().uuid(),
  status: z.enum(['verified', 'rejected', 'unverified']),
})

const setClaimStatusInput = z.object({
  claimId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
})

const getAdminDashboard = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const listings = schema.storeListings
    const claims = schema.listingClaims

    const unverified = await db
      .select({
        id: listings.id,
        name: listings.name,
        slug: listings.slug,
        verificationStatus: listings.verificationStatus,
        atUri: listings.atUri,
        updatedAt: listings.updatedAt,
      })
      .from(listings)
      .where(eq(listings.verificationStatus, 'unverified'))
      .orderBy(desc(listings.updatedAt))

    const pendingClaims = await db
      .select({
        id: claims.id,
        directoryListingId: claims.directoryListingId,
        claimantDid: claims.claimantDid,
        status: claims.status,
        createdAt: claims.createdAt,
      })
      .from(claims)
      .where(eq(claims.status, 'pending'))
      .orderBy(desc(claims.createdAt))

    return { unverified, pendingClaims }
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
        .where(eq(listingTable.id, claim.directoryListingId))
    }

    return { ok: true as const }
  })

export const adminApi = {
  getAdminDashboard,
  getAdminDashboardQueryOptions,
  setListingVerification,
  setClaimStatus,
}
