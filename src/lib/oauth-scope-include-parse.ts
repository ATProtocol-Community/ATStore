/**
 * Parses `include?nsid=…` / `include?nsid=…&aud=…`, shorthand `include:permission-set-id`,
 * or `include:permission-set-id?aud=…` (query suffix on colon form).
 *
 * `permission-set-id` is commonly a dotted bundle id ending in camelCase, e.g.
 * `app.bsky.authCreatePosts`.
 *
 * Keeps browser/client bundles independent of OAuth probe code that uses Node `fs`.
 */

/**
 * Resource key for an AT Proto-ish scope token (`repo`, `blob`, `rpc`, …).
 * Treats `repo?collection=…` and `repo:NSID` alike (both `repo`).
 * Matches `splitAtprotoPermissionScopeParts` in `#/lib/oauth-listing-auth-probe`.
 */
export function atprotoPermissionScopeResource(token: string): string {
  const trimmed = token.trim();
  const qIdx = trimmed.indexOf("?");
  const beforeParams = qIdx === -1 ? trimmed : trimmed.slice(0, qIdx);
  const colonIdx = beforeParams.indexOf(":");
  if (colonIdx === -1) {
    return beforeParams.trim().toLowerCase();
  }
  return beforeParams.slice(0, colonIdx).trim().toLowerCase();
}

/** Max collection NSIDs rendered per repo scope row (+N more). */
const REPO_SCOPE_COLLECTION_LIST_UI_CAP = 48;

const REPO_VERB_SORT_ORDER: ReadonlyArray<string> = [
  "create",
  "read",
  "update",
  "delete",
];

