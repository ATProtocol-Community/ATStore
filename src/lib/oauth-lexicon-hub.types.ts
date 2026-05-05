/**
 * Hub row for /apps/lexicons — a cluster of repo collection NSIDs that appear
 * on exactly the same set of listings (≥2 apps). `include:` and `rpc:` are omitted.
 */
export interface DirectoryOAuthLexiconClusterSummary {
  keys: Array<string>;
  /** Number of app listings in this cluster (same for every key in `keys`). */
  appCount: number;
  /**
   * Store listing IDs in this cluster — the same sorted set for every key in `keys`
   * (used to dedupe apps across clusters when grouping by lexicon producer).
   */
  listingIds: Array<string>;
}

/** Hub payload for `/apps/lexicons` — clusters plus optional local lexicon descriptions. */
export interface DirectoryOAuthLexiconHubData {
  clusters: Array<DirectoryOAuthLexiconClusterSummary>;
  /** Repo NSID (no `repo:` prefix) -> `defs.main.description` when present under `lexicons/`. */
  descriptionsByRepoNsid: Record<string, string>;
}
