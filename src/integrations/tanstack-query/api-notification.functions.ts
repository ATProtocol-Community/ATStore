import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, ne } from 'drizzle-orm'
import { z } from 'zod'

import { getAtprotoSessionForRequest } from '#/middleware/auth'
import { dbMiddleware } from './db-middleware'

export type ProductNotificationType = 'listing_liked' | 'listing_reviewed'

export interface ProductNotification {
  id: string
  type: ProductNotificationType
  createdAt: string
  listingId: string
  listingName: string
  listingSlug: string | null
  actorDid: string
  actorDisplayName: string | null
  actorAvatarUrl: string | null
  reviewRating: number | null
  reviewText: string | null
}

const getProductNotificationsInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
})

const getProductNotifications = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getProductNotificationsInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest())
    if (!session?.did) {
      return [] satisfies ProductNotification[]
    }

    const list = context.schema.storeListings
    const rev = context.schema.storeListingReviews
    const fav = context.schema.storeListingFavorites

    const [reviewRows, favoriteRows] = await Promise.all([
      context.db
        .select({
          id: rev.id,
          createdAt: rev.reviewCreatedAt,
          listingId: list.id,
          listingName: list.name,
          listingSlug: list.slug,
          actorDid: rev.authorDid,
          actorDisplayName: rev.authorDisplayName,
          actorAvatarUrl: rev.authorAvatarUrl,
          reviewRating: rev.rating,
          reviewText: rev.text,
        })
        .from(rev)
        .innerJoin(list, eq(rev.storeListingId, list.id))
        .where(
          and(
            eq(list.verificationStatus, 'verified'),
            eq(list.productAccountDid, session.did),
            ne(rev.authorDid, session.did),
          ),
        )
        .orderBy(desc(rev.reviewCreatedAt))
        .limit(data.limit),
      context.db
        .select({
          id: fav.id,
          createdAt: fav.favoriteCreatedAt,
          listingId: list.id,
          listingName: list.name,
          listingSlug: list.slug,
          actorDid: fav.authorDid,
        })
        .from(fav)
        .innerJoin(list, eq(fav.storeListingId, list.id))
        .where(
          and(
            eq(list.verificationStatus, 'verified'),
            eq(list.productAccountDid, session.did),
            ne(fav.authorDid, session.did),
          ),
        )
        .orderBy(desc(fav.favoriteCreatedAt))
        .limit(data.limit),
    ])

    const merged = [
      ...reviewRows.map((row) => ({
        id: `review:${row.id}`,
        type: 'listing_reviewed' as const,
        createdAt: row.createdAt.toISOString(),
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        actorDid: row.actorDid,
        actorDisplayName: row.actorDisplayName?.trim() || null,
        actorAvatarUrl: row.actorAvatarUrl?.trim() || null,
        reviewRating: row.reviewRating,
        reviewText: row.reviewText?.trim() || null,
      })),
      ...favoriteRows.map((row) => ({
        id: `favorite:${row.id}`,
        type: 'listing_liked' as const,
        createdAt: row.createdAt.toISOString(),
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        actorDid: row.actorDid,
        actorDisplayName: null,
        actorAvatarUrl: null,
        reviewRating: null,
        reviewText: null,
      })),
    ]

    merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return merged.slice(0, data.limit) satisfies ProductNotification[]
  })

function getProductNotificationsQueryOptions({
  limit = 50,
}: {
  limit?: number
} = {}) {
  return queryOptions({
    queryKey: ['notifications', 'productEngagement', limit] as const,
    queryFn: async () => getProductNotifications({ data: { limit } }),
  })
}

export const notificationApi = {
  getProductNotifications,
  getProductNotificationsQueryOptions,
}
