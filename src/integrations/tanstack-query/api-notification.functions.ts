import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { fetchBlueskyHandleForDid } from "#/lib/bluesky-public-profile";
import { httpsListingImageUrlOrNull } from "#/lib/listing-image-url";
import { getAtprotoSessionForRequest } from "#/middleware/auth";
import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";

import { dbMiddleware } from "./db-middleware";

export type ProductNotificationType =
  | "listing_liked"
  | "listing_reviewed"
  | "listing_verified"
  | "listing_rejected"
  | "claim_approved"
  | "claim_rejected";

export interface ProductNotification {
  id: string;
  type: ProductNotificationType;
  createdAt: string;
  listingId: string;
  listingName: string;
  listingSlug: string | null;
  listingIconUrl: string | null;
  actorDid: string;
  actorHandle: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  reviewRating: number | null;
  reviewText: string | null;
}

const getProductNotificationsInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
});

const getProductNotifications = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .inputValidator(getProductNotificationsInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return [] satisfies Array<ProductNotification>;
    }

    const list = context.schema.storeListings;
    const rev = context.schema.storeListingReviews;
    const fav = context.schema.storeListingFavorites;
    const claims = context.schema.listingClaims;
    const rej = context.schema.storeListingRejectionEvents;
    const approvals = context.schema.storeListingVerificationApprovalEvents;

    const [reviewRows, favoriteRows, claimRows, rejectionRows, approvalRows] =
      await Promise.all([
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
              eq(list.verificationStatus, "verified"),
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
              eq(list.verificationStatus, "verified"),
              eq(list.productAccountDid, session.did),
              ne(fav.authorDid, session.did),
            ),
          )
          .orderBy(desc(fav.favoriteCreatedAt))
          .limit(data.limit),
        context.db
          .select({
            id: claims.id,
            decidedAt: claims.decidedAt,
            status: claims.status,
            listingId: list.id,
            listingName: list.name,
            listingSlug: list.slug,
            listingIconUrl: list.iconUrl,
          })
          .from(claims)
          .innerJoin(list, eq(claims.storeListingId, list.id))
          .where(
            and(
              eq(claims.claimantDid, session.did),
              inArray(claims.status, ["approved", "rejected"]),
              isNotNull(claims.decidedAt),
            ),
          )
          .orderBy(desc(claims.decidedAt))
          .limit(data.limit),
        context.db
          .select({
            id: rej.id,
            createdAt: rej.createdAt,
            reason: rej.reason,
            reviewerDid: rej.reviewerDid,
            listingId: list.id,
            listingName: list.name,
            listingSlug: list.slug,
            listingIconUrl: list.iconUrl,
          })
          .from(rej)
          .innerJoin(list, eq(rej.storeListingId, list.id))
          .where(eq(list.productAccountDid, session.did))
          .orderBy(desc(rej.createdAt))
          .limit(data.limit),
        context.db
          .select({
            id: approvals.id,
            createdAt: approvals.createdAt,
            reviewerDid: approvals.reviewerDid,
            listingId: list.id,
            listingName: list.name,
            listingSlug: list.slug,
            listingIconUrl: list.iconUrl,
          })
          .from(approvals)
          .innerJoin(list, eq(approvals.storeListingId, list.id))
          .where(eq(list.productAccountDid, session.did))
          .orderBy(desc(approvals.createdAt))
          .limit(data.limit),
      ]);

    const actorDidsToResolve = [
      ...new Set([
        ...reviewRows.map((row) => row.actorDid),
        ...favoriteRows.map((row) => row.actorDid),
        ...rejectionRows.flatMap((row) => {
          const id = row.reviewerDid?.trim();
          return id ? [id] : [];
        }),
        ...approvalRows.flatMap((row) => {
          const id = row.reviewerDid?.trim();
          return id ? [id] : [];
        }),
      ]),
    ];
    const actorHandleEntries = await Promise.all(
      actorDidsToResolve.map(
        async (did) => [did, await fetchBlueskyHandleForDid(did)] as const,
      ),
    );
    const actorHandleByDid = new Map(actorHandleEntries);

    const merged = [
      ...reviewRows.map((row) => ({
        id: `review:${row.id}`,
        type: "listing_reviewed" as const,
        createdAt: row.createdAt.toISOString(),
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        listingIconUrl: null,
        actorDid: row.actorDid,
        actorHandle: actorHandleByDid.get(row.actorDid) ?? null,
        actorDisplayName: row.actorDisplayName?.trim() || null,
        actorAvatarUrl: row.actorAvatarUrl?.trim() || null,
        reviewRating: row.reviewRating,
        reviewText: row.reviewText?.trim() || null,
      })),
      ...favoriteRows.map((row) => ({
        id: `favorite:${row.id}`,
        type: "listing_liked" as const,
        createdAt: row.createdAt.toISOString(),
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        listingIconUrl: null,
        actorDid: row.actorDid,
        actorHandle: actorHandleByDid.get(row.actorDid) ?? null,
        actorDisplayName: null,
        actorAvatarUrl: null,
        reviewRating: null,
        reviewText: null,
      })),
      ...claimRows.map((row) => ({
        id: `claim:${row.id}`,
        type:
          row.status === "approved"
            ? ("claim_approved" as const)
            : ("claim_rejected" as const),
        createdAt:
          row.decidedAt == null
            ? new Date(0).toISOString()
            : row.decidedAt.toISOString(),
        listingId: row.listingId,
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
        actorDid: session.did,
        actorHandle: null,
        actorDisplayName: null,
        actorAvatarUrl: null,
        reviewRating: null,
        reviewText: null,
      })),
      ...rejectionRows.map((row) => {
        const reviewer = row.reviewerDid?.trim();
        const actorDid =
          reviewer && reviewer.length > 0 ? reviewer : session.did;
        return {
          id: `listing_rejected:${row.id}`,
          type: "listing_rejected" as const,
          createdAt: row.createdAt.toISOString(),
          listingId: row.listingId,
          listingName: row.listingName,
          listingSlug: row.listingSlug,
          listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
          actorDid,
          actorHandle: actorHandleByDid.get(actorDid) ?? null,
          actorDisplayName: null,
          actorAvatarUrl: null,
          reviewRating: null,
          reviewText: row.reason.trim(),
        };
      }),
      ...approvalRows.map((row) => {
        const reviewer = row.reviewerDid?.trim();
        const actorDid =
          reviewer && reviewer.length > 0 ? reviewer : session.did;
        return {
          id: `listing_verified:${row.id}`,
          type: "listing_verified" as const,
          createdAt: row.createdAt.toISOString(),
          listingId: row.listingId,
          listingName: row.listingName,
          listingSlug: row.listingSlug,
          listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
          actorDid,
          actorHandle: actorHandleByDid.get(actorDid) ?? null,
          actorDisplayName: null,
          actorAvatarUrl: null,
          reviewRating: null,
          reviewText: null,
        };
      }),
    ];

    merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return merged.slice(0, data.limit) satisfies Array<ProductNotification>;
  });

