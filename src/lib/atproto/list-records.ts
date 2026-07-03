/**
 * Shared helpers for paginating `com.atproto.repo.listRecords` against a PDS.
 *
 * Used by `standard-site-verify-backfill.ts` and `fund-backfill.ts` to crawl arbitrary
 * user repos without going through Tap. Pulled out so each new collection ingester can
 * reuse a single, well-tested implementation.
 */
export type ListRecordRow = { uri: string; value: unknown };

/**
 * Strip the leading `at://<did>/<collection>/` from a record URI to recover the rkey.
 * Returns null when the URI does not match the expected shape (rkey must be a single segment).
 */
export function rkeyFromCollectionAtUri(
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

/**
 * Async-iterate every record in `<repo>/<collection>` via paginated `listRecords`.
 * Throws on non-2xx responses (with a truncated body in the message) — callers handle
 * the error via try/catch in their backfill orchestration.
 */
/**
 * Fetch a single repo record via unauthenticated `getRecord` on the repo owner's PDS.
 * Prefer this over an authenticated AT Store client — third-party listings live on their
 * own PDS and are not visible through the store account's service endpoint.
 */
export async function fetchRepoRecord(
  pdsBase: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<Record<string, unknown>> {
  const u = new URL("/xrpc/com.atproto.repo.getRecord", `${pdsBase}/`);
  u.searchParams.set("repo", repo);
  u.searchParams.set("collection", collection);
  u.searchParams.set("rkey", rkey);
  const res = await fetch(u.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `getRecord ${collection}/${rkey} failed ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  const data = (await res.json()) as { value?: unknown };
  const body = data.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`getRecord ${collection}/${rkey} returned no record body`);
  }
  return body as Record<string, unknown>;
}

export async function* paginateListRecords(
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
