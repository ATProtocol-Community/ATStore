import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAtstoreRepoDid } from "#/lib/atproto/publish-directory-listing";
import {
  fetchBlueskyHandleForDid,
  fetchBlueskyPublicProfileFields,
} from "#/lib/bluesky-public-profile";
import { httpsListingImageUrlOrNull } from "#/lib/listing-image-url";
import {
  adminFnMiddleware,
  getAtprotoSessionForRequest,
} from "#/middleware/auth";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { dbMiddleware } from "./db-middleware";

const HOME_HERO_SLOT_COUNT = 3;
const RECENT_REVIEWS_LIMIT = 200;
const RECENT_LISTINGS_LIMIT = 200;
const ADMIN_OVERVIEW_REVIEWS_PREVIEW = 6;
const ADMIN_OVERVIEW_LISTINGS_PREVIEW = 5;
/** Past complete UTC calendar months to include in admin claims burn-down chart (oldest → newest). */
const ADMIN_CLAIMS_OVER_TIME_MONTHS = 2;

const setListingVerificationInput = z
  .object({
    listingId: z.string().uuid(),
    status: z.enum(["verified", "rejected", "unverified"]),
    notes: z.string().max(8000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "rejected") {
      const trimmed = val.notes?.trim() ?? "";
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "A rejection reason is required.",
          path: ["notes"],
        });
      }
    }
  });

const setClaimStatusInput = z.object({
  claimId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

const setHomePageHeroListingsInput = z.object({
  listingIds: z
    .array(z.string().uuid())
    .length(HOME_HERO_SLOT_COUNT)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "listingIds must be unique",
    }),
});

const setHomePagePromoListingInput = z.object({
  listingId: z.string().uuid().nullable(),
});

function hasAppTwoSegmentCategory(categorySlugs: Array<string>) {
  return categorySlugs.some((slug) => {
    const trimmed = slug.trim();
    if (!trimmed.startsWith("apps/")) {
      return false;
    }
    return trimmed.split("/").length === 2;
  });
}