function getProductNotificationsQueryOptions({
  limit = 50,
}: {
  limit?: number;
} = {}) {
  return queryOptions({
    queryKey: ["notifications", "productEngagement", limit] as const,
    queryFn: async () => getProductNotifications({ data: { limit } }),
  });
}

const markNotificationsReadInput = z.object({
  readAtIso: z.string().min(1),
});

const getNotificationsReadAt = createServerFn({ method: "GET" })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return { readAtIso: null as string | null };
    }

    const userTbl = context.schema.user;
    const [row] = await context.db
      .select({ notificationsReadAt: userTbl.notificationsReadAt })
      .from(userTbl)
      .where(eq(userTbl.did, session.did))
      .limit(1);

    return {
      readAtIso: row?.notificationsReadAt?.toISOString() ?? null,
    };
  });

const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([dbMiddleware])
  .inputValidator(markNotificationsReadInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest());
    if (!session?.did) {
      return { ok: false as const };
    }

    const readAtMs = Date.parse(data.readAtIso);
    if (!Number.isFinite(readAtMs)) {
      throw new TypeError("Invalid readAtIso");
    }

    const userTbl = context.schema.user;
    const updatedAt = new Date();
    await context.db
      .update(userTbl)
      .set({
        notificationsReadAt: new Date(readAtMs),
        updatedAt,
      })
      .where(eq(userTbl.did, session.did));

    return { ok: true as const };
  });

function getNotificationsReadAtQueryOptions() {
  return queryOptions({
    queryKey: ["notifications", "readAt"] as const,
    queryFn: async () => getNotificationsReadAt(),
  });
}

export const notificationApi = {
  getProductNotifications,
  getProductNotificationsQueryOptions,
  getNotificationsReadAt,
  getNotificationsReadAtQueryOptions,
  markNotificationsRead,
};
