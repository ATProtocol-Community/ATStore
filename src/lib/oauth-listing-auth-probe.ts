/**
 * AT Protocol OAuth / permission discovery for storefront listing URLs (`external_url`).
 *
 * Implements RFC 9728 Protected Resource Metadata, RFC 8414 Authorization Server Metadata,
 * client-metadata probes, and `include` permission-set shorthand (`include:ns.id.bundle` or `include?nsid=…`) expansion.
 *
 * Permission-set lexicons are resolved per https://atproto.com/specs/lexicon (`_lexicon.*` DNS TXT → publishing DID →
 * `com.atproto.repo.getRecord`) when `{origin}/lexicons/...` guesses miss.
 *
 * @see https://github.com/ATProtocol-Community/ATStore/issues/19
 */
import { isOAuthScope } from "@atcute/oauth-types";
import { resolveTxt } from "node:dns/promises";
import { access, constants, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { parseIncludeScopeToken } from "./oauth-scope-include-parse";

const FETCH_TIMEOUT_MS = 15_000;
const LEXICON_DNS_TIMEOUT_MS = 5 * 1000;
const LEXICON_SCHEMA_COLLECTION = "com.atproto.lexicon.schema";

const PLC_DIRECTORY_ORIGIN = "https://plc.directory";
const UA =
  "at-store-oauth-scope-probe/1.0 (+https://github.com/ATProtocol-Community/ATStore)";

type JsonRecord = Record<string, unknown>;

type AttemptResult<T> =
  | { ok: true; url: string; data: T }
  | { ok: false; url: string; status?: number; error: string };

export function normalizeOAuthProbeHref(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (!/^https?:\/\//i.test(t)) {
    return `https://${t}`;
  }
  return t;
}

/**
 * RFC 9728 §5: metadata URL inserts `/.well-known/oauth-protected-resource` between the origin
 * and the path component of the protected resource identifier.
 */
function protectedResourceMetadataUrlCandidates(
  resourceHref: string,
): Array<string> {
  const u = new URL(resourceHref);
  const path = u.pathname.replace(/\/+$/, "") || "";
  const origin = u.origin;

  const out: Array<string> = [];
  const withPath =
    path.length > 0
      ? `${origin}/.well-known/oauth-protected-resource${path}`
      : `${origin}/.well-known/oauth-protected-resource`;
  out.push(withPath);
  if (path.length > 0) {
    out.push(`${origin}/.well-known/oauth-protected-resource`);
  }
  return [...new Set(out)];
}

function authorizationServerMetadataUrl(issuer: string): string {
  const trimmed = issuer.replace(/\/+$/, "");
  const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  const origin = u.origin;
  return `${origin}/.well-known/oauth-authorization-server`;
}

const CLIENT_METADATA_PATHS = [
  "/.well-known/oauth-client-metadata.json",
  /** Some stacks use this shorter well-known path (same role as oauth-client-metadata). */
  "/.well-known/client-metadata.json",
  /** ATProto / XRPC apps: OAuth `client_id` is often `{origin}/client-metadata.json`. */
  "/client-metadata.json",
  "/api/auth/atproto/metadata.json",
  "/oauth-client-metadata.json",
  "/oauth/client-metadata.json",
  "/api/oauth/client-metadata.json",
  "/oauth-client.json",
];

function clientMetadataCandidates(originHref: string): Array<string> {
  const origin = new URL(originHref).origin;
  return CLIENT_METADATA_PATHS.map((p) => `${origin}${p}`);
}

async function fetchJson(url: string): Promise<AttemptResult<JsonRecord>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
      },
    });
    if (!res.ok) {
      return {
        ok: false,
        url,
        status: res.status,
        error: `HTTP ${String(res.status)}`,
      };
    }
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, url, status: res.status, error: "invalid JSON body" };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        url,
        status: res.status,
        error: "JSON is not an object",
      };
    }
    return { ok: true, url, data: parsed as JsonRecord };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, url, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds `_lexicon.{reversedAuthority}` hostname for NSID `{authority}.{bundleName}` — see lexicon DNS publication.
 */
function lexiconDnsQueryName(nsid: string): string | null {
  const segs = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) return null;
  const authority = segs.slice(0, -1);
  const reversed = [...authority].toReversed().join(".");
  return `_lexicon.${reversed}`;
}

