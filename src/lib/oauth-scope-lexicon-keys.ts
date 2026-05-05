import type { SummaryScopeHumanRow } from "./oauth-listing-auth-probe";

import {
  PERMISSION_GRANT_BACKEND_CALLS_LIST_LABEL,
  PERMISSION_GRANT_RECORDS_LIST_LABEL,
  isPermissionGrantUnorderedList,
} from "./oauth-permission-grant-ui";
import {
  parseIncludeScopeToken,
  parseRepoScopeForStorefront,
  parseRpcScopeForStorefront,
} from "./oauth-scope-include-parse";

/** Normalized key for `include:` / permission-set OAuth scopes. */
export const OAUTH_LEXICON_KEY_PREFIX_INCLUDE = "include:" as const;
/** Normalized key prefix for `repo` scope collection NSIDs. */
export const OAUTH_LEXICON_KEY_PREFIX_REPO = "repo:" as const;
/** Normalized key prefix for `rpc` scope `lxm` NSIDs. */
export const OAUTH_LEXICON_KEY_PREFIX_RPC = "rpc:" as const;

export type OAuthLexiconKeyKind = "include" | "repo" | "rpc";

/** NSID payload is only `*` — not a concrete lexicon id; omit from indexes and UI. */
export function isBareWildcardOAuthLexiconNsid(nsid: string): boolean {
  return nsid.trim() === "*";
}

function oauthLexiconKeyKindRank(
  kind: OAuthLexiconKeyKind | undefined,
): number {
  switch (kind) {
    case "include": {
      return 0;
    }
    case "repo": {
      return 1;
    }
    case "rpc": {
      return 2;
    }
    default: {
      return 3;
    }
  }
}

/**
 * Derives stable lexicon identifiers from OAuth scope tokens so listings can be
 * grouped by overlapping vocabulary (`require` / `include` bundles, repo collections, RPCs).
 */
export function extractLexiconKeysFromOAuthScopeTokens(
  tokens: ReadonlyArray<string>,
): Array<string> {
  const out = new Set<string>();
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;

    const inc = parseIncludeScopeToken(t);
    if (inc?.nsid?.trim()) {
      const n = inc.nsid.trim();
      if (!isBareWildcardOAuthLexiconNsid(n)) {
        out.add(`${OAUTH_LEXICON_KEY_PREFIX_INCLUDE}${n}`);
      }
      continue;
    }

    const repo = parseRepoScopeForStorefront(t);
    if (repo && repo.collectionsSorted.length > 0) {
      for (const nsid of repo.collectionsSorted) {
        const n = nsid.trim();
        if (n && !isBareWildcardOAuthLexiconNsid(n)) {
          out.add(`${OAUTH_LEXICON_KEY_PREFIX_REPO}${n}`);
        }
      }
      continue;
    }

    const rpc = parseRpcScopeForStorefront(t);
    if (rpc && rpc.lxmsSorted.length > 0) {
      for (const nsid of rpc.lxmsSorted) {
        const n = nsid.trim();
        if (n && !isBareWildcardOAuthLexiconNsid(n)) {
          out.add(`${OAUTH_LEXICON_KEY_PREFIX_RPC}${n}`);
        }
      }
    }
  }
  return [...out].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Repo collection + RPC method NSIDs declared inside **resolved** `include:` permission-set
 * checklists (not duplicated as top-level `repo:` / `rpc:` scope strings).
 */
