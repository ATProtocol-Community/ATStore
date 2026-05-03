import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { COLLECTION, STANDARD_SITE_NSID } from "#/lib/atproto/nsids";
import { hasStoreListingForProductDid } from "#/lib/atproto/standard-site-product-did-gate";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const DOCUMENT_DESC_MAX = 12_000;

const documentBodySchema = z.object({
  path: z.string().min(1),
  publishedAt: z.string().min(1),
  title: z.string().max(5000).optional(),
  textContent: z.string().max(100_000).optional(),
  site: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("at://"), {
      message: "site must be an at:// URI",
    })
    .optional(),
});

export type SiteStandardDocumentParsed = {
  path: string;
  publishedAt: string;
  title?: string;
  textContent?: string;
  site?: string;
};

export type DocumentParseResult =
  | { ok: true; record: SiteStandardDocumentParsed }
  | {
      ok: false;
      reason: string;
      stage: "no_body" | "zod" | "datetime";
      zodError?: z.ZodError;
    };

export function tryParseStandardDocumentRecord(
  body: Record<string, unknown> | undefined,
): DocumentParseResult {
  if (!body) {
    return { ok: false, reason: "record body is missing", stage: "no_body" };
  }
  const t = body.$type;
  if (
    t !== undefined &&
    typeof t === "string" &&
    t !== STANDARD_SITE_NSID.document
  ) {
    return {
      ok: false,
      reason: `unexpected $type ${t}`,
      stage: "zod",
    };
  }
  const parsed = documentBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.message,
      stage: "zod",
      zodError: parsed.error,
    };
  }
  const dt = new Date(parsed.data.publishedAt);
  if (Number.isNaN(dt.getTime())) {
    return {
      ok: false,
      reason: "publishedAt is not a valid datetime",
      stage: "datetime",
    };
  }
  const rec: SiteStandardDocumentParsed = {
    path: parsed.data.path.trim(),
    publishedAt: parsed.data.publishedAt,
  };
  const title = parsed.data.title?.trim();
  if (title) rec.title = title;
  const tx = parsed.data.textContent?.trim();
  if (tx) {
    rec.textContent =
      tx.length > DOCUMENT_DESC_MAX ? tx.slice(0, DOCUMENT_DESC_MAX) : tx;
  }
  const site = parsed.data.site?.trim();
  if (site) rec.site = site;
  return { ok: true, record: rec };
}

function atUriForDocument(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.standardDocument}/${rkey}`;
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

export async function upsertStandardDocumentIntoDb(input: {
  db: Database;
  repoDid: string;
  rkey: string;
  record: SiteStandardDocumentParsed;
  recordSource?: Record<string, unknown>;
}) {
  const { db, repoDid, rkey, record } = input;
  const atUri = atUriForDocument(repoDid, rkey);
  const published = new Date(record.publishedAt);
  const publicationAtUri = record.site?.trim() || null;
  const title = record.title?.trim() || null;
  const description = record.textContent?.trim() || null;
  const recordJson = input.recordSource
    ? recordJsonValue(input.recordSource)
    : null;

  await db
    .insert(schema.productSiteDocuments)
    .values({
      repoDid,
      rkey,
      atUri,
      publicationAtUri,
      title,
      description,
      path: record.path,
      documentPublishedAt: published,
      recordJson,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.productSiteDocuments.atUri,
      set: {
        repoDid,
        rkey,
        publicationAtUri,
        title,
        description,
        path: record.path,
        documentPublishedAt: published,
        recordJson,
        updatedAt: new Date(),
      },
    });
}

export async function upsertStandardDocumentFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: SiteStandardDocumentParsed;
  recordSource?: Record<string, unknown>;
}) {
  if (!(await hasStoreListingForProductDid(input.db, input.did))) {
    console.warn(
      `[tap-standard-document] skip — no store_listings.product_account_did=${input.did} rkey=${input.rkey}`,
    );
    return;
  }
  await upsertStandardDocumentIntoDb({
    db: input.db,
    repoDid: input.did,
    rkey: input.rkey,
    record: input.record,
    recordSource: input.recordSource,
  });
}

export async function deleteStandardDocumentFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  await input.db
    .delete(schema.productSiteDocuments)
    .where(
      and(
        eq(schema.productSiteDocuments.repoDid, input.did),
        eq(schema.productSiteDocuments.rkey, input.rkey),
      ),
    );
}