const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context;
    const listings = schema.storeListings;
    const claims = schema.listingClaims;
    const homeHero = schema.homePageHeroListings;
    const homePromo = schema.homePagePromoListing;
    const reviews = schema.storeListingReviews;
    const rejectionEvents = schema.storeListingRejectionEvents;

    /**
     * Latest rejection event per listing — used to detect rows that were rejected
     * by an admin and have since been resubmitted by the owner. Owner edits via
     * `updateOwnedProductListing` flip the row back to `unverified` (so the owner
     * sees "Pending review", not a stuck "Rejected"); we segregate those from
     * fresh submissions in the queue below by joining on this latest-rejection
     * subquery, so admins still see the prior rejection reason while re-reviewing.
     */
    const latestRejectionPerListing = db
      .select({
        storeListingId: rejectionEvents.storeListingId,
        reason: rejectionEvents.reason,
        rejectedAt: rejectionEvents.createdAt,
        rn: sql<number>`row_number() over (partition by ${rejectionEvents.storeListingId} order by ${rejectionEvents.createdAt} desc)`.as(
          "rn",
        ),
      })
      .from(rejectionEvents)
      .as("latest_rejection");

    const atstoreDid = await getAtstoreRepoDid();
    const listingIsClaimed = or(
      and(isNotNull(listings.claimedAt), isNotNull(listings.claimedByDid)),
      and(
        isNotNull(listings.migratedFromAtUri),
        isNotNull(listings.repoDid),
        ne(listings.repoDid, atstoreDid),
        eq(listings.verificationStatus, "verified"),
      ),
    );

    const now = new Date();
    const chartMonthSpan = ADMIN_CLAIMS_OVER_TIME_MONTHS - 1;
    const windowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - chartMonthSpan, 1),
    );

    const monthKeys: Array<string> = [];
    const monthLabels: Array<string> = [];
    for (let i = chartMonthSpan; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      monthKeys.push(
        `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      );
      monthLabels.push(
        d.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
      );
    }

    const [
      unverified,
      resubmittedAfterRejection,
      pendingClaims,
      homePageHeroListings,
      homePagePromoListingRows,
      totalClaimedRow,
      unclaimedVerifiedRow,
      monthlyClaimRows,
      recentListingsRaw,
      reviewPreviewRows,
    ] = await Promise.all([
      /**
       * Fresh "Unverified queue": never been rejected before. Resubmissions are
       * segregated below so admins can re-check them against the prior reason.
       */
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
        .leftJoin(
          latestRejectionPerListing,
          and(
            eq(latestRejectionPerListing.storeListingId, listings.id),
            eq(latestRejectionPerListing.rn, 1),
          ),
        )
        .where(
          and(
            eq(listings.verificationStatus, "unverified"),
            isNull(latestRejectionPerListing.storeListingId),
          ),
        )
        .orderBy(desc(listings.updatedAt)),
      /**
       * "Resubmitted after rejection": owner edited a previously-rejected
       * listing, which `updateOwnedProductListing` flips back to `unverified`.
       * Inner-joining on the latest rejection event gives admins the prior
       * reason while re-reviewing.
       */
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
          lastRejectionReason: latestRejectionPerListing.reason,
          lastRejectionAt: latestRejectionPerListing.rejectedAt,
        })
        .from(listings)
        .innerJoin(
          latestRejectionPerListing,
          and(
            eq(latestRejectionPerListing.storeListingId, listings.id),
            eq(latestRejectionPerListing.rn, 1),
          ),
        )
        .where(eq(listings.verificationStatus, "unverified"))
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
        .where(eq(claims.status, "pending"))
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
      db
        .select({
          id: listings.id,
          name: listings.name,
          slug: listings.slug,
        })
        .from(homePromo)
        .innerJoin(listings, eq(homePromo.storeListingId, listings.id))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(listings)
        .where(listingIsClaimed),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(listings)
        .where(
          and(
            eq(listings.verificationStatus, "verified"),
            sql`NOT (${listingIsClaimed})`,
          ),
        ),
      db
        .select({
          bucket: sql<string>`to_char(date_trunc('month', ${listings.claimedAt}), 'YYYY-MM')`,
          n: sql<number>`count(*)::int`,
        })
        .from(listings)
        .where(
          and(
            isNotNull(listings.claimedAt),
            gte(listings.claimedAt, windowStart),
          ),
        )
        .groupBy(sql`date_trunc('month', ${listings.claimedAt})`),
      db
        .select({
          id: listings.id,
          name: listings.name,
          slug: listings.slug,
          claimedAt: listings.claimedAt,
          claimedByDid: listings.claimedByDid,
          repoDid: listings.repoDid,
          migratedFromAtUri: listings.migratedFromAtUri,
          verificationStatus: listings.verificationStatus,
          createdAt: listings.createdAt,
        })
        .from(listings)
        .where(inArray(listings.verificationStatus, ["verified", "rejected"]))
        .orderBy(
          desc(sql`COALESCE(${listings.claimedAt}, ${listings.createdAt})`),
          desc(listings.id),
        )
        .limit(ADMIN_OVERVIEW_LISTINGS_PREVIEW),
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          text: reviews.text,
          reviewCreatedAt: reviews.reviewCreatedAt,
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
        .limit(ADMIN_OVERVIEW_REVIEWS_PREVIEW),
    ]);

    const newByMonth = new Map(
      monthlyClaimRows.map((r) => [r.bucket, r.n] as const),
    );
    const newClaims = monthKeys.map((k) => newByMonth.get(k) ?? 0);
    let running = 0;
    const cumulativeClaimed = newClaims.map((n) => {
      running += n;
      return running;
    });
    const totalNewInWindow = cumulativeClaimed.at(-1) ?? 0;
    const unclaimedNow = unclaimedVerifiedRow[0]?.count ?? 0;

    const claimsOverTime = monthKeys.map((_, i) => {
      const monthLabel = monthLabels[i] ?? "";
      const claimedCumulative = cumulativeClaimed[i] ?? 0;
      return {
        monthLabel,
        unclaimed: unclaimedNow + (totalNewInWindow - claimedCumulative),
        claimedCumulative,
      };
    });

    const recentListingsPreview = recentListingsRaw.map((row) => {
      const isMigration =
        row.migratedFromAtUri != null &&
        row.repoDid != null &&
        row.repoDid !== atstoreDid &&
        row.verificationStatus === "verified";
      const isClaimed =
        (row.claimedAt != null && row.claimedByDid != null) || isMigration;
      const whenIso = row.claimedAt
        ? row.claimedAt.toISOString()
        : row.createdAt.toISOString();
      let statusLabel: "claimed" | "verified" | "submitted" | "rejected";
      if (isClaimed) {
        statusLabel = "claimed";
      } else if (row.verificationStatus === "verified") {
        statusLabel = "verified";
      } else if (row.verificationStatus === "rejected") {
        statusLabel = "rejected";
      } else {
        statusLabel = "submitted";
      }
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        whenIso,
        statusLabel,
      };
    });

    const uniqueReviewDids = [
      ...new Set(reviewPreviewRows.map((r) => r.authorDid)),
    ];
    const profileEntries = await Promise.all(
      uniqueReviewDids.map(
        async (did) =>
          [did, await fetchBlueskyPublicProfileFields(did)] as const,
      ),
    );
    const profileByDid = new Map(profileEntries);

    const recentReviewsPreview = reviewPreviewRows.map((row) => {
      const profile = profileByDid.get(row.authorDid) ?? null;
      const displayName =
        row.authorDisplayName?.trim() ||
        profile?.displayName?.trim() ||
        profile?.handle ||
        null;
      const handle = profile?.handle ?? null;
      return {
        id: row.id,
        rating: row.rating,
        text: row.text,
        reviewCreatedAt: row.reviewCreatedAt.toISOString(),
        listingName: row.listingName,
        listingSlug: row.listingSlug,
        listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
        authorDisplayName: displayName,
        authorHandle: handle,
      };
    });

    return {
      unverified: unverified.map((row) => ({
        ...row,
        iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
        heroImageUrl: httpsListingImageUrlOrNull(row.heroImageUrl),
        screenshotUrls: (row.screenshotUrls ?? [])
          .map((url) => httpsListingImageUrlOrNull(url))
          .filter((url): url is string => url != null),
      })),
      resubmittedAfterRejection: resubmittedAfterRejection.map((row) => ({
        ...row,
        iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
        heroImageUrl: httpsListingImageUrlOrNull(row.heroImageUrl),
        screenshotUrls: (row.screenshotUrls ?? [])
          .map((url) => httpsListingImageUrlOrNull(url))
          .filter((url): url is string => url != null),
        lastRejectionAt: row.lastRejectionAt.toISOString(),
      })),
      pendingClaims: pendingClaims.map((row) => ({
        ...row,
        listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
      })),
      homePageHeroListings,
      homePagePromoListing: homePagePromoListingRows[0] ?? null,
      totalClaimedCount: totalClaimedRow[0]?.count ?? 0,
      claimsOverTime,
      recentListingsPreview,
      recentReviewsPreview,
    };
  });

const getAdminDashboardQueryOptions = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: async () => getAdminDashboard(),
});

const setListingVerification = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setListingVerificationInput)
  .handler(async ({ data, context }) => {
    const adminCtx = await getAtprotoSessionForRequest(getRequest());
    const reviewerDid = adminCtx?.did ?? null;

    const table = context.schema.storeListings;
    const events = context.schema.storeListingRejectionEvents;
    const approvals = context.schema.storeListingVerificationApprovalEvents;

    await context.db.transaction(async (tx) => {
      const [beforeRow] = await tx
        .select({ verificationStatus: table.verificationStatus })
        .from(table)
        .where(eq(table.id, data.listingId))
        .limit(1);

      await tx
        .update(table)
        .set({
          verificationStatus: data.status,
          updatedAt: new Date(),
        })
        .where(eq(table.id, data.listingId));

      if (
        data.status === "verified" &&
        beforeRow != null &&
        beforeRow.verificationStatus !== "verified"
      ) {
        await tx.insert(approvals).values({
          storeListingId: data.listingId,
          reviewerDid,
        });
      }

      if (data.status === "rejected") {
        const reason = data.notes?.trim() ?? "";
        await tx.insert(events).values({
          storeListingId: data.listingId,
          reason,
          reviewerDid,
        });
      }
    });

    return { ok: true as const };
  });

const setClaimStatus = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setClaimStatusInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context;
    const claimTable = schema.listingClaims;
    const listingTable = schema.storeListings;

    const [claim] = await db
      .select()
      .from(claimTable)
      .where(eq(claimTable.id, data.claimId))
      .limit(1);

    if (!claim) {
      throw new Error("Claim not found");
    }
    if (claim.status !== "pending") {
      throw new Error("This claim has already been processed");
    }

    const adminCtx = await getAtprotoSessionForRequest(getRequest());
    const deciderDid = adminCtx?.did;
    if (!deciderDid) {
      throw new Error("Unauthorized");
    }

    const now = new Date();
    const resolvedHandle =
      claim.claimantHandle?.trim() ||
      (await fetchBlueskyHandleForDid(claim.claimantDid));

    await db.transaction(async (tx) => {
      await tx
        .update(claimTable)
        .set({
          status: data.status,
          updatedAt: now,
          decidedAt: now,
          decidedByDid: deciderDid,
        })
        .where(eq(claimTable.id, data.claimId));

      if (data.status === "approved") {
        await tx
          .update(listingTable)
          .set({
            claimedByDid: claim.claimantDid,
            claimedAt: now,
            productAccountDid: claim.claimantDid,
            productAccountHandle: resolvedHandle ?? null,
            updatedAt: now,
          })
          .where(eq(listingTable.id, claim.storeListingId));
      }
    });

    return { ok: true as const };
  });

const setHomePageHeroListings = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setHomePageHeroListingsInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context;
    const listings = schema.storeListings;
    const homeHero = schema.homePageHeroListings;

    const selectedListings = await db
      .select({
        id: listings.id,
        categorySlugs: listings.categorySlugs,
      })
      .from(listings)
      .where(
        and(
          inArray(listings.id, data.listingIds),
          eq(listings.verificationStatus, "verified"),
        ),
      );

    const validSelectedListings = selectedListings.filter((row) =>
      hasAppTwoSegmentCategory(row.categorySlugs ?? []),
    );

    if (validSelectedListings.length !== data.listingIds.length) {
      throw new Error(
        "Every homepage hero listing must be a verified app listing (apps/*).",
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(homeHero);
      await tx.insert(homeHero).values(
        data.listingIds.map((listingId, index) => ({
          position: index,
          storeListingId: listingId,
          updatedAt: new Date(),
        })),
      );
    });

    return { ok: true as const };
  });

const setHomePagePromoListing = createServerFn({ method: "POST" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(setHomePagePromoListingInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context;
    const listings = schema.storeListings;
    const homePromo = schema.homePagePromoListing;

    if (data.listingId !== null) {
      const [selected] = await db
        .select({
          id: listings.id,
          categorySlugs: listings.categorySlugs,
          verificationStatus: listings.verificationStatus,
        })
        .from(listings)
        .where(eq(listings.id, data.listingId))
        .limit(1);

      if (!selected || selected.verificationStatus !== "verified") {
        throw new Error(
          "Promo listing must reference a verified app listing.",
        );
      }
      if (!hasAppTwoSegmentCategory(selected.categorySlugs ?? [])) {
        throw new Error(
          "Promo listing must reference a verified app listing (apps/*).",
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(homePromo);
      if (data.listingId !== null) {
        await tx.insert(homePromo).values({
          storeListingId: data.listingId,
          updatedAt: new Date(),
        });
      }
    });

    return { ok: true as const };
  });

const getRecentReviews = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context;
    const reviews = schema.storeListingReviews;
    const listings = schema.storeListings;

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
      .limit(RECENT_REVIEWS_LIMIT);

    const uniqueDids = [...new Set(rows.map((r) => r.authorDid))];
    const profileEntries = await Promise.all(
      uniqueDids.map(
        async (did) =>
          [did, await fetchBlueskyPublicProfileFields(did)] as const,
      ),
    );
    const profileByDid = new Map(profileEntries);

    return rows.map((row) => {
      const profile = profileByDid.get(row.authorDid) ?? null;
      const displayName =
        row.authorDisplayName?.trim() ||
        profile?.displayName?.trim() ||
        profile?.handle ||
        null;
      const avatarUrl =
        row.authorAvatarUrl?.trim() || profile?.avatarUrl || null;
      const handle = profile?.handle ?? null;
      return {
        ...row,
        reviewCreatedAt: row.reviewCreatedAt.toISOString(),
        listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
        authorDisplayName: displayName,
        authorAvatarUrl: avatarUrl,
        authorHandle: handle,
      };
    });
  });

const getRecentReviewsQueryOptions = queryOptions({
  queryKey: ["admin", "recent-reviews"],
  queryFn: async () => getRecentReviews(),
});

const getRecentListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context;
    const listings = schema.storeListings;

    /**
     * Returns recent listings — both claimed and submitted (unclaimed) —
     * ordered by most recent activity.
     *
     * "Claimed" covers two paths:
     * - Manual admin approval (`setClaimStatus`) — sets `claimedAt` + `claimedByDid`.
     * - PDS migration (`claimProductListingToPds`) — sets `migratedFromAtUri`, re-points
     *   `repoDid`, and (on success) `claimedAt` + `claimedByDid` so claim time is stable
     *   (Tap ingest does not bump those columns).
     *
     * The migration branch is only treated as claimed when the row is verified and its
     * `repoDid` is no longer the store account, so we don't surface spoofed
     * `migratedFromAtUri` values from unverified records.
     *
     * Sort by `COALESCE(claimed_at, created_at)` so claimed rows surface by claim time
     * and unclaimed rows by directory date added.
     */
    const atstoreDid = await getAtstoreRepoDid();

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
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(eq(listings.verificationStatus, "verified"))
      .orderBy(
        desc(sql`COALESCE(${listings.claimedAt}, ${listings.createdAt})`),
        desc(listings.id),
      )
      .limit(RECENT_LISTINGS_LIMIT);

    return rows.map((row) => {
      const isMigration =
        row.migratedFromAtUri != null &&
        row.repoDid != null &&
        row.repoDid !== atstoreDid &&
        row.verificationStatus === "verified";
      const isClaimed =
        (row.claimedAt != null && row.claimedByDid != null) || isMigration;
      const claimedByDid =
        row.claimedByDid ?? (isMigration ? row.repoDid : null);
      const claimSource = isClaimed
        ? ((isMigration ? "pds-migration" : "admin-approval") as
            | "pds-migration"
            | "admin-approval")
        : null;
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        tagline: row.tagline,
        iconUrl: httpsListingImageUrlOrNull(row.iconUrl),
        externalUrl: row.externalUrl,
        categorySlugs: row.categorySlugs,
        productAccountHandle: row.productAccountHandle,
        productAccountDid: row.productAccountDid,
        claimedByDid: isClaimed ? claimedByDid : null,
        claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        verificationStatus: row.verificationStatus,
        isClaimed,
        claimSource,
      };
    });
  });

const getRecentListingsQueryOptions = queryOptions({
  queryKey: ["admin", "recent-listings"],
  queryFn: async () => getRecentListings(),
});

export const adminApi = {
  getAdminDashboard,
  getAdminDashboardQueryOptions,
  setListingVerification,
  setClaimStatus,
  setHomePageHeroListings,
  setHomePagePromoListing,
  getRecentReviews,
  getRecentReviewsQueryOptions,
  getRecentListings,
  getRecentListingsQueryOptions,
};
