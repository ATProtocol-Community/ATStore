/**
 * Tap / backfill mirror of atmosphere.games records into the AT Store read model.
 *
 * - `games.atmosphere.define` → `store_listings` with `listing_type = 'game'`. A define record either
 *   backs its own game-only row (`at_uri` = define URI), or is merged onto an existing AT Store
 *   listing for the same product (`game_define_at_uri` set, `at_uri` stays the listing.detail URI).
 *   New game-only rows start `unverified` and go through the admin pending queue.
 * - `games.atmosphere.fave` → `store_listing_favorites` (same table as `fyi.atstore.listing.favorite`;
 *   the row `at_uri` carries the collection).
 */
import type { Database } from "#/db/index.server";
import type {
  GameDetails,
  GamesAtmosphereDefine,
} from "#/lib/atproto/game-define-record";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import * as schema from "#/db/schema";
import { parseAtUriParts } from "#/lib/atproto/at-uri";
import {
  gameDefineAtUri,
  gameDefineToListingFields,
  normalizeGameUrlForMatch,
} from "#/lib/atproto/game-define-record";
import { storeListingMatchesSubject } from "#/lib/atproto/listing-subject";
import { COLLECTION, GAMES_NSID } from "#/lib/atproto/nsids";
import { slugifyDirectoryListingName } from "#/lib/directory-listing-slugs";
import { refreshListingPageSnapshot } from "#/lib/listing-page-snapshot";
import { recomputeListingTrending } from "#/lib/trending/recompute-listing-trending";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

/** Editorial app tag every game listing carries (drives the 🎮 accent and `/apps?tag=games`). */
export const GAME_APP_TAG = "games";

const listingRefColumns = {
  id: schema.storeListings.id,
  atUri: schema.storeListings.atUri,
  repoDid: schema.storeListings.repoDid,
  listingType: schema.storeListings.listingType,
  gameDefineAtUri: schema.storeListings.gameDefineAtUri,
  gameDefinePriorAtUris: schema.storeListings.gameDefinePriorAtUris,
  gameDetails: schema.storeListings.gameDetails,
  verificationStatus: schema.storeListings.verificationStatus,
  name: schema.storeListings.name,
  tagline: schema.storeListings.tagline,
  fullDescription: schema.storeListings.fullDescription,
  externalUrl: schema.storeListings.externalUrl,
  iconUrl: schema.storeListings.iconUrl,
  heroImageUrl: schema.storeListings.heroImageUrl,
  screenshotUrls: schema.storeListings.screenshotUrls,
};

type ListingRef = {
  id: string;
  atUri: string | null;
  repoDid: string | null;
  listingType: string;
  gameDefineAtUri: string | null;
  gameDefinePriorAtUris: Array<string>;
  gameDetails: GameDetails | null;
  verificationStatus: string;
  name: string;
  tagline: string | null;
  fullDescription: string | null;
  externalUrl: string | null;
  iconUrl: string | null;
  heroImageUrl: string | null;
  screenshotUrls: Array<string>;
};

/** JSON with sorted object keys — `jsonb` reorders keys, so plain `JSON.stringify` can't compare. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).toSorted(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
}

/** Whether applying `fields` from `uri` would change anything shown for this row. */
function defineChangesRow(
  row: ListingRef,
  uri: string,
  fields: ReturnType<typeof gameDefineToListingFields>,
) {
  if (row.gameDefineAtUri !== uri) return true;
  if (stableJson(row.gameDetails) !== stableJson(fields.gameDetails)) {
    return true;
  }
  if (!isGameOnlyRow(row)) return false;
  return (
    stableJson([
      row.name,
      row.tagline,
      row.fullDescription,
      row.externalUrl,
      row.iconUrl,
      row.heroImageUrl,
      row.screenshotUrls,
    ]) !==
    stableJson([
      fields.name,
      fields.tagline,
      fields.fullDescription,
      fields.externalUrl,
      fields.iconUrl,
      fields.heroImageUrl,
      fields.screenshotUrls,
    ])
  );
}