export function extractLexiconKeysFromSummaryScopeHumanReadable(
  rows: ReadonlyArray<SummaryScopeHumanRow> | null | undefined,
): Array<string> {
  if (rows == null || rows.length === 0) {
    return [];
  }
  const out = new Set<string>();
  for (const row of rows) {
    if (!("includePermissionSet" in row)) continue;
    const pr = row.includePermissionSet;
    if (!pr.resolved) continue;

    for (const line of pr.structuredLines) {
      if (!isPermissionGrantUnorderedList(line)) continue;
      if (line.label === PERMISSION_GRANT_RECORDS_LIST_LABEL) {
        for (const item of line.items) {
          const n = item.trim();
          if (n && !isBareWildcardOAuthLexiconNsid(n)) {
            out.add(`${OAUTH_LEXICON_KEY_PREFIX_REPO}${n}`);
          }
        }
      } else if (line.label === PERMISSION_GRANT_BACKEND_CALLS_LIST_LABEL) {
        for (const item of line.items) {
          const n = item.trim();
          if (n && !isBareWildcardOAuthLexiconNsid(n)) {
            out.add(`${OAUTH_LEXICON_KEY_PREFIX_RPC}${n}`);
          }
        }
      }
    }
  }
  return [...out].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Full lexicon key set for storefront OAuth probe persistence: raw scope tokens plus
 * repo/RPC NSIDs from expanded permission-set bundles (e.g. `site.standard.document`
 * inside an `include:` checklist).
 */
export function extractOAuthLexiconKeysForStorefrontProbe(input: {
  oauthScopesDistinct: ReadonlyArray<string>;
  scopeHumanReadable?: ReadonlyArray<SummaryScopeHumanRow> | null;
}): Array<string> {
  const fromTokens = extractLexiconKeysFromOAuthScopeTokens(
    input.oauthScopesDistinct,
  );
  const fromBundles = extractLexiconKeysFromSummaryScopeHumanReadable(
    input.scopeHumanReadable,
  );
  return [...new Set([...fromTokens, ...fromBundles])].toSorted((a, b) =>
    a.localeCompare(b),
  );
}

export function parseOAuthLexiconKey(
  key: string,
): { kind: OAuthLexiconKeyKind; nsid: string } | null {
  const k = key.trim();
  if (k.startsWith(OAUTH_LEXICON_KEY_PREFIX_INCLUDE)) {
    const nsid = k.slice(OAUTH_LEXICON_KEY_PREFIX_INCLUDE.length).trim();
    return nsid ? { kind: "include", nsid } : null;
  }
  if (k.startsWith(OAUTH_LEXICON_KEY_PREFIX_REPO)) {
    const nsid = k.slice(OAUTH_LEXICON_KEY_PREFIX_REPO.length).trim();
    return nsid ? { kind: "repo", nsid } : null;
  }
  if (k.startsWith(OAUTH_LEXICON_KEY_PREFIX_RPC)) {
    const nsid = k.slice(OAUTH_LEXICON_KEY_PREFIX_RPC.length).trim();
    return nsid ? { kind: "rpc", nsid } : null;
  }
  return null;
}

/** NSIDs published by the Bluesky client (`app.bsky.*`) — noisy for cross-app matching. */
export function isAppBskyLexiconNsid(nsid: string): boolean {
  return nsid.trim().toLowerCase().startsWith("app.bsky.");
}

export function isAppBskyOAuthLexiconKey(key: string): boolean {
  const p = parseOAuthLexiconKey(key);
  return p != null && isAppBskyLexiconNsid(p.nsid);
}

/** Repo collection keys shown on `/apps/lexicons` and lexicon-set URLs (`repo:` only, not `include:` / `rpc:`). */
export function isRepoLexiconKeyForLexiconHub(key: string): boolean {
  const p = parseOAuthLexiconKey(key.trim());
  return (
    p != null && p.kind === "repo" && !isBareWildcardOAuthLexiconNsid(p.nsid)
  );
}

const LEXICON_CLUSTER_SEARCH_VERSION = 1 as const;

/** Normalize + dedupe cluster keys for hub + URL state (repo hub-eligible only). */
export function normalizeLexiconClusterKeysForHub(
  keys: ReadonlyArray<string>,
): Array<string> {
  const seen = new Set<string>();
  for (const raw of keys) {
    const k = raw.trim();
    if (isRepoLexiconKeyForLexiconHub(k)) seen.add(k);
  }
  return [...seen].toSorted(compareOAuthLexiconKeysForDisplayOrder);
}

/** JSON string for `LexiconSetRoute` search param `c` (router URL-encodes this value). */
export function stringifyLexiconClusterSearchParam(
  keys: ReadonlyArray<string>,
): string {
  const normalized = normalizeLexiconClusterKeysForHub(keys);
  if (normalized.length === 0) {
    throw new Error("stringifyLexiconClusterSearchParam: empty cluster");
  }
  return JSON.stringify({
    v: LEXICON_CLUSTER_SEARCH_VERSION,
    keys: normalized,
  });
}

/** Parse `c` from search; returns null if malformed or no valid hub keys. */
export function tryParseLexiconClusterSearchParam(
  raw: string | undefined,
): Array<string> | null {
  if (raw == null || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object") {
    return null;
  }
  const rec = parsed as { v?: unknown; keys?: unknown };
  if (rec.v !== LEXICON_CLUSTER_SEARCH_VERSION || !Array.isArray(rec.keys)) {
    return null;
  }
  const normalized = normalizeLexiconClusterKeysForHub(
    rec.keys.filter((x): x is string => typeof x === "string"),
  );
  return normalized.length > 0 ? normalized : null;
}

/**
 * Strips `app.bsky.*` keys unless the listing is the official Bluesky client
 * (`primaryCategorySlug === "apps/bluesky"`).
 */
export function filterLexiconKeysForCrossAppMatching(
  keys: ReadonlyArray<string>,
  options: { isBlueskyPlatformListing: boolean },
): Array<string> {
  const withoutWildcard = keys.filter((k) => {
    const p = parseOAuthLexiconKey(k);
    if (p == null) {
      return true;
    }
    return !isBareWildcardOAuthLexiconNsid(p.nsid);
  });
  if (options.isBlueskyPlatformListing) {
    return [...withoutWildcard];
  }
  return withoutWildcard.filter((k) => !isAppBskyOAuthLexiconKey(k));
}

export function oauthLexiconKeyKindLabel(kind: OAuthLexiconKeyKind): string {
  switch (kind) {
    case "include": {
      return "Permission set";
    }
    case "repo": {
      return "Repo records";
    }
    case "rpc": {
      return "RPC";
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Short title from an NSID: last segment only, camelCase / underscores split into Title Case
 * (`at.margin.someThing` → `Some Thing`, `site.standard.document` → `Document`).
 */
export function formatLexiconNsidRecordTitle(nsid: string): string {
  const segs = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = segs.at(-1);
  if (!last) {
    return nsid.trim();
  }
  const spaced = last
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return last;
  }
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatLexiconNsidSegmentLabel(segment: string): string {
  const s = segment.trim();
  if (!s) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Shared lexicon cluster page: reversed first-two NSID segments with a dot, then the record name
 * (`site.standard.document` → `Standard.Site Document`). Two-segment NSIDs → `Atstore.Fyi` only.
 */
export function formatOAuthLexiconKeyClusterStyleHeadline(key: string): string {
  const parsed = parseOAuthLexiconKey(key);
  if (!parsed?.nsid) {
    return key;
  }
  const nsid = parsed.nsid;
  const segs = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) {
    return formatLexiconNsidRecordTitle(nsid);
  }
  // oxlint-disable-next-line typescript/no-non-null-assertion
  const producerDot = `${formatLexiconNsidSegmentLabel(segs[1]!)}.${formatLexiconNsidSegmentLabel(segs[0]!)}`;
  if (segs.length === 2) {
    return producerDot;
  }
  return `${producerDot} ${formatLexiconNsidRecordTitle(nsid)}`;
}

/** Hero / OG title line for a cluster (joins multiple keys with ` · `, truncates with `+N`). */
export function formatLexiconClusterPageTitle(
  keys: ReadonlyArray<string>,
): string {
  if (keys.length === 0) {
    return "Lexicon cluster";
  }
  const labels = keys.map((k) => formatOAuthLexiconKeyClusterStyleHeadline(k));
  return labels.length <= 2
    ? labels.join(" · ")
    : `${labels.slice(0, 2).join(" · ")} +${String(labels.length - 2)}`;
}

/** Human label for hub cards and detail page titles (record name only, not full NSID). */
export function formatOAuthLexiconKeyHeadline(key: string): string {
  const parsed = parseOAuthLexiconKey(key);
  if (parsed?.nsid) {
    return formatLexiconNsidRecordTitle(parsed.nsid);
  }
  return key;
}

export function compareOAuthLexiconKeysForDisplayOrder(
  a: string,
  b: string,
): number {
  const ra = oauthLexiconKeyKindRank(parseOAuthLexiconKey(a)?.kind);
  const rb = oauthLexiconKeyKindRank(parseOAuthLexiconKey(b)?.kind);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/**
 * Prefer an `include:` permission-set key for “compatible apps” deep links when possible.
 */
export function pickPrimaryOAuthLexiconBrowseKey(
  keys: ReadonlyArray<string>,
): string | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].toSorted(compareOAuthLexiconKeysForDisplayOrder);
  return sorted[0] ?? null;
}

export function buildAppsLexiconBrowseHref(key: string): string {
  const q = new URLSearchParams();
  q.set("key", key);
  q.set("sort", "popular");
  return `/apps/lexicon?${q.toString()}`;
}
