import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { COLLECTION, STANDARD_SITE_NSID } from "#/lib/atproto/nsids";
import { hasStoreListingForProductDid } from "#/lib/atproto/standard-site-product-did-gate";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const publicationBodySchema = z.object({
  url: z.string().min(1),
  name: z.string().max(5000).optional(),
  description: z.string().max(32_000).optional(),
  createdAt: z.string().optional(),
});

export type SiteStandardPublicationParsed = {
  url: string;
  name?: string;
  description?: string;
  createdAt?: string;
};

export type PublicationParseResult =
  | { ok: true; record: SiteStandardPublicationParsed }
  | {
      ok: false;
      reason: string;
      stage: "no_body" | "zod" | "url";
      zodError?: z.ZodError;
    };

function normalizePublicationBaseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function tryParseStandardPublicationRecord(
  body: Record<string, unknown> | undefined,
): PublicationParseResult {
  if (!body) {
    return { ok: false, reason: "record body is missing", stage: "no_body" };
  }
  const t = body.$type;
  if (
    t !== undefined &&
    typeof t === "string" &&
    t !== STANDARD_SITE_NSID.publication
  ) {
    return {
      ok: false,
      reason: `unexpected $type ${t}`,
      stage: "zod",
    };
  }
  const parsed = publicationBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.message,
      stage: "zod",
      zodError: parsed.error,
    };
  }
  const base = normalizePublicationBaseUrl(parsed.data.url);
  if (!base) {
    return {
      ok: false,
      reason: "url is not a valid http(s) URL",
      stage: "url",
    };
  }
  const rec: SiteStandardPublicationParsed = { url: base };
  const n = parsed.data.name?.trim();
  if (n) rec.name = n;
  const d = parsed.data.description?.trim();
  if (d) rec.description = d;
  const c = parsed.data.createdAt?.trim();
  if (c) rec.createdAt = c;
  return { ok: true, record: rec };
}

function atUriForPublication(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.standardPublication}/${rkey}`;
}

function recordJsonValue(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(body) as Record<string, unknown>;
  }
  // eslint-disable-next-line unicorn/prefer-structured-clone -- environments without structuredClone
  return JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
}

export async function upsertStandardPublicationIntoDb(input: {
  db: Database;
  repoDid: string;
  rkey: string;
  record: SiteStandardPublicationParsed;
  recordSource?: Record<string, unknown>;
}) {
  const { db, repoDid, rkey, record } = input;
  const atUri = atUriForPublication(repoDid, rkey);
  const publicationName = record.name?.trim() || null;
  const recordJson = input.recordSource
    ? recordJsonValue(input.recordSource)
    : null;

  await db
    .insert(schema.productSitePublications)
    .values({
      repoDid,
      rkey,
      atUri,
      baseUrl: record.url,
      publicationName,
      recordJson,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.productSitePublications.atUri,
      set: {
        repoDid,
        rkey,
        baseUrl: record.url,
        publicationName,
        recordJson,
        updatedAt: new Date(),
      },
    });
}

export async function upsertStandardPublicationFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: SiteStandardPublicationParsed;
  recordSource?: Record<string, unknown>;
}) {
  if (!(await hasStoreListingForProductDid(input.db, input.did))) {
    console.warn(
      `[tap-standard-publication] skip — no store_listings.product_account_did=${input.did} rkey=${input.rkey}`,
    );
    return;
  }
  await upsertStandardPublicationIntoDb({
    db: input.db,
    repoDid: input.did,
    rkey: input.rkey,
    record: input.record,
    recordSource: input.recordSource,
  });
}

export async function deleteStandardPublicationFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  await input.db
    .delete(schema.productSitePublications)
    .where(
      and(
        eq(schema.productSitePublications.repoDid, input.did),
        eq(schema.productSitePublications.rkey, input.rkey),
      ),
    );
}