/** SQL form of {@link normalizeGameUrlForMatch} for a URL column. */
function sqlNormalizedUrl(col: AnyPgColumn) {
  return sql`regexp_replace(regexp_replace(lower(split_part(split_part(${col}, '#', 1), '?', 1)), '^https?://(www\\.)?', ''), '/+$', '')`;
}

async function findListingsByPlayUrl(
  db: Database,
  url: string,
): Promise<Array<ListingRef>> {
  const normalized = normalizeGameUrlForMatch(url);
  if (!normalized) return [];
  const t = schema.storeListings;
  return db
    .select(listingRefColumns)
    .from(t)
    .where(
      sql`(${sqlNormalizedUrl(t.externalUrl)} = ${normalized} OR ${sqlNormalizedUrl(t.sourceUrl)} = ${normalized})`,
    )
    .limit(5);
}

async function uniqueGameSlug(db: Database, name: string): Promise<string> {
  const base = slugifyDirectoryListingName(name);
  const t = schema.storeListings;
  const taken = await db
    .select({ slug: t.slug })
    .from(t)
    .where(sql`${t.slug} = ${base} OR ${t.slug} LIKE ${`${base}-%`}`);
  const takenSet = new Set(taken.map((r) => r.slug));
  if (!takenSet.has(base)) return base;
  // Prefer `<name>-game` before numbered suffixes; reads better next to an app of the same name.
  if (!takenSet.has(`${base}-game`)) return `${base}-game`;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!takenSet.has(candidate)) return candidate;
  }
}

async function refreshSnapshotSafe(db: Database, listingId: string) {
  try {
    await refreshListingPageSnapshot(db, listingId);
  } catch (error) {
    console.warn(
      `[tap-game] page snapshot refresh failed id=${listingId}`,
      error,
    );
  }
}

function isGameOnlyRow(row: Pick<ListingRef, "atUri" | "gameDefineAtUri">) {
  return row.atUri != null && row.atUri === row.gameDefineAtUri;
}

/**
 * Upsert a `games.atmosphere.define` record.
 *
 * Resolution order:
 * 1. A row already bound to this define URI → refresh it.
 * 2. A game row for the same play URL bound to a *different* define record → if the incoming repo is
 *    one of that game's claimants (developer publishing their own copy of a held record), re-point the
 *    row to the new record and remember the old URI; otherwise skip (first record wins).
 * 3. An AT Store app listing for the same URL → merge (link the define record onto it).
 * 4. Otherwise insert a new game-only row (pending review unless the publisher is trusted).
 */