function sortDistinctRepoPermissionVerbs(
  verbs: ReadonlyArray<string>,
): Array<string> {
  const unique = [
    ...new Set(verbs.map((v) => v.trim().toLowerCase()).filter(Boolean)),
  ];
  return unique.toSorted((a, b) => {
    const ia = REPO_VERB_SORT_ORDER.indexOf(a);
    const ib = REPO_VERB_SORT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** Low-level `repo` token split (positional NSID vs repeated `collection` / `action`). */
export function splitRepoPermissionScopeSegments(token: string): {
  positional: string | null;
  params: URLSearchParams;
} | null {
  if (atprotoPermissionScopeResource(token) !== "repo") {
    return null;
  }

  const trimmed = token.trim();
  const qIdx = trimmed.indexOf("?");
  const beforeParams = qIdx === -1 ? trimmed : trimmed.slice(0, qIdx);
  const qs = qIdx === -1 ? "" : trimmed.slice(qIdx + 1);
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(qs);
  } catch {
    params = new URLSearchParams();
  }

  const colonIdx = beforeParams.indexOf(":");
  const positionalRaw =
    colonIdx === -1 ? null : beforeParams.slice(colonIdx + 1).trim();
  const positional =
    positionalRaw !== null && positionalRaw.length > 0 ? positionalRaw : null;

  return { positional, params };
}

export interface RepoScopeParsedForUi {
  /** Lex-sorted lexicon NSIDs narrowing this `repo` grant */
  readonly collectionsSorted: ReadonlyArray<string>;
  readonly explicitActionsSorted: ReadonlyArray<string>;
  /** When false, publishers imply full record CRUD wherever collections appear */
  readonly hasExplicitActions: boolean;
}

/** Structured repo scope rows for storefront consent copy */
export function parseRepoScopeForStorefront(
  token: string,
): RepoScopeParsedForUi | null {
  const qp = splitRepoPermissionScopeSegments(token);
  if (qp === null) return null;

  const { positional, params: sp } = qp;

  const fromQueryCols = sp.getAll("collection");
  const cols =
    positional === null
      ? fromQueryCols.length > 0
        ? fromQueryCols
        : []
      : [positional];

  const collectionsSorted = [
    ...new Set(cols.map((c) => c.trim()).filter(Boolean)),
  ].toSorted((a, b) => a.localeCompare(b));

  const actionTokensRaw = sp.getAll("action");
  const actionTokens = actionTokensRaw
    .flatMap((a) =>
      typeof a === "string" ? a.split(/\s*,\s*/) : ([] as Array<string>),
    )
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const hasExplicitActions = actionTokens.length > 0;
  const explicitActionsSorted = hasExplicitActions
    ? sortDistinctRepoPermissionVerbs(actionTokens)
    : [];

  return {
    collectionsSorted,
    explicitActionsSorted,
    hasExplicitActions,
  };
}

export interface RepoCollectionConsentLine {
  readonly nsid: string;
  /** Suffix like `Allows · create` when narrowed; omitted if any scope implied full CRUD for this nsid */
  readonly verbPhrase: string | null;
}

type RepoCollectionAccum = {
  impliedFull: boolean;
  explicitVerbs: Set<string>;
};

/**
 * Merges several `repo` scope strings into one sorted list of collection NSIDs.
 * Verbs from `action=` apply only to collections named in the same token; implied
 * CRUD (no `action=`) is recorded per collection and suppresses a restrictive suffix.
 */
export function mergeRepoScopesIntoCollectionConsentLines(
  scopeTokens: ReadonlyArray<string>,
): Array<RepoCollectionConsentLine> {
  const byCol = new Map<string, RepoCollectionAccum>();

  const touch = (nsid: string): RepoCollectionAccum => {
    let a = byCol.get(nsid);
    if (!a) {
      a = { impliedFull: false, explicitVerbs: new Set() };
      byCol.set(nsid, a);
    }
    return a;
  };

  for (const raw of scopeTokens) {
    const t = raw.trim();
    if (!t) continue;
    const p = parseRepoScopeForStorefront(t);
    if (p === null || p.collectionsSorted.length === 0) continue;

    const impliedThisToken = !p.hasExplicitActions;

    for (const c of p.collectionsSorted) {
      const nsid = c.trim();
      if (!nsid) continue;
      const acc = touch(nsid);
      if (impliedThisToken) {
        acc.impliedFull = true;
      } else {
        for (const v of p.explicitActionsSorted) {
          acc.explicitVerbs.add(v);
        }
      }
    }
  }

  const lines: Array<RepoCollectionConsentLine> = [];
  for (const nsid of [...byCol.keys()].toSorted((a, b) => a.localeCompare(b))) {
    const acc = byCol.get(nsid);
    if (!acc) continue;
    let verbPhrase: string | null = null;
    if (!acc.impliedFull && acc.explicitVerbs.size > 0) {
      const sorted = sortDistinctRepoPermissionVerbs([...acc.explicitVerbs]);
      if (sorted.length > 0) {
        verbPhrase = `Allows · ${sorted.join(" · ")}`;
      }
    }
    lines.push({ nsid, verbPhrase });
  }
  return lines;
}

export function capRepoCollectionConsentLinesForUi(
  lines: ReadonlyArray<RepoCollectionConsentLine>,
): {
  readonly items: ReadonlyArray<RepoCollectionConsentLine>;
  readonly moreCount: number;
} {
  if (lines.length <= REPO_SCOPE_COLLECTION_LIST_UI_CAP) {
    return { items: lines, moreCount: 0 };
  }
  return {
    items: lines.slice(0, REPO_SCOPE_COLLECTION_LIST_UI_CAP),
    moreCount: lines.length - REPO_SCOPE_COLLECTION_LIST_UI_CAP,
  };
}

function decodeUriComponentSafely(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parseIncludeScopeToken(
  token: string,
): { aud: string | null; nsid: string } | null {
  const t = token.trim();

  const qIdx = t.indexOf("?");
  const beforeQuery = qIdx === -1 ? t : t.slice(0, qIdx);
  const qs = qIdx === -1 ? "" : t.slice(qIdx + 1);
  const sp = new URLSearchParams(qs);

  if (beforeQuery.toLowerCase() === "include" && qIdx !== -1) {
    const rawNsid = sp.get("nsid");
    if (!rawNsid?.trim()) return null;
    let nsid: string;
    try {
      nsid = decodeURIComponent(rawNsid.trim());
    } catch {
      nsid = rawNsid.trim();
    }
    nsid = nsid.trim();
    if (!nsid) return null;
    const audRaw = sp.get("aud");
    return {
      nsid,
      aud: audRaw?.trim()
        ? decodeUriComponentSafely(audRaw.trim()).trim()
        : null,
    };
  }

  const colonMatch = /^include:(?<rest>.+)$/iu.exec(beforeQuery);
  if (!colonMatch?.groups?.rest) return null;

  let nsid = colonMatch.groups.rest.trim();
  if (!nsid) return null;
  try {
    nsid = decodeURIComponent(nsid);
  } catch {
    /* leave as opaque */
  }
  nsid = nsid.trim();
  if (!nsid) return null;

  const audRaw = sp.get("aud");
  return {
    nsid,
    aud: audRaw?.trim() ? decodeUriComponentSafely(audRaw.trim()).trim() : null,
  };
}
