#!/usr/bin/env node
/**
 * atmosphere.games backfill: finds every repo publishing `games.atmosphere.define` /
 * `games.atmosphere.fave` via the relay's `com.atproto.sync.listReposByCollection`, then
 * `listRecords` on each repo's PDS and upserts through the same code paths as the Tap consumer
 * (`tap-game-sync.ts`). Defines run before faves so faves can resolve their game.
 *
 * New game-only listings land as `unverified` (admin pending queue) unless the repo is in
 * `TAP_TRUSTED_DIDS`.
 *
 * Usage:
 *   pnpm games:backfill-atmosphere              # write to DATABASE_URL
 *   pnpm games:backfill-atmosphere --dry-run    # crawl + parse only, no DB
 *
 * Env:
 *   DATABASE_URL=…                 # required unless --dry-run
 *   GAMES_BACKFILL_RELAY=https://relay1.us-east.bsky.network
 *   TAP_TRUSTED_DIDS=did:plc:…     # optional; same meaning as the Tap consumer
 */
import "dotenv/config";
import { tryParseGameDefineRecord } from "#/lib/atproto/game-define-record";
import {
  paginateListRecords,
  rkeyFromCollectionAtUri,
} from "#/lib/atproto/list-records";
import { COLLECTION } from "#/lib/atproto/nsids";
import { resolveAtprotoPdsBaseUrl } from "#/lib/atproto/resolve-atproto-pds";
import {
  tryParseGameFaveRecord,
  upsertGameFaveFromTap,
  upsertGameListingFromTap,
} from "#/lib/atproto/tap-game-sync";

import type { Database } from "../src/db/index.server";

const LOG = "[games-backfill]";

async function listReposByCollection(
  relay: string,
  collection: string,
): Promise<Array<string>> {
  const dids: Array<string> = [];
  let cursor: string | undefined;
  do {
    const url = new URL("/xrpc/com.atproto.sync.listReposByCollection", relay);
    url.searchParams.set("collection", collection);
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `listReposByCollection ${collection} failed: ${res.status} ${await res.text()}`,
      );
    }
    const data = (await res.json()) as {
      repos?: Array<{ did: string }>;
      cursor?: string;
    };
    for (const r of data.repos ?? []) dids.push(r.did);
    cursor = data.repos?.length ? data.cursor : undefined;
  } while (cursor);
  return [...new Set(dids)];
}

async function forEachRecord(
  did: string,
  collection: string,
  fn: (rkey: string, body: Record<string, unknown>) => Promise<void>,
) {
  const pds = await resolveAtprotoPdsBaseUrl(did);
  if (!pds) {
    console.warn(`${LOG} no PDS for ${did}; skip ${collection}`);
    return;
  }
  for await (const row of paginateListRecords(pds, did, collection)) {
    const body = row.value as Record<string, unknown> | null | undefined;
    if (!body || typeof body !== "object") continue;
    const rkey = rkeyFromCollectionAtUri(row.uri, collection);
    if (!rkey) continue;
    await fn(rkey, body);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const relay =
    process.env.GAMES_BACKFILL_RELAY?.trim() ||
    "https://relay1.us-east.bsky.network";
  const trusted = new Set(
    (process.env.TAP_TRUSTED_DIDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  let db: Database | undefined;
  if (!dryRun) {
    if (!process.env.DATABASE_URL?.trim()) {
      console.error(`${LOG} DATABASE_URL is required (or pass --dry-run)`);
      process.exit(1);
    }
    const mod = await import("../src/db/index.server");
    db = mod.db;
  }

  const defineRepos = await listReposByCollection(relay, COLLECTION.gameDefine);
  console.log(`${LOG} ${defineRepos.length} repo(s) publish game definitions`);

  let games = 0;
  let skipped = 0;
  let failed = 0;
  for (const did of defineRepos) {
    try {
      await forEachRecord(did, COLLECTION.gameDefine, async (rkey, body) => {
        const parsed = tryParseGameDefineRecord(body);
        if (!parsed.ok) {
          skipped++;
          console.warn(`${LOG} skip define ${did}/${rkey}: ${parsed.reason}`);
          return;
        }
        games++;
        if (!db) {
          console.log(
            `${LOG} [dry-run] ${parsed.record.name} — ${parsed.record.url} (${did}/${rkey})`,
          );
          return;
        }
        await upsertGameListingFromTap({
          db,
          did,
          rkey,
          record: parsed.record,
          trustedPublisher: trusted.has(did),
        });
      });
    } catch (error) {
      failed++;
      console.warn(`${LOG} define crawl failed for ${did}`, error);
    }
  }
  console.log(
    `${LOG} definitions: ${games} ok, ${skipped} unparseable, ${failed} repo(s) failed`,
  );

  const faveRepos = await listReposByCollection(relay, COLLECTION.gameFave);
  console.log(`${LOG} ${faveRepos.length} repo(s) publish game favorites`);
  let faves = 0;
  for (const did of faveRepos) {
    try {
      await forEachRecord(did, COLLECTION.gameFave, async (rkey, body) => {
        const parsed = tryParseGameFaveRecord(body);
        if (!parsed.ok) return;
        faves++;
        if (!db) return;
        await upsertGameFaveFromTap({ db, did, rkey, record: parsed.record });
      });
    } catch (error) {
      console.warn(`${LOG} fave crawl failed for ${did}`, error);
    }
  }
  console.log(`${LOG} favorites: ${faves} processed`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`${LOG} failed`, error);
  process.exit(1);
});