export async function upsertGameListingFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: GamesAtmosphereDefine;
  trustedPublisher: boolean;
}) {
  const { db, did, rkey, record, trustedPublisher } = input;
  const uri = gameDefineAtUri(did, rkey);
  const fields = gameDefineToListingFields({ did, rkey, record });
  const now = new Date();
  const t = schema.storeListings;

  const [bound] = await db
    .select(listingRefColumns)
    .from(t)
    .where(eq(t.gameDefineAtUri, uri))
    .limit(1);
  if (bound) {
    const changed = await applyDefineToRow(db, bound, {
      did,
      rkey,
      uri,
      fields,
      now,
    });
    console.log(
      `[tap-game] ${changed ? "refreshed" : "unchanged"} ${uri} → listing ${bound.id}`,
    );
    return;
  }

  const sameUrl = await findListingsByPlayUrl(db, record.url);

  const otherGame = sameUrl.find((r) => r.gameDefineAtUri != null);
  const otherDefineAtUri = otherGame?.gameDefineAtUri;
  if (otherGame && otherDefineAtUri) {
    const claimants = new Set(otherGame.gameDetails?.claimantDids ?? []);
    const existingRepo = parseAtUriParts(otherDefineAtUri).repo;
    // Never let a held copy displace the developer's own record.
    const existingIsSelfPublished = claimants.has(existingRepo);
    // The same repo republishing under a new rkey always replaces its own earlier record.
    const sameRepo = existingRepo === did;
    if (sameRepo || (claimants.has(did) && !existingIsSelfPublished)) {
      await applyDefineToRow(
        db,
        {
          ...otherGame,
          gameDefinePriorAtUris: [
            ...new Set([...otherGame.gameDefinePriorAtUris, otherDefineAtUri]),
          ],
        },
        { did, rkey, uri, fields, now },
      );
      console.log(
        `[tap-game] ${uri} takes over ${otherDefineAtUri} (listing ${otherGame.id})`,
      );
      return;
    }
    console.warn(
      `[tap-game] skip ${uri} — play URL already backed by ${otherDefineAtUri} (listing ${otherGame.id}); repo ${did} is not a claimant`,
    );
    return;
  }

  const app = sameUrl.find((r) => r.gameDefineAtUri == null);
  if (app) {
    await linkDefineToListing(db, app.id, { uri, fields, now });
    console.log(`[tap-game] merged ${uri} onto existing listing ${app.id}`);
    return;
  }

  const slug = await uniqueGameSlug(db, record.name);
  let verificationStatus = trustedPublisher ? "verified" : "unverified";
  if (
    process.env.LOCAL_VERIFY_ALL_TAP_LISTINGS === "1" ||
    process.env.LOCAL_VERIFY_ALL_TAP_LISTINGS === "true"
  ) {
    verificationStatus = "verified";
  }

  const [inserted] = await db
    .insert(t)
    .values({
      sourceUrl: record.url,
      name: fields.name,
      slug,
      externalUrl: fields.externalUrl,
      iconUrl: fields.iconUrl,
      heroImageUrl: fields.heroImageUrl,
      screenshotUrls: fields.screenshotUrls,
      tagline: fields.tagline,
      fullDescription: fields.fullDescription,
      categorySlugs: [`apps/${slug}`],
      appTags: [GAME_APP_TAG],
      atUri: uri,
      repoDid: did,
      rkey,
      sourceAccountDid: did,
      verificationStatus,
      productAccountDid: fields.gameDetails.developer?.did ?? null,
      listingType: "game",
      gameDefineAtUri: uri,
      gameDetails: fields.gameDetails,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: t.id });

  if (!inserted) {
    console.warn(
      `[tap-game] skip ${uri} — insert conflicted (slug=${slug} url=${record.url})`,
    );
    return;
  }
  console.log(
    `[tap-game] inserted game listing ${inserted.id} slug=${slug} ${verificationStatus} from ${uri}`,
  );
  await refreshSnapshotSafe(db, inserted.id);
}

/**
 * Refresh / re-point a row from a define record. Game-only rows also take the listing fields.
 *
 * No-op when nothing changed (Tap replays and backfill re-runs redeliver identical records). A
 * rejected game-only row whose record did change goes back to `unverified`, which lands it in the
 * admin queue's "Resubmitted after rejection" section with the prior reason — the developer's
 * equivalent of resubmitting an app listing.
 */
async function applyDefineToRow(
  db: Database,
  row: ListingRef,
  input: {
    did: string;
    rkey: string;
    uri: string;
    fields: ReturnType<typeof gameDefineToListingFields>;
    now: Date;
  },
) {
  const { did, rkey, uri, fields, now } = input;
  const t = schema.storeListings;
  if (!defineChangesRow(row, uri, fields)) return false;

  const resubmitted =
    isGameOnlyRow(row) && row.verificationStatus === "rejected";
  const base = {
    listingType: "game" as const,
    gameDefineAtUri: uri,
    gameDefinePriorAtUris: row.gameDefinePriorAtUris.filter((u) => u !== uri),
    gameDetails: fields.gameDetails,
    updatedAt: now,
  };

  if (isGameOnlyRow(row)) {
    await db
      .update(t)
      .set({
        ...base,
        name: fields.name,
        externalUrl: fields.externalUrl,
        iconUrl: fields.iconUrl,
        heroImageUrl: fields.heroImageUrl,
        screenshotUrls: fields.screenshotUrls,
        tagline: fields.tagline,
        fullDescription: fields.fullDescription,
        atUri: uri,
        repoDid: did,
        rkey,
        sourceAccountDid: did,
        productAccountDid: fields.gameDetails.developer?.did ?? null,
        ...(resubmitted ? { verificationStatus: "unverified" } : {}),
      })
      .where(eq(t.id, row.id));
    if (resubmitted) {
      console.log(
        `[tap-game] rejected game ${row.id} changed (${uri}) — back to the review queue`,
      );
    }
  } else {
    await db.update(t).set(base).where(eq(t.id, row.id));
  }
  await refreshSnapshotSafe(db, row.id);
  return true;
}

