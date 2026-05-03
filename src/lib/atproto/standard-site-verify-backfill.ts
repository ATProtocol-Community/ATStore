import type { Database } from "#/db/index.server";

import { COLLECTION } from "#/lib/atproto/nsids";
import { resolveAtprotoPdsBaseUrl } from "#/lib/atproto/resolve-atproto-pds";
import {
  tryParseStandardDocumentRecord,
  upsertStandardDocumentIntoDb,
} from "#/lib/atproto/tap-standard-document-sync";
import {
  tryParseStandardPublicationRecord,
  upsertStandardPublicationIntoDb,
} from "#/lib/atproto/tap-standard-publication-sync";

type ListRecordRow = { uri: string; value: unknown };

function rkeyFromCollectionAtUri(
  uri: string,
  collection: string,
): string | null {
  const withoutAt = uri.replace(/^at:\/\//, "");
  const needle = `/${collection}/`;
  const idx = withoutAt.indexOf(needle);
  if (idx === -1) return null;
  const rkey = withoutAt.slice(idx + needle.length);
  if (rkey.length === 0 || rkey.includes("/")) return null;
  return rkey;
}

async function* paginateListRecords(
  pdsBase: string,
  repo: string,
  collection: string,
): AsyncGenerator<ListRecordRow, void, undefined> {
  let cursor: string | undefined;
  do {
    const u = new URL("/xrpc/com.atproto.repo.listRecords", `${pdsBase}/`);
    u.searchParams.set("repo", repo);
    u.searchParams.set("collection", collection);
    u.searchParams.set("limit", "100");
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `listRecords ${collection} failed ${res.status}: ${text.slice(0, 500)}`,
      );
    }
    const data = (await res.json()) as {
      records?: Array<{ uri: string; value: unknown }>;
      cursor?: string;
    };
    const records = data.records ?? [];
    for (const rec of records) {
      yield { uri: rec.uri, value: rec.value };
    }
    cursor = data.cursor;
  } while (cursor);
}

async function backfillStandardSiteForProductDid(
  db: Database,
  productDid: string,
): Promise<void> {
  const did = productDid.trim();
  if (!did.startsWith("did:")) return;

  const pds = await resolveAtprotoPdsBaseUrl(did);
  if (!pds) {
    console.warn(
      `[standard-site-backfill] no PDS for ${did}; skip listRecords backfill`,
    );
    return;
  }

  for await (const row of paginateListRecords(
    pds,
    did,
    COLLECTION.standardPublication,
  )) {
    const body = row.value as Record<string, unknown> | null | undefined;
    if (!body || typeof body !== "object") continue;
    const rkey = rkeyFromCollectionAtUri(
      row.uri,
      COLLECTION.standardPublication,
    );
    if (!rkey) continue;
    const parsed = tryParseStandardPublicationRecord(body);
    if (!parsed.ok) continue;
    await upsertStandardPublicationIntoDb({
      db,
      repoDid: did,
      rkey,
      record: parsed.record,
      recordSource: body,
    });
  }

  for await (const row of paginateListRecords(
    pds,
    did,
    COLLECTION.standardDocument,
  )) {
    const body = row.value as Record<string, unknown> | null | undefined;
    if (!body || typeof body !== "object") continue;
    const rkey = rkeyFromCollectionAtUri(row.uri, COLLECTION.standardDocument);
    if (!rkey) continue;
    const parsed = tryParseStandardDocumentRecord(body);
    if (!parsed.ok) continue;
    await upsertStandardDocumentIntoDb({
      db,
      repoDid: did,
      rkey,
      record: parsed.record,
      recordSource: body,
    });
  }
}

/**
 * Fire-and-forget PDS crawl after a listing becomes verified — fills rows Tap skipped
 * before any `product_account_did` gate matched.
 */
export function scheduleStandardSiteBackfillForProductDid(
  db: Database,
  productDid: string,
): void {
  const did = productDid.trim();
  if (!did.startsWith("did:")) return;
  void backfillStandardSiteForProductDid(db, did).catch((error) => {
    console.error(`[standard-site-backfill] failed productDid=${did}`, error);
  });
}
