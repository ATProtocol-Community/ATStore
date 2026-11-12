import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import {
  buildListingMentionIndex,
  extractUrlsFromText,
  matchPostToListings,
} from "#/lib/trending/mention-matcher";
import { recomputeListingTrending } from "#/lib/trending/recompute-listing-trending";
import { and, eq } from "drizzle-orm";

/**
 * When a listing's product account is replaced by a *different* account, its stored handle
 * mentions of the old account stop being mentions of the product (e.g. a listing created from a
 * personal account kept showing posts that @-mentioned that person). Re-match each one against the
 * listing as it is now: keep it if the post still matches (say, it links the product's site),
 * otherwise drop it.
 *
 * Only for a DID change — a handle rename is the same account, so its old-handle mentions stay.
 * Returns how many mentions were dropped. Caller refreshes the page snapshot.
 */
export async function pruneReplacedProductAccountMentions(
  db: Database,
  listingId: string,
): Promise<number> {
  const t = schema.storeListings;
  const m = schema.storeListingMentions;

  const [listing] = await db
    .select({
      id: t.id,
      name: t.name,
      slug: t.slug,
      sourceUrl: t.sourceUrl,
      externalUrl: t.externalUrl,
      productAccountHandle: t.productAccountHandle,
      categorySlugs: t.categorySlugs,
    })
    .from(t)
    .where(eq(t.id, listingId))
    .limit(1);
  if (!listing) return 0;

  const currentHandle =
    listing.productAccountHandle?.trim().replace(/^@/, "").toLowerCase() ||
    null;

  const handleMentions = await db
    .select({
      id: m.id,
      postText: m.postText,
      matchEvidence: m.matchEvidence,
    })
    .from(m)
    .where(and(eq(m.storeListingId, listingId), eq(m.matchType, "handle")));

  const index = buildListingMentionIndex([listing]);
  let dropped = 0;

  for (const mention of handleMentions) {
    const evidence = mention.matchEvidence as { handle?: unknown } | null;
    const matchedHandle =
      typeof evidence?.handle === "string" ? evidence.handle : null;
    if (matchedHandle && matchedHandle === currentHandle) continue;

    const text = mention.postText ?? "";
    const [hit] = matchPostToListings({
      index,
      text,
      urls: extractUrlsFromText(text),
      facetHandles: [],
    });

    if (hit) {
      await db
        .update(m)
        .set({
          matchType: hit.matchType,
          matchConfidence: hit.confidence,
          matchEvidence: hit.evidence,
        })
        .where(eq(m.id, mention.id));
    } else {
      await db.delete(m).where(eq(m.id, mention.id));
      dropped += 1;
    }
  }

  if (dropped > 0) {
    await recomputeListingTrending(db, listingId);
  }
  return dropped;
}
