import type { DirectoryOAuthLexiconClusterSummary } from "../../../lib/oauth-lexicon-hub.types";

import { getLexiconProducerSiteFromRepoNsid } from "../../../lib/lexicon-producer-site";
import {
  compareOAuthLexiconKeysForDisplayOrder,
  formatOAuthLexiconKeyHeadline,
  parseOAuthLexiconKey,
} from "../../../lib/oauth-scope-lexicon-keys";

const OTHER_GROUP_KEY = "zz-other";

/** Producers used by at least this many apps get a full section; the rest share a compact list. */
export const DATA_PRODUCER_SECTION_MIN_APPS = 7;

/** Data-type cards shown per producer before "N more data types". */
export const DATA_TYPES_PER_SECTION = 6;

export interface DataProducer {
  /** First two NSID segments, e.g. `app.bsky`; also the `/apps?data=` filter value. */
  groupKey: string;
  /** Public host for the producer, e.g. `bsky.app`. Empty for the catch-all group. */
  siteLabel: string;
  siteOrigin: string;
  clusters: Array<DirectoryOAuthLexiconClusterSummary>;
  /** Distinct apps across every cluster in the group. */
  appCount: number;
}

export function isOtherDataProducer(producer: DataProducer) {
  return producer.groupKey === OTHER_GROUP_KEY;
}

function clusterProducer(cluster: DirectoryOAuthLexiconClusterSummary) {
  const sites = cluster.keys
    .map((key) => {
      const parsed = parseOAuthLexiconKey(key);
      if (!parsed || parsed.kind !== "repo") return null;
      return getLexiconProducerSiteFromRepoNsid(parsed.nsid);
    })
    .filter((site) => site != null);
  if (sites.length === 0) {
    return { groupKey: OTHER_GROUP_KEY, siteLabel: "Other", siteOrigin: "" };
  }
  return sites.toSorted((a, b) => a.groupKey.localeCompare(b.groupKey))[0];
}

/**
 * Buckets hub clusters by the site that defines them (`app.bsky`, `site.standard`, …),
 * most-used producers first, and each producer's clusters by app count.
 */
export function groupClustersByProducer(
  clusters: Array<DirectoryOAuthLexiconClusterSummary>,
): Array<DataProducer> {
  const buckets = new Map<string, Omit<DataProducer, "appCount">>();
  for (const cluster of clusters) {
    const site = clusterProducer(cluster);
    let bucket = buckets.get(site.groupKey);
    if (!bucket) {
      bucket = { ...site, clusters: [] };
      buckets.set(site.groupKey, bucket);
    }
    bucket.clusters.push(cluster);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      clusters: bucket.clusters.toSorted(
        (a, b) =>
          b.appCount - a.appCount ||
          compareOAuthLexiconKeysForDisplayOrder(
            a.keys[0] ?? "",
            b.keys[0] ?? "",
          ),
      ),
      appCount: new Set(bucket.clusters.flatMap((c) => c.listingIds)).size,
    }))
    .toSorted(
      (a, b) => b.appCount - a.appCount || a.groupKey.localeCompare(b.groupKey),
    );
}

/** Record NSID for a hub key (`repo:app.bsky.feed.post` → `app.bsky.feed.post`). */
export function getDataKeyNsid(key: string) {
  return parseOAuthLexiconKey(key)?.nsid ?? key;
}

/** Host of the site that defines a key's data (`repo:app.bsky.feed.post` → `bsky.app`). */
export function getDataKeySiteLabel(key: string) {
  const parsed = parseOAuthLexiconKey(key);
  if (!parsed || parsed.kind !== "repo") return null;
  return getLexiconProducerSiteFromRepoNsid(parsed.nsid)?.siteLabel ?? null;
}

/** "Data type · bsky.app" when every key comes from the same site. */
export function formatDataTypeEyebrow(
  kind: string,
  keys: ReadonlyArray<string>,
) {
  const sites = new Set(keys.map((key) => getDataKeySiteLabel(key)));
  const [site] = sites;
  return sites.size === 1 && site ? `${kind} · ${site}` : kind;
}

/** "Post", or "Profile, Post, Follow", or "Message, Key, Livestream +4". */
export function formatDataTypeTitle(keys: ReadonlyArray<string>, max = 3) {
  const names = keys.map((key) => formatOAuthLexiconKeyHeadline(key));
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/** First hand-written lexicon description among a cluster's keys. */
export function getDataTypeDescription(
  keys: ReadonlyArray<string>,
  descriptionsByRepoNsid: Record<string, string>,
) {
  for (const key of keys) {
    const description = descriptionsByRepoNsid[getDataKeyNsid(key)]?.trim();
    if (description) return description;
  }
  return null;
}

export function formatAppCount(count: number) {
  return `${count} ${count === 1 ? "app" : "apps"}`;
}

export function formatDataTypeCount(count: number) {
  return `${count} ${count === 1 ? "data type" : "data types"}`;
}
