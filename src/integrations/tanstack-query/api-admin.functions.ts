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
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { dbMiddleware } from "./db-middleware";

const HOME_HERO_SLOT_COUNT = 3;
const RECENT_REVIEWS_LIMIT = 200;
const RECENTLY_CLAIMED_LISTINGS_LIMIT = 200;
const ADMIN_OVERVIEW_REVIEWS_PREVIEW = 6;
const ADMIN_OVERVIEW_CLAIMED_PREVIEW = 5;
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
    const reviews = schema.storeListingReviews;

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
      pendingClaims,
      homePageHeroListings,
      totalClaimedRow,
      unclaimedVerifiedRow,
      monthlyClaimRows,
      recentClaimedRaw,
      reviewPreviewRows,
    ] = await Promise.all([
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
              eq(listings.verificationStatus, "verified"),
            ),
          ),
        )
        .orderBy(
          desc(sql`COALESCE(${listings.claimedAt}, ${listings.createdAt})`),
          desc(listings.id),
        )
        .limit(ADMIN_OVERVIEW_CLAIMED_PREVIEW),
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

    const recentClaimedPreview = recentClaimedRaw.map((row) => {
      const whenIso = row.claimedAt
        ? row.claimedAt.toISOString()
        : row.createdAt.toISOString();
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        whenIso,
        statusLabel:
          row.verificationStatus === "verified"
            ? ("approved" as const)
            : ("pending" as const),
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
      pendingClaims: pendingClaims.map((row) => ({
        ...row,
        listingIconUrl: httpsListingImageUrlOrNull(row.listingIconUrl),
      })),
      homePageHeroListings,
      totalClaimedCount: totalClaimedRow[0]?.count ?? 0,
      claimsOverTime,
      recentClaimedPreview,
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

const getRecentlyClaimedListings = createServerFn({ method: "GET" })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context;
    const listings = schema.storeListings;

    /**
     * "Claimed" covers two paths:
     * - Manual admin approval (`setClaimStatus`) — sets `claimedAt` + `claimedByDid`.
     * - PDS migration (`claimProductListingToPds`) — sets `migratedFromAtUri`, re-points
     *   `repoDid`, and (on success) `claimedAt` + `claimedByDid` so claim time is stable
     *   (Tap ingest does not bump those columns).
     *
     * Restrict the migration branch to verified rows whose `repoDid` is no longer the
     * store account so we don't surface spoofed `migratedFromAtUri` values from
     * unverified records.
     *
     * Sort by `COALESCE(claimed_at, created_at)` only. Legacy PDS rows without
     * `claimed_at` use directory date added; backfill `claimed_at` when possible.
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
      .where(
        or(
          and(isNotNull(listings.claimedAt), isNotNull(listings.claimedByDid)),
          and(
            isNotNull(listings.migratedFromAtUri),
            isNotNull(listings.repoDid),
            ne(listings.repoDid, atstoreDid),
            eq(listings.verificationStatus, "verified"),
          ),
        ),
      )
      .orderBy(
        desc(sql`COALESCE(${listings.claimedAt}, ${listings.createdAt})`),
        desc(listings.id),
      )
      .limit(RECENTLY_CLAIMED_LISTINGS_LIMIT);

    return rows.map((row) => {
      const isMigration =
        row.migratedFromAtUri != null &&
        row.repoDid != null &&
        row.repoDid !== atstoreDid;
      const claimedByDid =
        row.claimedByDid ?? (isMigration ? row.repoDid : null);
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
        claimedByDid,
        claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        claimSource: (isMigration ? "pds-migration" : "admin-approval") as
          | "pds-migration"
          | "admin-approval",
      };
    });
  });

const getRecentlyClaimedListingsQueryOptions = queryOptions({
  queryKey: ["admin", "recently-claimed-listings"],
  queryFn: async () => getRecentlyClaimedListings(),
});

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
};
