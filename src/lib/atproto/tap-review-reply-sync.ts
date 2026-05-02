import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { COLLECTION, NSID } from "#/lib/atproto/nsids";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";

const replyBodySchema = z.object({
  subject: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("at://"), {
      message: "subject must be an at:// URI",
    }),
  text: z.string().min(1).max(8000),
  createdAt: z.string().min(1),
});

export type FyiAtstoreListingReviewReply = {
  $type: typeof NSID.listingReviewReply;
  subject: string;
  text: string;
  createdAt: string;
};

export type ListingReviewReplyParseResult =
  | { ok: true; record: FyiAtstoreListingReviewReply }
  | {
      ok: false;
      reason: string;
      stage: "no_body" | "zod" | "datetime";
      zodError?: z.ZodError;
    };

export function tryParseListingReviewReplyRecord(
  body: Record<string, unknown> | undefined,
): ListingReviewReplyParseResult {
  if (!body) {
    return {
      ok: false,
      reason: "record body is missing",
      stage: "no_body",
    };
  }

  const parsed = replyBodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const detail = [
      ...Object.entries(issues.fieldErrors).flatMap(
        ([k, v]) => v?.map((m) => `${k}: ${m}`) ?? [],
      ),
      ...(issues.formErrors ?? []),
    ].join("; ");
    return {
      ok: false,
      reason: detail || parsed.error.message,
      stage: "zod",
      zodError: parsed.error,
    };
  }

  const d = parsed.data;
  const created = new Date(d.createdAt);
  if (Number.isNaN(created.getTime())) {
    return {
      ok: false,
      reason: "createdAt is not a valid datetime",
      stage: "datetime",
    };
  }

  return {
    ok: true,
    record: {
      $type: NSID.listingReviewReply,
      subject: d.subject.trim(),
      text: d.text.trim(),
      createdAt: d.createdAt,
    },
  };
}

function atUriForReviewReply(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingReviewReply}/${rkey}`;
}

function listingAllowsReplyAuthor(
  replyAuthorDid: string,
  ctx: {
    reviewAuthorDid: string;
    listingRepoDid: string | null;
    listingProductAccountDid: string | null;
  },
): boolean {
  if (replyAuthorDid === ctx.reviewAuthorDid) return true;
  const rd = ctx.listingRepoDid?.trim();
  if (rd && replyAuthorDid === rd) return true;
  const pd = ctx.listingProductAccountDid?.trim();
  if (pd && replyAuthorDid === pd) return true;
  return false;
}

export async function recomputeListingReviewReplyCount(
  db: Database,
  reviewId: string,
) {
  const rep = schema.storeListingReviewReplies;
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(rep)
    .where(eq(rep.reviewId, reviewId));

  const n = Number(cnt ?? 0);
  await db
    .update(schema.storeListingReviews)
    .set({
      replyCount: n,
      updatedAt: new Date(),
    })
    .where(eq(schema.storeListingReviews.id, reviewId));
}

/**
 * Upsert `store_listing_review_replies` from Tap (`fyi.atstore.listing.reviewReply`).
 */
export async function upsertListingReviewReplyFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: FyiAtstoreListingReviewReply;
}) {
  const { db, did, rkey, record } = input;
  const atUri = atUriForReviewReply(did, rkey);

  const rev = schema.storeListingReviews;
  const list = schema.storeListings;

  const [joined] = await db
    .select({
      reviewId: rev.id,
      storeListingId: rev.storeListingId,
      reviewAtUri: rev.atUri,
      reviewAuthorDid: rev.authorDid,
      listingRepoDid: list.repoDid,
      listingProductAccountDid: list.productAccountDid,
    })
    .from(rev)
    .innerJoin(list, eq(rev.storeListingId, list.id))
    .where(eq(rev.atUri, record.subject.trim()))
    .limit(1);

  if (!joined) {
    console.warn(
      `[tap-review-reply] skip reply — no store_listing_reviews row for subject=${record.subject} did=${did} rkey=${rkey}`,
    );
    return;
  }

  if (!listingAllowsReplyAuthor(did, joined)) {
    console.warn(
      `[tap-review-reply] reject — unauthorized author did=${did} rkey=${rkey} review=${joined.reviewId}`,
    );
    return;
  }

  const replyCreatedAt = new Date(record.createdAt);
  const text = record.text.trim();

  await db
    .insert(schema.storeListingReviewReplies)
    .values({
      storeListingId: joined.storeListingId,
      reviewId: joined.reviewId,
      authorDid: did,
      rkey,
      atUri,
      subjectUri: record.subject.trim(),
      text,
      replyCreatedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.storeListingReviewReplies.authorDid,
        schema.storeListingReviewReplies.rkey,
      ],
      set: {
        storeListingId: joined.storeListingId,
        reviewId: joined.reviewId,
        atUri,
        subjectUri: record.subject.trim(),
        text,
        replyCreatedAt,
        updatedAt: new Date(),
      },
    });

  await recomputeListingReviewReplyCount(db, joined.reviewId);
}

export async function deleteListingReviewReplyFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  const { db, did, rkey } = input;

  const deleted = await db
    .delete(schema.storeListingReviewReplies)
    .where(
      and(
        eq(schema.storeListingReviewReplies.authorDid, did),
        eq(schema.storeListingReviewReplies.rkey, rkey),
      ),
    )
    .returning({ reviewId: schema.storeListingReviewReplies.reviewId });

  for (const row of deleted) {
    await recomputeListingReviewReplyCount(db, row.reviewId);
  }
}

/** Read-side predicate: replies only from reviewer or listing owner repos. */
export function sqlReplyAuthorAllowedPredicate(
  rep: typeof schema.storeListingReviewReplies,
  reviews: typeof schema.storeListingReviews,
  listings: typeof schema.storeListings,
) {
  return or(
    eq(rep.authorDid, reviews.authorDid),
    and(isNotNull(listings.repoDid), eq(rep.authorDid, listings.repoDid)),
    and(
      isNotNull(listings.productAccountDid),
      eq(rep.authorDid, listings.productAccountDid),
    ),
  )!;
}