function parsePublishingDidFromLexiconTxt(
  txtEntries: ReadonlyArray<ReadonlyArray<string>>,
): string | null {
  for (const chunks of txtEntries) {
    const s = chunks.join("").trim();
    const didMatch = /^did\s*=\s*(did:[^\s]+)/iu.exec(s);
    const didVal = didMatch?.[1]?.trim();
    if (didVal) return didVal;
  }
  return null;
}

async function resolvePublishingDidViaLexiconDns(
  dnsName: string,
): Promise<string | null> {
  try {
    const entries = await Promise.race([
      resolveTxt(dnsName),
      new Promise<Array<Array<string>>>((_, rej) =>
        setTimeout(() => rej(new Error("DNS timeout")), LEXICON_DNS_TIMEOUT_MS),
      ),
    ]);
    return parsePublishingDidFromLexiconTxt(entries);
  } catch {
    return null;
  }
}

function didDocumentPdsOrigin(doc: JsonRecord): string | null {
  const services = doc.service;
  if (!Array.isArray(services)) return null;
  for (const ent of services) {
    if (!ent || typeof ent !== "object" || Array.isArray(ent)) continue;
    const rec = ent as JsonRecord;
    if (rec.type !== "AtprotoPersonalDataServer") continue;
    const ep = rec.serviceEndpoint;
    if (typeof ep !== "string" || !ep.trim()) continue;
    try {
      return new URL(ep.trim()).origin;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolvePlcDidToPdsOrigin(did: string): Promise<string | null> {
  if (!did.startsWith("did:plc:")) return null;
  const url = `${PLC_DIRECTORY_ORIGIN}/${encodeURIComponent(did)}`;
  const res = await fetchJson(url);
  if (!res.ok) return null;
  return didDocumentPdsOrigin(res.data);
}

/**
 * Resolved permission-set document from authoritative lexicon repo (`com.atproto.lexicon.schema` record keyed by NSID).
 */
async function fetchPermissionSetViaLexiconRegistry(
  nsid: string,
  attemptedUrls: Array<string>,
): Promise<{ lexiconDoc: JsonRecord; sourceUri: string } | null> {
  const dnsName = lexiconDnsQueryName(nsid);
  if (!dnsName) return null;

  const pubDid = await resolvePublishingDidViaLexiconDns(dnsName);
  if (!pubDid) return null;

  const pdsOrigin = pubDid.startsWith("did:plc:")
    ? await resolvePlcDidToPdsOrigin(pubDid)
    : null;
  if (!pdsOrigin) return null;

  const rpc = new URL(
    `${pdsOrigin.replace(/\/+$/, "")}/xrpc/com.atproto.repo.getRecord`,
  );
  rpc.searchParams.set("repo", pubDid);
  rpc.searchParams.set("collection", LEXICON_SCHEMA_COLLECTION);
  rpc.searchParams.set("rkey", nsid);
  attemptedUrls.push(rpc.href);

  const envelope = await fetchJson(rpc.href);
  if (!envelope.ok) return null;
  const value = envelope.data.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as JsonRecord;
  if (typeof rec.id !== "string" || rec.id !== nsid) return null;

  const uriRaw = envelope.data.uri;
  const sourceUri =
    typeof uriRaw === "string" && uriRaw.startsWith("at://")
      ? uriRaw
      : `at://${pubDid}/${LEXICON_SCHEMA_COLLECTION}/${nsid}`;

  return { lexiconDoc: rec, sourceUri };
}

function extractResourceMetadataUrlFromWwwAuthenticate(
  raw: string | null,
): string | null {
  if (!raw) return null;
  const m = /resource_metadata\s*=\s*"([^"]+)"/i.exec(raw);
  return m?.[1]?.trim() || null;
}

async function peekWwwAuthenticateForResourceListing(
  pageUrl: string,
): Promise<Array<string>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*" },
    });
    const found: Array<string> = [];
    const h = res.headers.get("www-authenticate");
    const rm = extractResourceMetadataUrlFromWwwAuthenticate(h);
    if (rm) found.push(rm);

    const link = res.headers.get("link");
    if (link) {
      const relMatch =
        /<([^>]+)>\s*;\s*rel\s*=\s*"oauth-resource-metadata"/i.exec(
          link.replaceAll(/\s+/g, " "),
        );
      const href = relMatch?.[1]?.trim();
      if (href) found.push(href);
    }

    return [...new Set(found)];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function pickStringArray(
  doc: JsonRecord,
  keys: ReadonlyArray<string>,
): Array<string> | undefined {
  for (const k of keys) {
    const v = doc[k];
    if (
      Array.isArray(v) &&
      v.every((x): x is string => typeof x === "string")
    ) {
      return v as Array<string>;
    }
  }
  return undefined;
}