async function linkDefineToListing(
  db: Database,
  listingId: string,
  input: {
    uri: string;
    fields: ReturnType<typeof gameDefineToListingFields>;
    now: Date;
  },
) {
  const t = schema.storeListings;
  await db
    .update(t)
    .set({
      listingType: "game",
      gameDefineAtUri: input.uri,
      gameDetails: input.fields.gameDetails,
      updatedAt: input.now,
    })
    .where(and(eq(t.id, listingId), isNull(t.gameDefineAtUri)));
  await refreshSnapshotSafe(db, listingId);
}

/**
 * Define record deleted: game-only rows are removed (unless the URI is only a prior/superseded copy);
 * merged listings drop back to plain apps.
 */
export async function removeGameListingFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  const { db, did, rkey } = input;
  const uri = gameDefineAtUri(did, rkey);
  const t = schema.storeListings;

  const [row] = await db
    .select(listingRefColumns)
    .from(t)
    .where(eq(t.gameDefineAtUri, uri))
    .limit(1);
  if (!row) {
    // A superseded held copy being cleaned up — the row already points at the developer's record.
    console.log(`[tap-game] delete ${uri} — no row bound (ok)`);
    return;
  }

  if (isGameOnlyRow(row)) {
    /**
     * Keep rejected games: deleting the row would drop the rejection, and a re-published record
     * would come back as a fresh pending game. The row is already hidden.
     */
    if (row.verificationStatus === "rejected") {
      console.log(
        `[tap-game] delete ${uri} — keeping rejected game listing ${row.id}`,
      );
      return;
    }
    await db.delete(t).where(eq(t.id, row.id));
    console.log(`[tap-game] deleted game listing ${row.id} (${uri})`);
    return;
  }

  await db
    .update(t)
    .set({
      listingType: "app",
      gameDefineAtUri: null,
      gameDetails: null,
      gameDefinePriorAtUris: [...new Set([...row.gameDefinePriorAtUris, uri])],
      updatedAt: new Date(),
    })
    .where(eq(t.id, row.id));
  await refreshSnapshotSafe(db, row.id);
  console.log(`[tap-game] unlinked ${uri} from listing ${row.id}`);
}

/**
 * A `fyi.atstore.listing.detail` record declared `game` → make sure the define record is merged onto
 * that listing. If the define record already has its own game-only row, fold it in: move its reviews
 * and favorites over, then delete the game-only row.
 */
export async function linkListingToGameDefine(input: {
  db: Database;
  listingId: string;
  defineAtUri: string;
}) {
  const { db, listingId, defineAtUri } = input;
  const t = schema.storeListings;

  const [target] = await db
    .select(listingRefColumns)
    .from(t)
    .where(eq(t.id, listingId))
    .limit(1);
  if (!target || target.gameDefineAtUri === defineAtUri) return;

  const [gameRow] = await db
    .select(listingRefColumns)
    .from(t)
    .where(and(eq(t.gameDefineAtUri, defineAtUri), ne(t.id, listingId)))
    .limit(1);

  await db.transaction(async (tx) => {
    if (gameRow) {
      if (!isGameOnlyRow(gameRow)) {
        console.warn(
          `[tap-game] listing ${listingId} claims ${defineAtUri}, but it is merged onto listing ${gameRow.id}; skipping`,
        );
        return;
      }
      await moveListingActivity(tx, gameRow.id, listingId);
      await tx.delete(t).where(eq(t.id, gameRow.id));
    }
    await tx
      .update(t)
      .set({
        listingType: "game",
        gameDefineAtUri: defineAtUri,
        gameDefinePriorAtUris: [
          ...new Set([
            ...target.gameDefinePriorAtUris,
            ...(gameRow?.gameDefinePriorAtUris ?? []),
          ]),
        ].filter((u) => u !== defineAtUri),
        gameDetails: gameRow?.gameDetails ?? target.gameDetails,
        updatedAt: new Date(),
      })
      .where(eq(t.id, listingId));
  });

  await recomputeListingTrending(db, listingId);
  await refreshSnapshotSafe(db, listingId);
}

