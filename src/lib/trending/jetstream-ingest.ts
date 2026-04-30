import type { Database } from "#/db/index.server";
import type {
  FacetSlice,
  ListingMentionIndex,
} from "#/lib/trending/mention-matcher";

import * as schema from "#/db/schema";
import {
  buildListingMentionIndex,
  excerptText,
  extractUrlsFromText,
  facetLinkUris,
  facetMentionHandles,
  matchPostToListings,
} from "#/lib/trending/mention-matcher";
import { recomputeListingTrending } from "#/lib/trending/recompute-listing-trending";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Walk nested objects and collect string values that look like URLs. */
function collectUriFieldsFromUnknown(value: unknown): Array<string> {
  const out: Array<string> = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (
        v.startsWith("http://") ||
        v.startsWith("https://") ||
        v.startsWith("at://")
      ) {
        out.push(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v === "object") {
      for (const x of Object.values(v as object)) walk(x);
    }
  };
  walk(value);
  return out;
}

// Re-export for tests / consumer
export { collectUriFieldsFromUnknown as collectUriFields };

const jetstreamEventSchema = z.object({
  did: z.string(),
  time_us: z.number(),
  kind: z.string().optional(),
  commit: z
    .object({
      operation: z.string(),
      collection: z.string(),
      rkey: z.string(),
      cid: z.string().optional(),
      record: z.unknown().optional(),
    })
    .optional(),
});

const postRecordSchema = z.object({
  $type: z.string(),
  text: z.string().optional().default(""),
  facets: z.array(z.unknown()).optional(),
  createdAt: z.string().optional(),
  embed: z.unknown().optional(),
});

const JETSTREAM_CURSOR_ID = "default";
const INDEX_TTL_MS = 5 * 60 * 1000;

let mentionIndexCache: { index: ListingMentionIndex; loadedAt: number } | null =
  null;

export async function loadListingMentionIndex(
  db: Database,
  force = false,
): Promise<ListingMentionIndex> {
  if (
    !force &&
    mentionIndexCache &&
    Date.now() - mentionIndexCache.loadedAt < INDEX_TTL_MS
  ) {
    return mentionIndexCache.index;
  }

  const rows = await db
    .select({
      id: schema.storeListings.id,
      name: schema.storeListings.name,
      slug: schema.storeListings.slug,
      sourceUrl: schema.storeListings.sourceUrl,
      externalUrl: schema.storeListings.externalUrl,
      productAccountHandle: schema.storeListings.productAccountHandle,
      categorySlugs: schema.storeListings.categorySlugs,
    })
    .from(schema.storeListings);

  const index = buildListingMentionIndex(rows);
  mentionIndexCache = { index, loadedAt: Date.now() };
  return index;
}

export function invalidateListingMentionIndexCache() {
  mentionIndexCache = null;
}

export async function getJetstreamCursor(
  db: Database,
): Promise<number | undefined> {
  const [row] = await db
    .select({ timeUs: schema.jetstreamConsumerState.timeUs })
    .from(schema.jetstreamConsumerState)
    .where(eq(schema.jetstreamConsumerState.id, JETSTREAM_CURSOR_ID))
    .limit(1);
  return row?.timeUs;
}

export async function saveJetstreamCursor(db: Database, timeUs: number) {
  await db
    .insert(schema.jetstreamConsumerState)
    .values({
      id: JETSTREAM_CURSOR_ID,
      timeUs,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.jetstreamConsumerState.id,
      set: {
        timeUs,
        updatedAt: new Date(),
      },
    });
}

function parsePostRecord(record: unknown): {
  text: string;
  facets: FacetSlice[] | undefined;
  createdAt: string | null;
  embedUris: Array<string>;
} | null {
  const parsed = postRecordSchema.safeParse(record);
  if (!parsed.success || parsed.data.$type !== "app.bsky.feed.post") {
    return null;
  }
  const facets = parsed.data.facets as FacetSlice[] | undefined;
  const embedUris = collectUriFieldsFromUnknown(parsed.data.embed);
  return {
    text: parsed.data.text ?? "",
    facets,
    createdAt: parsed.data.createdAt ?? null,
    embedUris,
  };
}

/** Returned by `ingestJetstreamCommitLine` for metrics and consumer logging. */
export type JetstreamIngestMeta = {
  eventKind?: string;
  collection?: string;
  operation?: string;
  postUri?: string;
  repoDid?: string;
  /** Rows written or delete rows that triggered recompute */
  listingMatches?: number;
  skipReason?: string;
};

