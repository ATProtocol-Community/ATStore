import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
  fetchBlueskyHandleForDid,
  fetchBlueskyPublicProfileFields,
} from '#/lib/bluesky-public-profile'
import { adminFnMiddleware, getAtprotoSessionForRequest } from '#/middleware/auth'
import { protocolRecordImageUrlOrNull } from '#/lib/atproto/protocol-record-image-url'
import { getAtstoreRepoDid } from '#/lib/atproto/publish-directory-listing'

import { dbMiddleware } from './db-middleware'

const HOME_HERO_SLOT_COUNT = 3
const RECENT_REVIEWS_LIMIT = 200
const RECENTLY_CLAIMED_LISTINGS_LIMIT = 200

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
          fullDescription: listings.fullDescription,
          appTags: listings.appTags,
          iconUrl: listings.iconUrl,
          heroImageUrl: listings.heroImageUrl,
          screenshotUrls: listings.screenshotUrls,
          productAccountHandle: listings.productAccountHandle,
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
          claimantHandle: claims.claimantHandle,
          message: claims.message,
          status: claims.status,
          createdAt: claims.createdAt,
          listingName: listings.name,
          listingSlug: listings.slug,
          listingIconUrl: listings.iconUrl,
          listingExternalUrl: listings.externalUrl,
          listingProductAccountHandle: listings.productAccountHandle,
        })
        .from(claims)
        .innerJoin(listings, eq(claims.storeListingId, listings.id))
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
        screenshotUrls: (row.screenshotUrls ?? [])
          .map((url) => protocolRecordImageUrlOrNull(url))
          .filter((url): url is string => url != null),
      })),
      pendingClaims: pendingClaims.map((row) => ({
        ...row,
        listingIconUrl: protocolRecordImageUrlOrNull(row.listingIconUrl),
      })),
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
    if (claim.status !== 'pending') {
      throw new Error('This claim has already been processed')
    }

    const adminCtx = await getAtprotoSessionForRequest(getRequest())
    const deciderDid = adminCtx?.did
    if (!deciderDid) {
      throw new Error('Unauthorized')
    }

    const now = new Date()
    const resolvedHandle =
      claim.claimantHandle?.trim() ||
      (await fetchBlueskyHandleForDid(claim.claimantDid))

    await db.transaction(async (tx) => {
      await tx
        .update(claimTable)
        .set({
          status: data.status,
          updatedAt: now,
          decidedAt: now,
          decidedByDid: deciderDid,
        })
        .where(eq(claimTable.id, data.claimId))

      if (data.status === 'approved') {
        await tx
          .update(listingTable)
          .set({
            claimedByDid: claim.claimantDid,
            claimedAt: now,
            productAccountDid: claim.claimantDid,
            productAccountHandle: resolvedHandle ?? null,
            updatedAt: now,
          })
          .where(eq(listingTable.id, claim.storeListingId))
      }
    })

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

const getRecentReviews = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const reviews = schema.storeListingReviews
    const listings = schema.storeListings

    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        text: reviews.text,
        reviewCreatedAt: reviews.reviewCreatedAt,
        atUri: reviews.atUri,
        authorDid: reviews.authorDid,
        authorDisplayName: reviews.authorDisplayName,
        authorAvatarUrl: reviews.authorAvatarUrl,
        listingId: listings.id,
        listingName: listings.name,
        listingSlug: listings.slug,
        listingIconUrl: listings.iconUrl,
      })
      .from(reviews)
      .innerJoin(listings, eq(reviews.storeListingId, listings.id))
      .orderBy(desc(reviews.reviewCreatedAt))
      .limit(RECENT_REVIEWS_LIMIT)

    const uniqueDids = Array.from(new Set(rows.map((r) => r.authorDid)))
    const profileEntries = await Promise.all(
      uniqueDids.map(
        async (did) =>
          [did, await fetchBlueskyPublicProfileFields(did)] as const,
      ),
    )
    const profileByDid = new Map(profileEntries)

    return rows.map((row) => {
      const profile = profileByDid.get(row.authorDid) ?? null
      const displayName =
        row.authorDisplayName?.trim() ||
        profile?.displayName?.trim() ||
        profile?.handle ||
        null
      const avatarUrl =
        row.authorAvatarUrl?.trim() || profile?.avatarUrl || null
      const handle = profile?.handle ?? null
      return {
        ...row,
        reviewCreatedAt: row.reviewCreatedAt.toISOString(),
        listingIconUrl: protocolRecordImageUrlOrNull(row.listingIconUrl),
        authorDisplayName: displayName,
        authorAvatarUrl: avatarUrl,
        authorHandle: handle,
      }
    })
  })

