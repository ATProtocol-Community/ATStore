import { access, constants, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getLexiconProducerSiteFromRepoNsid } from "./lexicon-producer-site";
import { fetchLexiconSchemaRecordValue } from "./oauth-listing-auth-probe";

const LEXICON_DESC_UA =
  "at-store-lexicon-description/1.0 (+https://github.com/ATProtocol-Community/ATStore)";
const LEXICON_DESC_FETCH_TIMEOUT_MS = 12_000;

/** Last NSID segment `authBasic` -> path tail `auth/basic` (matches repo `lexicons/` layouts). */
function splitCamelTailToPathPieces(segment: string): Array<string> {
  const spaced = segment
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  const parts = spaced.toLowerCase().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [segment.toLowerCase()];
}

/** `fyi.atstore.listing.detail` -> `fyi/atstore/listing/detail` */
export function nsidToLexiconsWorkspaceRelativePath(
  nsid: string,
): string | null {
  const segs = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) {
    return null;
  }
  const authority = segs.slice(0, -1).map((s) => s.toLowerCase());
  const lastSegment = segs.at(-1);
  if (!lastSegment) {
    return null;
  }
  const tail = splitCamelTailToPathPieces(lastSegment);
  return [...authority, ...tail].join("/");
}

function extractLexiconRecordMainDescription(doc: unknown): string | null {
  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) {
    return null;
  }
  const rec = doc as Record<string, unknown>;
  const defs = rec.defs;
  if (defs == null || typeof defs !== "object" || Array.isArray(defs)) {
    return null;
  }
  const main = (defs as Record<string, unknown>).main;
  if (main == null || typeof main !== "object" || Array.isArray(main)) {
    return null;
  }
  const mainRec = main as Record<string, unknown>;
  if (mainRec.type !== "record") {
    return null;
  }
  const d = mainRec.description;
  if (typeof d !== "string" || !d.trim()) {
    return null;
  }
  return d.trim();
}

/** Load `defs.main.description` when `lexicons/${path}.json` exists in the repo. */
export async function tryReadLexiconRecordMainDescriptionFromWorkspace(
  nsid: string,
): Promise<string | null> {
  const rel = nsidToLexiconsWorkspaceRelativePath(nsid);
  if (!rel) {
    return null;
  }
  const abs = resolve(process.cwd(), "lexicons", `${rel}.json`);
  try {
    await access(abs, constants.R_OK);
    const text = await readFile(abs, "utf8");
    const parsed: unknown = JSON.parse(text);
    const idField =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      (parsed as { id?: unknown }).id;
    if (typeof idField !== "string" || idField !== nsid) {
      return null;
    }
    return extractLexiconRecordMainDescription(parsed);
  } catch {
    return null;
  }
}

async function tryFetchLexiconRecordMainDescriptionFromHttps(
  url: string,
  nsid: string,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LEXICON_DESC_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": LEXICON_DESC_UA },
    });
    if (!res.ok) {
      return null;
    }
    const parsed: unknown = await res.json();
    const idField =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      (parsed as { id?: unknown }).id;
    if (typeof idField !== "string" || idField !== nsid) {
      return null;
    }
    return extractLexiconRecordMainDescription(parsed);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Same path convention as repo `lexicons/` and OAuth `GET {origin}/lexicons/{rel}.json` probes. */
async function tryFetchLexiconRecordMainDescriptionFromProducerSite(
  nsid: string,
): Promise<string | null> {
  const rel = nsidToLexiconsWorkspaceRelativePath(nsid);
  if (!rel) {
    return null;
  }
  const site = getLexiconProducerSiteFromRepoNsid(nsid);
  if (!site?.siteOrigin) {
    return null;
  }
  const origin = site.siteOrigin.replace(/\/+$/, "");
  const url = `${origin}/lexicons/${rel}.json`;
  return tryFetchLexiconRecordMainDescriptionFromHttps(url, nsid);
}

async function tryFetchLexiconRecordMainDescriptionFromRegistry(
  nsid: string,
): Promise<string | null> {
  const rec = await fetchLexiconSchemaRecordValue(nsid);
  if (!rec) {
    return null;
  }
  return extractLexiconRecordMainDescription(rec);
}

/**
 * Resolve `defs.main.description` per NSID: local `lexicons/` file, then
 * `{producerOrigin}/lexicons/…` (reversed authority), then `com.atproto.lexicon.schema` via
 * `_lexicon.*` DNS + PDS.
 */
export async function loadLexiconRecordDescriptionsForWorkspace(
  nsids: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(nsids.map((n) => n.trim()).filter(Boolean))];
  const out: Record<string, string> = {};
  const localResults = await Promise.all(
    unique.map(async (nsid) => {
      const d = await tryReadLexiconRecordMainDescriptionFromWorkspace(nsid);
      return { nsid, d };
    }),
  );
  const needRemote: Array<string> = [];
  for (const { nsid, d } of localResults) {
    if (d) {
      out[nsid] = d;
    } else {
      needRemote.push(nsid);
    }
  }

  const BATCH = 6;
  for (let i = 0; i < needRemote.length; i += BATCH) {
    const batch = needRemote.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (nsid) => {
        const fromSite =
          await tryFetchLexiconRecordMainDescriptionFromProducerSite(nsid);
        if (fromSite) {
          out[nsid] = fromSite;
          return;
        }
        const fromReg =
          await tryFetchLexiconRecordMainDescriptionFromRegistry(nsid);
        if (fromReg) {
          out[nsid] = fromReg;
        }
      }),
    );
  }
  return out;
}