export type JetstreamIngestResult = {
  time_us: number;
  processed: boolean;
  meta?: JetstreamIngestMeta;
};

/**
 * Apply one Jetstream JSON line: upsert mentions for creates, remove for deletes.
 */
export async function ingestJetstreamCommitLine(
  db: Database,
  line: string,
  index: ListingMentionIndex,
): Promise<JetstreamIngestResult | null> {
  let evt: z.infer<typeof jetstreamEventSchema>;
  try {
    evt = jetstreamEventSchema.parse(JSON.parse(line));
  } catch {
    return null;
  }

  if (evt.kind !== "commit" || !evt.commit) {
    return {
      time_us: evt.time_us,
      processed: false,
      meta: {
        eventKind: evt.kind ?? "(none)",
        skipReason: "non_commit_event",
      },
    };
  }

  const { operation, collection, rkey, cid, record } = evt.commit;
  const did = evt.did;
  const postUri = `at://${did}/app.bsky.feed.post/${rkey}`;

  if (collection !== "app.bsky.feed.post") {
    return {
      time_us: evt.time_us,
      processed: false,
      meta: {
        collection,
        repoDid: did,
        skipReason: "collection_filtered",
      },
    };
  }

  if (operation === "delete") {
    const affected = await db
      .select({ storeListingId: schema.storeListingMentions.storeListingId })
      .from(schema.storeListingMentions)
      .where(eq(schema.storeListingMentions.postUri, postUri));

    await db
      .delete(schema.storeListingMentions)
      .where(eq(schema.storeListingMentions.postUri, postUri));

    const uniqueIds = [...new Set(affected.map((r) => r.storeListingId))];
    for (const id of uniqueIds) {
      await recomputeListingTrending(db, id);
    }
    return {
      time_us: evt.time_us,
      processed: true,
      meta: {
        postUri,
        operation: "delete",
        repoDid: did,
        listingMatches: uniqueIds.length,
      },
    };
  }

  if (operation !== "create" && operation !== "update") {
    return {
      time_us: evt.time_us,
      processed: false,
      meta: {
        postUri,
        operation,
        repoDid: did,
        skipReason: "operation_filtered",
      },
    };
  }

  const parsedPost = parsePostRecord(record);
  if (!parsedPost) {
    return {
      time_us: evt.time_us,
      processed: false,
      meta: {
        postUri,
        operation,
        repoDid: did,
        skipReason: "unparsed_post",
      },
    };
  }

  const text = parsedPost.text;
  const urls = [
    ...extractUrlsFromText(text),
    ...facetLinkUris(parsedPost.facets),
    ...parsedPost.embedUris,
  ];
  const facetHandles = facetMentionHandles(text, parsedPost.facets);

  const hits = matchPostToListings({
    index,
    text,
    urls,
    facetHandles,
  });

  if (hits.length === 0) {
    return {
      time_us: evt.time_us,
      processed: false,
      meta: {
        postUri,
        operation,
        repoDid: did,
        skipReason: "no_listing_match",
      },
    };
  }

  const createdAt = parsedPost.createdAt
    ? new Date(parsedPost.createdAt)
    : new Date();

  const affectedListingIds = new Set<string>();

  for (const hit of hits) {
    affectedListingIds.add(hit.storeListingId);
    await db
      .insert(schema.storeListingMentions)
      .values({
        storeListingId: hit.storeListingId,
        source: "jetstream",
        postUri,
        postCid: cid ?? null,
        authorDid: did,
        authorHandle: null,
        postText: excerptText(text),
        postCreatedAt: createdAt,
        matchType: hit.matchType,
        matchConfidence: hit.confidence,
        matchEvidence: hit.evidence,
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.storeListingMentions.storeListingId,
          schema.storeListingMentions.postUri,
        ],
        set: {
          postCid: cid ?? null,
          postText: excerptText(text),
          postCreatedAt: createdAt,
          matchType: hit.matchType,
          matchConfidence: hit.confidence,
          matchEvidence: hit.evidence,
          indexedAt: new Date(),
        },
      });
  }

  for (const id of affectedListingIds) {
    await recomputeListingTrending(db, id);
  }

  return {
    time_us: evt.time_us,
    processed: true,
    meta: {
      postUri,
      operation,
      repoDid: did,
      listingMatches: hits.length,
    },
  };
}
