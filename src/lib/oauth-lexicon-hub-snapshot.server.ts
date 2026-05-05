import type { Database } from "#/db/index.server";
import * as dbSchema from "#/db/schema";
import { loadLexiconRecordDescriptionsForWorkspace } from "#/lib/lexicon-local-record-description";
import type {
  DirectoryOAuthLexiconClusterSummary,
  DirectoryOAuthLexiconHubData,
} from "#/lib/oauth-lexicon-hub.types";
import {
  compareOAuthLexiconKeysForDisplayOrder,
  isRepoLexiconKeyForLexiconHub,
  parseOAuthLexiconKey,
} from "#/lib/oauth-scope-lexicon-keys";
import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const HUB_SNAPSHOT_KEY = "default" as const;

function sqlCategorySlugsMatchesLike(col: AnyPgColumn, pattern: string) {
  return sql<boolean>`exists (
    select 1 from unnest(${col}) as u(slug) where trim(both from u.slug::text) like ${pattern}
  )`;
}

/**
 * Builds `/apps/lexicons` payload from current DB rows (slow: fetches lexicon descriptions remotely).
 */
export async function computeOAuthLexiconHubData(
  db: Database,
): Promise<DirectoryOAuthLexiconHubData> {
  const list = dbSchema.storeListings;
  const probe = dbSchema.storeListingOAuthProbes;

  const rows = await db
    .select({ id: list.id, keys: probe.oauthLexiconKeys })
    .from(list)
    .innerJoin(probe, eq(probe.storeListingId, list.id))
    .where(
      and(
        eq(list.verificationStatus, "verified"),
        sqlCategorySlugsMatchesLike(list.categorySlugs, "apps/%"),
        sql`cardinality(${probe.oauthLexiconKeys}) > 0`,
      ),
    );

  const keyToListings = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const k of row.keys) {
      if (!isRepoLexiconKeyForLexiconHub(k)) continue;
      let set = keyToListings.get(k);
      if (!set) {
        set = new Set();
        keyToListings.set(k, set);
      }
      set.add(row.id);
    }
  }

  const clusterMap = new Map<
    string,
    { keys: Array<string>; appCount: number; listingIds: Array<string> }
  >();
  for (const [key, listingSet] of keyToListings) {
    if (listingSet.size < 2) continue;
    const sig = [...listingSet].toSorted().join("\u001F");
    let entry = clusterMap.get(sig);
    if (!entry) {
      entry = {
        keys: [],
        appCount: listingSet.size,
        listingIds: [...listingSet].toSorted(),
      };
      clusterMap.set(sig, entry);
    }
    entry.keys.push(key);
  }

  const clustersUnsorted = [...clusterMap.values()].map(
    (row): DirectoryOAuthLexiconClusterSummary => ({
      keys: row.keys.toSorted(compareOAuthLexiconKeysForDisplayOrder),
      appCount: row.appCount,
      listingIds: row.listingIds,
    }),
  );

  const clusters = clustersUnsorted.toSorted((a, b) => {
    if (b.appCount !== a.appCount) return b.appCount - a.appCount;
    const ak = a.keys[0] ?? "";
    const bk = b.keys[0] ?? "";
    return compareOAuthLexiconKeysForDisplayOrder(ak, bk);
  });

  const repoNsids = new Set<string>();
  for (const c of clusters) {
    for (const k of c.keys) {
      const p = parseOAuthLexiconKey(k);
      if (p?.kind === "repo" && p.nsid) {
        repoNsids.add(p.nsid);
      }
    }
  }
  const descriptionsByRepoNsid =
    await loadLexiconRecordDescriptionsForWorkspace([...repoNsids]);

  return {
    clusters,
    descriptionsByRepoNsid,
  };
}

export async function getOAuthLexiconHubSnapshot(
  db: Database,
): Promise<DirectoryOAuthLexiconHubData | null> {
  const snap = dbSchema.oauthLexiconHubSnapshot;
  const [row] = await db
    .select({ payload: snap.payload })
    .from(snap)
    .where(eq(snap.singletonKey, HUB_SNAPSHOT_KEY))
    .limit(1);
  return row?.payload ?? null;
}

export async function refreshOAuthLexiconHubSnapshot(db: Database): Promise<{
  clusterCount: number;
  computedAt: Date;
}> {
  const payload = await computeOAuthLexiconHubData(db);
  const snap = dbSchema.oauthLexiconHubSnapshot;
  const computedAt = new Date();
  await db
    .insert(snap)
    .values({
      singletonKey: HUB_SNAPSHOT_KEY,
      payload,
      computedAt,
    })
    .onConflictDoUpdate({
      target: snap.singletonKey,
      set: { payload, computedAt },
    });
  return { clusterCount: payload.clusters.length, computedAt };
}