const getRecentReviewsQueryOptions = queryOptions({
  queryKey: ['admin', 'recent-reviews'],
  queryFn: async () => getRecentReviews(),
})

const getRecentlyClaimedListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const listings = schema.storeListings

    /**
     * "Claimed" covers two paths:
     * - Manual admin approval (`setClaimStatus`) — sets `claimedAt` + `claimedByDid`.
     * - PDS migration handshake (`claimProductListingToPds`) — sets `migratedFromAtUri`
     *   and re-points `repoDid` to the user. Does not touch `claimedAt` / `claimedByDid`.
     *
     * Restrict the migration branch to verified rows whose `repoDid` is no longer the
     * store account so we don't surface spoofed `migratedFromAtUri` values from
     * unverified records.
     */
    const atstoreDid = await getAtstoreRepoDid()

    const effectiveClaimedAt = sql<Date>`COALESCE(${listings.claimedAt}, ${listings.updatedAt})`

    const rows = await db
      .select({
        id: listings.id,
        name: listings.name,
        slug: listings.slug,
        tagline: listings.tagline,
        iconUrl: listings.iconUrl,
        externalUrl: listings.externalUrl,
        categorySlugs: listings.categorySlugs,
        claimedAt: listings.claimedAt,
        claimedByDid: listings.claimedByDid,
        productAccountHandle: listings.productAccountHandle,
        productAccountDid: listings.productAccountDid,
        repoDid: listings.repoDid,
        migratedFromAtUri: listings.migratedFromAtUri,
        verificationStatus: listings.verificationStatus,
        updatedAt: listings.updatedAt,
        effectiveClaimedAt,
      })
      .from(listings)
      .where(
        or(
          and(
            isNotNull(listings.claimedAt),
            isNotNull(listings.claimedByDid),
          ),
          and(
            isNotNull(listings.migratedFromAtUri),
            isNotNull(listings.repoDid),
            ne(listings.repoDid, atstoreDid),
            eq(listings.verificationStatus, 'verified'),
          ),
        ),
      )
      .orderBy(desc(effectiveClaimedAt))
      .limit(RECENTLY_CLAIMED_LISTINGS_LIMIT)

    return rows.map((row) => {
      const isMigration =
        row.claimedAt == null &&
        row.migratedFromAtUri != null &&
        row.repoDid != null &&
        row.repoDid !== atstoreDid
      const claimedByDid = row.claimedByDid ?? (isMigration ? row.repoDid : null)
      const claimedAtDate =
        row.claimedAt ?? (isMigration ? row.updatedAt : null)
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        tagline: row.tagline,
        iconUrl: protocolRecordImageUrlOrNull(row.iconUrl),
        externalUrl: row.externalUrl,
        categorySlugs: row.categorySlugs,
        productAccountHandle: row.productAccountHandle,
        productAccountDid: row.productAccountDid,
        claimedByDid,
        claimedAt: claimedAtDate ? claimedAtDate.toISOString() : null,
        claimSource: (isMigration ? 'pds-migration' : 'admin-approval') as
          | 'pds-migration'
          | 'admin-approval',
      }
    })
  })

const getRecentlyClaimedListingsQueryOptions = queryOptions({
  queryKey: ['admin', 'recently-claimed-listings'],
  queryFn: async () => getRecentlyClaimedListings(),
})

export const adminApi = {
  getAdminDashboard,
  getAdminDashboardQueryOptions,
  setListingVerification,
  setClaimStatus,
  setHomePageHeroListings,
  getRecentReviews,
  getRecentReviewsQueryOptions,
  getRecentlyClaimedListings,
  getRecentlyClaimedListingsQueryOptions,
}