function pickAuthorizationServers(doc: JsonRecord): Array<string> | undefined {
  return pickStringArray(doc, ["authorization_servers"]);
}

function extractScopeHintsFromQuery(clientIdLike: string): string | undefined {
  try {
    const u = new URL(clientIdLike);
    return u.searchParams.get("scope") ?? undefined;
  } catch {
    return undefined;
  }
}

function normalizeScopeWhitespace(raw: string): string {
  return raw.replaceAll("\u00A0", " ").trim();
}

/** AT Proto `scope` values are typically space-separated; each grant may contain `?` parameters. */
function scopeStringToTokens(raw: string): Array<string> {
  return normalizeScopeWhitespace(raw)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Distinct scope tokens parsed from app-published OAuth metadata only (backward
 * compatible when crawls predate persisted `oauthClientScopesDistinct`; does not include
 * `scopes_supported` from an authorization server catalog).
 */
export function oauthClientDistinctTokensFromPublishedScopeLine(
  rawLine: string | null | undefined,
): Array<string> {
  if (!rawLine?.trim()) return [];
  return [...new Set(scopeStringToTokens(rawLine))].toSorted((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Splits a permission scope token into `resource:positional?params`.
 * Multiple colons appear in collection NSIDs, so resource is **only** the first segment (`repo`, `blob`, …).
 */
function splitAtprotoPermissionScopeParts(token: string): {
  resource: string;
  positional: string | null;
  params: URLSearchParams;
} {
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
  if (colonIdx === -1) {
    return {
      resource: beforeParams.trim().toLowerCase(),
      positional: null,
      params,
    };
  }

  const resource = beforeParams.slice(0, colonIdx).trim().toLowerCase();
  const positionalRaw = beforeParams.slice(colonIdx + 1).trim();

  return {
    resource,
    positional: positionalRaw.length > 0 ? positionalRaw : null,
    params,
  };
}

/**
 * Plain-language summaries for storefront UI; the monospace token stays in its own column.
 * Semantics align with https://atproto.com/specs/permission .
 */
function describeAtprotoScopeToken(token: string): string {
  const t = token.trim();
  if (!t) {
    return "No permission spelled out.";
  }

  if (t === "atproto") {
    return "Let the app know which Bluesky-linked account you're signing in as (basic sign-in).";
  }

  if (t.startsWith("transition:")) {
    if (t === "transition:generic") {
      return "Very broad compatibility access—posts, files, and preferences—similar to old “app passwords.” Not deleting your whole account.";
    }
    if (t === "transition:chat.bsky") {
      return "Access to Bluesky direct messages/chats.";
    }
    if (t === "transition:email") {
      return "Can read the email your Bluesky hosting provider exposes for your account (if any).";
    }
    const short = t.replace(/^transition:/u, "").replaceAll(".", " · ");
    return `Legacy-style extra access: ${short}.`;
  }

  const incl = parseIncludeScopeToken(t);
  if (incl) {
    const label = `checklist labeled “${incl.nsid}”`;
    const audience = incl.aud
      ? ` Only applies when signing in with “${incl.aud}”.`
      : "";
    return `Bundles a fuller permission breakdown (${label}).${audience} Bullets expand below when we fetched it.`.trimEnd();
  }

  const {
    resource,
    positional,
    params: sp,
  } = splitAtprotoPermissionScopeParts(t);

  switch (resource) {
    case "blob": {
      const fromQuery = sp.getAll("accept");
      const types =
        positional === null ? fromQuery : [positional, ...fromQuery];
      return types.length > 0
        ? `Upload files to your account, limited to types: ${types.join(", ")}.`
        : "Upload images and files to your account.";
    }
    case "repo": {
      const fromQueryCols = sp.getAll("collection");
      const cols =
        positional === null
          ? fromQueryCols.length > 0
            ? fromQueryCols
            : []
          : [positional];
      const acts = sp.getAll("action");
      const kinds = cols.length > 0 ? cols.join(", ") : "not specified here";
      const verbs =
        acts.length > 0
          ? acts.join(", ")
          : cols.length > 0
            ? "create, update, delete"
            : "not specified here";
      return `Read or update your saved posts and data. Data categories: ${kinds}; allowed operations: ${verbs}.`;
    }
    case "rpc": {
      const lxms = positional === null ? sp.getAll("lxm") : [positional];
      const aud = sp.get("aud");
      const what =
        lxms.length > 0 ? lxms.join(", ") : "specific backend features";
      const tail = aud ? `, only against “${aud}”.` : ".";
      return `Runs backend actions (${what})${tail}`;
    }
    case "account": {
      const attr = positional ?? sp.get("attr") ?? "";
      const action = sp.get("action");
      const field = attr ? `“${attr}”` : "account preferences or limits";
      const how = action ? `: ${action}` : "";
      return `View or tweak account-related info — ${field}${how}.`;
    }
    case "identity": {
      const attr = positional ?? sp.get("attr");
      return attr
        ? `Read identity/profile fields such as ${attr}.`
        : "Read identity or profile-related information.";
    }
    default: {
      return `Technical scope we didn’t summarize: ${token}`;
    }
  }
}

/** Last NSID segment `authBasic` -> path tail `auth/basic` (matches many repo `lexicons/` layouts). */
function splitCamelTailToPathPieces(segment: string): Array<string> {
  const spaced = segment
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  const parts = spaced.toLowerCase().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [segment.toLowerCase()];
}

/** `fyi.atstore.listing.detail` -> `fyi/atstore/listing/detail` */
function nsidToLexiconsPath(nsid: string): string | null {
  const segs = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) return null;
  const authority = segs.slice(0, -1).map((s) => s.toLowerCase());
  const lastSegment = segs.at(-1);
  if (!lastSegment) return null;
  const tail = splitCamelTailToPathPieces(lastSegment);
  return [...authority, ...tail].join("/");
}

/**
 * NSID naming often mirrors producer DNS in reverse (`fyi.atstore` hosted at `atstore.fyi`).
 * Best-effort; not guaranteed for every namespace.
 */
function nsidGuessOrigins(nsid: string): Array<string> {
  const dots = nsid.split(".").filter(Boolean);
  if (dots.length < 3) return [];
  const authority = dots.slice(0, -1);
  const host = authority.toReversed().join(".").toLowerCase();
  return [`https://${host}`];
}

export { parseIncludeScopeToken };

function extractIncludeNsidFromScopeToken(token: string): string | null {
  return parseIncludeScopeToken(token)?.nsid ?? null;
}

function safeCompactJson(input: unknown, maxLen = 220): string {
  try {
    const s = JSON.stringify(input);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(input);
  }
}

function extractPermissionMainDef(
  doc: JsonRecord,
): { title?: string; detail?: string; permissions: unknown } | undefined {
  const defs = doc.defs;
  if (
    !defs ||
    typeof defs !== "object" ||
    Array.isArray(defs) ||
    defs === null
  ) {
    return undefined;
  }
  const main = defs as Record<string, unknown>;
  const m = main.main;
  if (!m || typeof m !== "object" || Array.isArray(m)) return undefined;
  const mainRec = m as JsonRecord;
  if (mainRec.type !== "permission-set") return undefined;
  return {
    title: typeof mainRec.title === "string" ? mainRec.title : undefined,
    detail: typeof mainRec.detail === "string" ? mainRec.detail : undefined,
    permissions: mainRec.permissions ?? [],
  };
}

/** Plain-language bullets for inlined permission-set documents (popover detail). */
function formatPermissionGrant(p: JsonRecord): string {
  if (p.type !== "permission") {
    return `Unrecognized checklist entry (${safeCompactJson(p)})`;
  }

  switch (p.resource) {
    case "repo": {
      const cols = Array.isArray(p.collection)
        ? p.collection.map(String).join(", ")
        : "not narrowed here";
      const acts = Array.isArray(p.action)
        ? p.action.map(String).join(", ")
        : "not narrowed here";
      return `Posts / stored records — kinds covered: ${cols}; allowed verbs: ${acts}.`;
    }
    case "blob": {
      const acc = Array.isArray(p.accept)
        ? p.accept.map(String).join(", ")
        : "";
      const types =
        typeof p.mediaTypePattern === "string" ? p.mediaTypePattern : "";
      const hints = [
        acc && `accepted types ${acc}`,
        types && `type pattern ${types}`,
      ].filter(Boolean);
      return hints.length > 0
        ? `File uploads (${hints.join("; ")}).`
        : "File uploads (bundled rules not summarized line-by-line here).";
    }
    case "rpc": {
      const lxms = Array.isArray(p.lxm) ? p.lxm.map(String).join(", ") : "";
      const aud = typeof p.aud === "string" ? p.aud : "";
      const parts = [
        lxms && `backend calls ${lxms}`,
        aud && `hosts like ${aud}`,
      ].filter(Boolean);
      return parts.length > 0
        ? `Remote actions (${parts.join("; ")}).`
        : "Remote/backend actions (details not spelled out here).";
    }
    case "account": {
      const attr = typeof p.attr === "string" ? p.attr : "account fields";
      const action =
        typeof p.action === "string" ? p.action : "read or manage as listed";
      return `Account-related data — ${attr}: ${action}.`;
    }
    case "identity": {
      const attr = typeof p.attr === "string" ? p.attr : "profile-related";
      return `Identity / profile (${attr}).`;
    }
    default: {
      return `Technical checklist item (${String(p.resource)}).`;
    }
  }
}

async function tryReadLexiconPermissionSetJson(
  nsid: string,
): Promise<JsonRecord | null> {
  const rel = nsidToLexiconsPath(nsid);
  if (!rel) return null;
  const abs = resolve(process.cwd(), "lexicons", `${rel}.json`);
  try {
    await access(abs, constants.R_OK);
    const text = await readFile(abs, "utf8");
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const rec = parsed as JsonRecord;
    if (typeof rec.id !== "string" || rec.id !== nsid) return null;
    return rec;
  } catch {
    return null;
  }
}

export type PermissionLexiconLookup =
  | {
      resolved: true;
      nsid: string;
      sourceKind: "remote" | "workspace";
      sourceUrl: string;
      title?: string;
      detail?: string;
      structuredLines: Array<string>;
    }
  | {
      resolved: false;
      nsid: string;
      attemptedRemoteUrls: Array<string>;
      reason: string;
    };

/** One Summary row plus optional inlined `include` bundle resolution. */
export type SummaryScopeHumanRow =
  | { token: string; description: string }
  | {
      token: string;
      description: string;
      includePermissionSet: Extract<
        PermissionLexiconLookup,
        { resolved: true }
      >;
    }
  | {
      token: string;
      description: string;
      includePermissionSetUnresolved: Extract<
        PermissionLexiconLookup,
        { resolved: false }
      >;
    };

/** Result of probing one listing URL (`external_url`). Safe to stringify for `report_json`. */
export type OAuthAuthProbeReport = {
  inputUrl: string;
  notes: Array<string>;
  wwwAuthenticateHints: Array<string>;
  protectedResource: {
    attempted: Array<AttemptResult<JsonRecord>>;
    mergedScopes: Array<string>;
    authorizationServers: Array<string>;
    raw?: JsonRecord;
  };
  authorizationServersDetail: Array<{
    issuerInput: string;
    metadataUrl: string;
    result: AttemptResult<JsonRecord>;
    scopes_supported?: Array<string>;
  }>;
  clientMetadata: Array<{
    url: string;
    result: AttemptResult<JsonRecord>;
    scope_field?: string;
  }>;
  summary: {
    oauthScopesDistinct: Array<string>;
    /** Persisted since listing OAuth probes v2; absent on legacy `report_json`. */
    oauthClientScopesDistinct?: Array<string>;
    transitionalScopesPresent: Array<string>;
    publishesAtprotoAs: boolean | null;
    /** Full `scope` line from client metadata, if any (space-separated tokens). */
    clientScopeRawLine: string | null;
    /** Whether the full line matches draft OAuth 2.1 `scope` syntax (`@atcute/oauth-types`). */
    clientScopeSyntaxOk: boolean | null;
    /** Per-token descriptions for UI / listings; `include` pulls permission-set lexicon when available. */
    scopeHumanReadable: Array<SummaryScopeHumanRow>;
  };
  /** Tried listing origin AS metadata when Protected Resource Metadata had no authorization_servers. */
  authorizationServerOriginFallback?: AttemptResult<JsonRecord>;
};

async function resolveIncludedPermissionLexicon(
  nsid: string,
  listingOrigin: string,
  lookupCache: Map<string, PermissionLexiconLookup>,
): Promise<PermissionLexiconLookup> {
  const memo = lookupCache.get(nsid);
  if (memo) return memo;

  const rel = nsidToLexiconsPath(nsid);
  if (!rel) {
    const out: PermissionLexiconLookup = {
      resolved: false,
      nsid,
      attemptedRemoteUrls: [],
      reason:
        "The permission bundle reference looks malformed or incomplete, so we couldn’t look it up.",
    };
    lookupCache.set(nsid, out);
    return out;
  }

  const attemptedRemoteUrls: Array<string> = [];

  const localDoc = await tryReadLexiconPermissionSetJson(nsid);
  let doc = localDoc;

  let sourceKind: "remote" | "workspace" | null = localDoc ? "workspace" : null;
  let sourceUrl = localDoc
    ? resolve(process.cwd(), "lexicons", `${rel}.json`)
    : "";

  if (!doc) {
    const fromRegistry = await fetchPermissionSetViaLexiconRegistry(
      nsid,
      attemptedRemoteUrls,
    );
    if (fromRegistry) {
      doc = fromRegistry.lexiconDoc;
      sourceKind = "remote";
      sourceUrl = fromRegistry.sourceUri;
    }
  }

  if (!doc) {
    const originOrder = [
      ...new Set([listingOrigin, ...nsidGuessOrigins(nsid)]),
    ];
    outer: for (const o of originOrder) {
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(o);
      } catch {
        continue;
      }
      const fetchUrl = `${parsedOrigin.origin}/lexicons/${rel}.json`;
      attemptedRemoteUrls.push(fetchUrl);
      const res = await fetchJson(fetchUrl);
      if (!res.ok) continue;
      const idField = res.data.id;
      if (typeof idField !== "string" || idField !== nsid) continue;
      doc = res.data;
      sourceKind = "remote";
      sourceUrl = res.url;
      break outer;
    }
  }

  if (!doc || !sourceKind) {
    const out: PermissionLexiconLookup = {
      resolved: false,
      nsid,
      attemptedRemoteUrls,
      reason:
        "We couldn’t fetch the expanded permission checklist (missing URL, unreachable host, or hidden file). Locally we also check your project’s lexicons folder when applicable.",
    };
    lookupCache.set(nsid, out);
    return out;
  }

  const bundleMain = extractPermissionMainDef(doc);
  if (!bundleMain) {
    const out: PermissionLexiconLookup = {
      resolved: false,
      nsid,
      attemptedRemoteUrls,
      reason:
        "The file we fetched isn’t laid out like a permission checklist we can summarize.",
    };
    lookupCache.set(nsid, out);
    return out;
  }

  const perms = bundleMain.permissions;
  const structuredLines = Array.isArray(perms)
    ? perms.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? formatPermissionGrant(row as JsonRecord)
          : safeCompactJson(row),
      )
    : [
        "The permission checklist inside the bundle isn’t laid out how we expected.",
      ];

  const out: PermissionLexiconLookup = {
    resolved: true,
    nsid,
    sourceKind,
    sourceUrl,
    title: bundleMain.title,
    detail: bundleMain.detail,
    structuredLines,
  };
  lookupCache.set(nsid, out);
  return out;
}

async function buildScopeHumanReadableRows(
  tokens: ReadonlyArray<string>,
  listingOrigin: string,
  lookupCache: Map<string, PermissionLexiconLookup>,
): Promise<Array<SummaryScopeHumanRow>> {
  return Promise.all(
    tokens.map(async (token): Promise<SummaryScopeHumanRow> => {
      const description = describeAtprotoScopeToken(token);
      const includeNsid = extractIncludeNsidFromScopeToken(token);
      if (!includeNsid) {
        return { token, description };
      }

      const pr = await resolveIncludedPermissionLexicon(
        includeNsid,
        listingOrigin,
        lookupCache,
      );
      if (pr.resolved) {
        return {
          token,
          description,
          includePermissionSet: pr,
        };
      }

      return {
        token,
        description,
        includePermissionSetUnresolved: pr,
      };
    }),
  );
}

async function probeAuthorizationServer(
  originOrIssuer: string,
): Promise<AttemptResult<JsonRecord>> {
  return fetchJson(authorizationServerMetadataUrl(originOrIssuer));
}

export async function probeOAuthListingAuth(
  rawHref: string,
): Promise<OAuthAuthProbeReport> {
  let listingUrl: URL;
  try {
    listingUrl = new URL(normalizeOAuthProbeHref(rawHref));
  } catch {
    throw new Error(`Invalid listing URL: ${rawHref}`);
  }

  const href = listingUrl.href.replace(/#$/, "");

  const notes: Array<string> = [
    "Transitional scopes (e.g. `transition:generic`) mirror legacy app-password-style access; " +
      "see Authorization Scopes in https://atproto.com/specs/oauth",
  ];

  const wwwHints = await peekWwwAuthenticateForResourceListing(
    listingUrl.origin + "/",
  );

  const prAttempts: Array<AttemptResult<JsonRecord>> = [];

  const prUrls = new Set([
    ...protectedResourceMetadataUrlCandidates(href),
    ...wwwHints,
  ]);

  for (const u of prUrls) {
    prAttempts.push(await fetchJson(u));
  }

  const firstPr = prAttempts.find((x) => x.ok);
  let authServersFromPr: Array<string> = [];
  let prScopes: Array<string> = [];

  if (firstPr?.ok) {
    authServersFromPr = pickAuthorizationServers(firstPr.data) ?? [];
    prScopes =
      pickStringArray(firstPr.data, ["scopes_supported", "scopesSupported"]) ??
      ([] as Array<string>);
  }

  const asDetails: OAuthAuthProbeReport["authorizationServersDetail"] = [];
  const seenIssuer = new Set<string>();

  for (const issuer of authServersFromPr) {
    const key = issuer.replace(/\/+$/, "").toLowerCase();
    if (seenIssuer.has(key)) continue;
    seenIssuer.add(key);
    const metadata = await probeAuthorizationServer(issuer);
    const scopes = metadata.ok
      ? pickStringArray(metadata.data, ["scopes_supported", "scopesSupported"])
      : undefined;

    asDetails.push({
      issuerInput: issuer,
      metadataUrl: authorizationServerMetadataUrl(issuer),
      result: metadata,
      scopes_supported: scopes,
    });
  }

  let authorizationServerOriginFallback: AttemptResult<JsonRecord> | undefined;

  if (authServersFromPr.length === 0) {
    authorizationServerOriginFallback = await probeAuthorizationServer(
      listingUrl.origin,
    );
    if (authorizationServerOriginFallback.ok) {
      const scopes =
        pickStringArray(authorizationServerOriginFallback.data, [
          "scopes_supported",
          "scopesSupported",
        ]) ?? ([] as Array<string>);
      asDetails.push({
        issuerInput: listingUrl.origin,
        metadataUrl: authorizationServerMetadataUrl(listingUrl.origin),
        result: authorizationServerOriginFallback,
        scopes_supported: scopes,
      });
    }
  }

  const clientAttempts: OAuthAuthProbeReport["clientMetadata"] = [];

  for (const u of clientMetadataCandidates(listingUrl.origin)) {
    const result = await fetchJson(u);
    let scope_field: string | undefined;
    if (result.ok) {
      const s = result.data.scope;
      if (typeof s === "string") scope_field = normalizeScopeWhitespace(s);
      const cid = result.data.client_id;
      if (!scope_field && typeof cid === "string") {
        const fromQ = extractScopeHintsFromQuery(cid);
        if (fromQ) scope_field = normalizeScopeWhitespace(fromQ);
      }
    }
    if (result.ok || result.status !== 404) {
      clientAttempts.push({ url: u, result, scope_field });
    }
  }

  const oauthScopesDistinct = new Set<string>();
  const oauthClientScopesDistinct = new Set<string>();

  for (const s of prScopes) oauthScopesDistinct.add(s);
  for (const row of asDetails) {
    for (const s of row.scopes_supported ?? []) oauthScopesDistinct.add(s);
  }

  for (const c of clientAttempts) {
    const hint =
      c.scope_field ??
      (c.result.ok && typeof c.result.data.scope === "string"
        ? normalizeScopeWhitespace(c.result.data.scope)
        : undefined) ??
      (c.result.ok && typeof c.result.data.client_id === "string"
        ? extractScopeHintsFromQuery(c.result.data.client_id)
        : undefined);

    if (!hint) continue;
    for (const token of scopeStringToTokens(hint)) {
      oauthScopesDistinct.add(token);
      oauthClientScopesDistinct.add(token);
    }
  }

  let clientScopeRawLine: string | null = null;
  for (const c of clientAttempts) {
    if (c.result.ok && typeof c.result.data.scope === "string") {
      clientScopeRawLine = normalizeScopeWhitespace(c.result.data.scope);
      break;
    }
  }
  const clientScopeSyntaxOk =
    clientScopeRawLine === null ? null : isOAuthScope(clientScopeRawLine);

  const lexiconLookupCache = new Map<string, PermissionLexiconLookup>();
  const scopeHumanReadable = await buildScopeHumanReadableRows(
    [...oauthScopesDistinct].toSorted(),
    listingUrl.origin,
    lexiconLookupCache,
  );

  if (
    scopeHumanReadable.some(
      (r) =>
        "includePermissionSet" in r &&
        r.includePermissionSet.sourceKind === "workspace",
    )
  ) {
    notes.push(
      "Included permission-set lexicons were read from ./lexicons/ under the cwd (authoritative when you're developing this repo; production apps should serve equivalent JSON publicly). See https://atproto.com/guides/permission-sets",
    );
  }

  const hadAuthorizationServerScopes = asDetails.some(
    (r) => r.result.ok && (r.scopes_supported?.length ?? 0) > 0,
  );
  const hadClientScopeHint = clientAttempts.some(
    (c) =>
      Boolean(c.scope_field) ||
      (c.result.ok && typeof c.result.data.scope === "string"),
  );

  if (oauthScopesDistinct.size === 0) {
    notes.push(
      "No OAuth scopes discovered. Storefront URLs are often marketing sites; try the account PDS " +
        "hostname from the user's DID document `service` endpoint, or a documented API base URL.",
    );
  } else {
    if (!firstPr?.ok) {
      notes.push(
        "Protected Resource Metadata (RFC 9728) was not found for this URL; scopes below combine " +
          "Authorization Server metadata (RFC 8414) and/or OAuth client metadata when present.",
      );
    }
    if (hadClientScopeHint && !hadAuthorizationServerScopes) {
      notes.push(
        "Scopes shown include values from the app's public client metadata — what the client may " +
          "request — not necessarily the full `scopes_supported` list of an Authorization Server.",
      );
    }
  }
  const transitional = [...oauthScopesDistinct].filter((s) =>
    s.startsWith("transition:"),
  );
  let publishesAtprotoAs: boolean | null = null;
  const asScopeRows = asDetails.filter(
    (r) => r.result.ok && r.scopes_supported,
  );
  if (asScopeRows.some((r) => r.scopes_supported?.includes("atproto"))) {
    publishesAtprotoAs = true;
  } else if (asScopeRows.length > 0) {
    publishesAtprotoAs = false;
  } else if (oauthScopesDistinct.has("atproto")) {
    publishesAtprotoAs = true;
  }

  const report: OAuthAuthProbeReport = {
    inputUrl: href,
    notes,
    wwwAuthenticateHints: wwwHints,
    protectedResource: {
      attempted: prAttempts,
      mergedScopes: [...prScopes],
      authorizationServers: [...authServersFromPr],
      raw: firstPr?.ok ? firstPr.data : undefined,
    },
    authorizationServersDetail: asDetails,
    clientMetadata: clientAttempts,
    summary: {
      oauthScopesDistinct: [...oauthScopesDistinct].toSorted(),
      oauthClientScopesDistinct: [...oauthClientScopesDistinct].toSorted(),
      transitionalScopesPresent: transitional.toSorted(),
      publishesAtprotoAs,
      clientScopeRawLine,
      clientScopeSyntaxOk,
      scopeHumanReadable,
    },
    authorizationServerOriginFallback,
  };

  return report;
}