/** Re-home reviews + favorites (dedupe one review / favorite per author on the target). */
async function moveListingActivity(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  fromId: string,
  toId: string,
) {
  const reviews = schema.storeListingReviews;
  const replies = schema.storeListingReviewReplies;
  const favorites = schema.storeListingFavorites;

  for (const table of [reviews, favorites] as const) {
    const existingAuthors = await tx
      .select({ authorDid: table.authorDid })
      .from(table)
      .where(eq(table.storeListingId, toId));
    const authors = existingAuthors.map((r) => r.authorDid);
    if (authors.length > 0) {
      await tx
        .delete(table)
        .where(
          and(
            eq(table.storeListingId, fromId),
            inArray(table.authorDid, authors),
          ),
        );
    }
    await tx
      .update(table)
      .set({ storeListingId: toId })
      .where(eq(table.storeListingId, fromId));
  }
  await tx
    .update(replies)
    .set({ storeListingId: toId })
    .where(eq(replies.storeListingId, fromId));
}

// ---------------------------------------------------------------------------
// games.atmosphere.fave
// ---------------------------------------------------------------------------

const faveBodySchema = z.object({
  game: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("at://"), {
      message: "game must be an at:// URI",
    }),
  createdAt: z.string().min(1),
});

export type GamesAtmosphereFave = {
  $type: typeof GAMES_NSID.fave;
  game: string;
  createdAt: string;
};

export function tryParseGameFaveRecord(
  body: Record<string, unknown> | undefined,
): { ok: true; record: GamesAtmosphereFave } | { ok: false; reason: string } {
  if (!body) return { ok: false, reason: "record body is missing" };
  const parsed = faveBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }
  if (Number.isNaN(new Date(parsed.data.createdAt).getTime())) {
    return { ok: false, reason: "createdAt is not a valid datetime" };
  }
  return {
    ok: true,
    record: { $type: GAMES_NSID.fave, ...parsed.data },
  };
}

export function gameFaveAtUri(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.gameFave}/${rkey}`;
}

/** Upsert a `games.atmosphere.fave` into `store_listing_favorites`. */
export async function upsertGameFaveFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: GamesAtmosphereFave;
}) {
  const { db, did, rkey, record } = input;
  const atUri = gameFaveAtUri(did, rkey);

  const [listing] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(storeListingMatchesSubject(record.game))
    .limit(1);
  if (!listing) {
    console.warn(
      `[tap-game] skip fave — no store_listings row for game=${record.game} did=${did} rkey=${rkey}`,
    );
    return;
  }

  const favoriteCreatedAt = new Date(record.createdAt);
  const fav = schema.storeListingFavorites;
  await db
    .insert(fav)
    .values({
      storeListingId: listing.id,
      authorDid: did,
      rkey,
      atUri,
      favoriteCreatedAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: fav.atUri,
      set: {
        storeListingId: listing.id,
        favoriteCreatedAt,
        updatedAt: new Date(),
      },
    });

  await recomputeListingTrending(db, listing.id);
}

export async function deleteGameFaveFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  const fav = schema.storeListingFavorites;
  const deleted = await input.db
    .delete(fav)
    .where(eq(fav.atUri, gameFaveAtUri(input.did, input.rkey)))
    .returning({ storeListingId: fav.storeListingId });
  for (const row of deleted) {
    await recomputeListingTrending(input.db, row.storeListingId);
  }
}
