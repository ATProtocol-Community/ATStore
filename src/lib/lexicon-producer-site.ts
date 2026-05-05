/**
 * Map repo record NSIDs to a producer grouping key and a **two-label** public host for URLs
 * (first two NSID segments reversed: `site.standard.document` → `https://standard.site`,
 * `app.bsky.actor.profile` → `https://bsky.app`). Subdomain-style hosts from reversing the
 * full authority are avoided. `groupKey` is the first two NSID segments for bucketing.
 */
export function getLexiconProducerSiteFromRepoNsid(nsid: string): {
  /** First two NSID segments, e.g. `site.standard` or `app.bsky` — sort / dedupe / section key */
  groupKey: string;
  /** Public site host from the first two NSID segments only, e.g. `standard.site` */
  siteLabel: string;
  /** `https://` + `siteLabel` */
  siteOrigin: string;
} | null {
  const parts = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const groupKey = parts.slice(0, 2).join(".").toLowerCase();

  const hostPieces = parts.slice(0, 2).map((s) => s.toLowerCase());
  const siteLabel = [...hostPieces].toReversed().join(".");
  const siteOrigin = `https://${siteLabel}`;

  return { groupKey, siteLabel, siteOrigin };
}
