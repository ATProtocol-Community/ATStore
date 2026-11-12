import type { Blob as AtprotoBlob } from "@atcute/lexicons/interfaces";
import type { Database } from "#/db/index.server";
import type {
  FyiAtstoreListingDetail,
  ListingLink,
} from "#/lib/atproto/listing-record";

import { isBlob, isLegacyBlob } from "@atcute/lexicons/interfaces";
import * as schema from "#/db/schema";
import { parseAtUriParts } from "#/lib/atproto/at-uri";
import {
  blobLikeToBskyCdnUrl,
  explainMissingBlobUrl,
  getBlobCidString,
} from "#/lib/atproto/blob-cdn-url";
import {
  LISTING_LINK_LABEL_MAX_LENGTH,
  LISTING_LINK_MAX_COUNT,
  LISTING_LINK_URL_MAX_LENGTH,
  normalizeListingLinks,
} from "#/lib/atproto/listing-record";
import { COLLECTION, GAMES_NSID } from "#/lib/atproto/nsids";
import { resolveAtprotoPdsBaseUrl } from "#/lib/atproto/resolve-atproto-pds";
import { linkListingToGameDefine } from "#/lib/atproto/tap-game-sync";
import { fetchBlueskyPublicProfileFields } from "#/lib/bluesky-public-profile";
import { refreshListingPageSnapshot } from "#/lib/listing-page-snapshot";
import { pruneReplacedProductAccountMentions } from "#/lib/trending/prune-replaced-product-account-mentions";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * `isBlob()` requires `$type: "blob"`, exactly four keys, etc. Tap / repo JSON often omits
 * `$type` or adds fields — ingest only needs scalars for Postgres; accept any blob ref we can recognize.
 */
/** Short shape summary for logs (no blob bytes). */
export function summarizeBlobRefForDebug(raw: unknown): string {
  if (raw === null || raw === undefined) return "null";
  if (typeof raw !== "object") return `typeof ${typeof raw}`;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  const keySample = keys.slice(0, 12).join(", ") || "(no keys)";
  const mime =
    typeof o.mimeType === "string"
      ? o.mimeType
      : `mimeType=${typeof o.mimeType}`;
  const ref = o.ref;
  const refKeys =
    ref && typeof ref === "object"
      ? Object.keys(ref as object)
          .slice(0, 8)
          .join(", ")
      : String(ref);
  const link =
    ref && typeof ref === "object"
      ? (ref as Record<string, unknown>).$link
      : undefined;
  const linkShort =
    typeof link === "string"
      ? `${link.slice(0, 16)}…`
      : link === undefined
        ? "none"
        : String(link);
  const cid = typeof o.cid === "string" ? `${o.cid.slice(0, 16)}…` : "none";
  let refExtra = "";
  if (ref && typeof ref === "object") {
    const r = ref as Record<string, unknown>;
    if (r.hash !== undefined) {
      const h = r.hash;
      if (h instanceof Uint8Array) {
        refExtra = ` ref.hash=Uint8Array(${h.byteLength})`;
      } else if (typeof h === "object" && h !== null && "length" in h) {
        refExtra = ` ref.hash=array-like(${(h as { length?: number }).length ?? "?"})`;
      } else {
        refExtra = ` ref.hash=${typeof h}`;
      }
    }
    if (r.code !== undefined || r.version !== undefined) {
      refExtra += ` code=${String(r.code)} version=${String(r.version)}`;
    }
  }
  const t = o.$type;
  return `{ $type=${t ?? "n/a"} keys=${keys.length} [${keySample}] ${mime} ref.keys=[${refKeys}] ref.$link=${linkShort} top.cid=${cid}${refExtra} }`;
}

function blobRefAcceptableForTap(raw: unknown): boolean {
  if (isBlob(raw) || isLegacyBlob(raw)) return true;
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.mimeType !== "string" || o.mimeType.length === 0) return false;
  // Accept any blob shape we can actually resolve into a CID.
  return Boolean(getBlobCidString(raw));
}

const categorySlugLexicon = z
  .union([z.array(z.string()), z.string(), z.null()])
  .transform((v): Array<string> => {
    if (v == null) return ["misc"];
    const arr = Array.isArray(v) ? v : [v];
    const out = arr.map((s) => String(s).trim()).filter(Boolean);
    return out.length > 0 ? out : ["misc"];
  });

const listingLinkLexicon = z.object({
  type: z.string().trim().max(128).optional().default("other"),
  url: z.string().trim().min(1).max(LISTING_LINK_URL_MAX_LENGTH),
  label: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return;
      const t = String(s).trim();
      if (!t) return;
      return t.slice(0, LISTING_LINK_LABEL_MAX_LENGTH);
    }),
});

const listingBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  tagline: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      const t = s == null ? "" : String(s);
      return t.trim() === "" ? "—" : t;
    }),
  description: z.string().optional(),
  externalUrl: z.string().min(1),
  icon: z.unknown(),
  heroImage: z.unknown(),
  categorySlug: categorySlugLexicon,
  screenshots: z.array(z.unknown()).optional(),
  appTags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  productAccountDid: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return;
      const t = String(s).trim();
      return t.length > 0 ? t : undefined;
    }),
  migratedFromAtUri: z
    .string()
    .optional()
    .refine((s) => !s || s.startsWith("at://"), {
      message: "migratedFromAtUri must be an at:// URI",
    }),
  links: z.array(listingLinkLexicon).max(LISTING_LINK_MAX_COUNT).optional(),
  game: z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t?.startsWith(`at://`) && t.includes(`/${GAMES_NSID.define}/`)
        ? t
        : undefined;
    }),
});

export type ListingDetailParseResult =
  | { ok: true; record: FyiAtstoreListingDetail }
  | {
      ok: false;
      reason: string;
      stage: "no_body" | "zod" | "blob_icon" | "blob_hero" | "blob_screenshot";
      zodError?: z.ZodError;
      screenshotIndex?: number;
      blobField?: "icon" | "heroImage" | "screenshots";
      blobSummary?: string;
    };

/**
 * Same as {@link parseListingDetailRecord} but returns why parsing failed (for logging).
 */
export function tryParseListingDetailRecord(
  body: Record<string, unknown> | undefined,
): ListingDetailParseResult {
  if (!body) {
    return {
      ok: false,
      reason: "record body is missing",
      stage: "no_body",
    };
  }

  const parsed = listingBodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const fieldErrors = issues.fieldErrors;
    const formErrors = issues.formErrors;
    const detail = [
      ...Object.entries(fieldErrors).flatMap(
        ([k, v]) => v?.map((m) => `${k}: ${m}`) ?? [],
      ),
      ...(formErrors ?? []),
    ].join("; ");
    return {
      ok: false,
      reason: detail || parsed.error.message,
      stage: "zod",
      zodError: parsed.error,
    };
  }

  const d = parsed.data;
  if (!blobRefAcceptableForTap(d.icon)) {
    return {
      ok: false,
      reason: `icon blob not recognized (${summarizeBlobRefForDebug(d.icon)})`,
      stage: "blob_icon",
      blobField: "icon",
      blobSummary: summarizeBlobRefForDebug(d.icon),
    };
  }
  /**
   * `heroImage` is optional in the lexicon — a record may omit it entirely. We only reject when
   * the field is present-but-malformed (e.g. wrong shape) so an undefined/null hero is treated
   * as "no hero" rather than an ingest failure.
   */
  if (d.heroImage != null && !blobRefAcceptableForTap(d.heroImage)) {
    return {
      ok: false,
      reason: `heroImage blob not recognized (${summarizeBlobRefForDebug(d.heroImage)})`,
      stage: "blob_hero",
      blobField: "heroImage",
      blobSummary: summarizeBlobRefForDebug(d.heroImage),
    };
  }

  if (d.screenshots?.length) {
    const badIdx = d.screenshots.findIndex((s) => !blobRefAcceptableForTap(s));
    if (badIdx !== -1) {
      const s = d.screenshots[badIdx];
      return {
        ok: false,
        reason: `screenshots[${badIdx}] blob not recognized (${summarizeBlobRefForDebug(s)})`,
        stage: "blob_screenshot",
        screenshotIndex: badIdx,
        blobField: "screenshots",
        blobSummary: summarizeBlobRefForDebug(s),
      };
    }
  }

  const rec: FyiAtstoreListingDetail = {
    $type: "fyi.atstore.listing.detail",
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    externalUrl: d.externalUrl,
    icon: d.icon as AtprotoBlob,
    categorySlug: d.categorySlug,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (d.heroImage != null) rec.heroImage = d.heroImage as AtprotoBlob;
  if (d.description) rec.description = d.description;
  if (d.screenshots?.length) {
    rec.screenshots = d.screenshots.filter(
      blobRefAcceptableForTap,
    ) as Array<AtprotoBlob>;
  }
  if (d.appTags?.length) rec.appTags = d.appTags;
  if (d.productAccountDid) rec.productAccountDid = d.productAccountDid;
  const migrated = d.migratedFromAtUri?.trim();
  if (migrated) rec.migratedFromAtUri = migrated;
  if (d.game) rec.game = d.game;
  if (d.links?.length) {
    const normalized = normalizeListingLinks(
      d.links.map(
        (link): ListingLink => ({
          type: link.type,
          url: link.url,
          ...(link.label ? { label: link.label } : {}),
        }),
      ),
    );
    if (normalized.length > 0) rec.links = normalized;
  }
  return { ok: true, record: rec };
}

export function parseListingDetailRecord(
  body: Record<string, unknown> | undefined,
): FyiAtstoreListingDetail | null {
  const r = tryParseListingDetailRecord(body);
  return r.ok ? r.record : null;
}

function atUriFor(did: string, rkey: string) {
  return `at://${did}/${COLLECTION.listingDetail}/${rkey}`;
}

/**
 * Verified when: trusted store publisher; ingest is a no-op confirmation of an already-verified row
 * (handler-side claim has already updated the row to this exact `repoDid`+`rkey`); or the incoming
 * record satisfies the combined claim handshake — `claimPendingForDid` set on the existing row matches
 * the ingest repo DID **and** `migratedFromAtUri` points at the row's prior `at://<atstoreDid>/...rkey`.
 * An owner-to-owner transfer passes the same handshake with lineage pointing at the previous owner's
 * record; it keeps the row's current status instead of verifying it.
 *
 * Lineage alone is intentionally insufficient: anyone can write `migratedFromAtUri` referencing a
 * known store record. The DID handshake bounds verification to the user who initiated the claim.
 */
export function resolveListingVerificationStatus(input: {
  trustedPublisher: boolean;
  record: FyiAtstoreListingDetail;
  ingestRepoDid: string;
  ingestRkey: string;
  existingClaimPendingForDid: string | null;
  existingPriorAtUri: string | null;
  existingRepoDid: string | null;
  existingRkey: string | null;
  existingVerificationStatus: string | null;
  atstoreDid: string | null;
}): "verified" | "unverified" | "rejected" {
  if (input.trustedPublisher) return "verified";

  /**
   * Admin moderation — do not downgrade via ingest; only API changes this.
   * Owner-driven resubmission flips the row to `unverified` via
   * `updateOwnedProductListing` *before* this function sees the next firehose
   * event, so this guard pinning `rejected` only fires when the row is still
   * actually rejected (i.e. owner edited the PDS record directly outside our
   * API). In that case keeping `rejected` is correct — the admin decision
   * stands until the owner goes through the in-app resubmission flow.
   */
  if (input.existingVerificationStatus === "rejected") return "rejected";

  const repoDid = input.ingestRepoDid.trim();

  /**
   * Idempotent confirmation: the claim server fn already wrote this exact (repoDid, rkey) onto the
   * row and marked it `verified`. Tap is just replaying the firehose event afterwards.
   */
  if (
    input.existingVerificationStatus === "verified" &&
    input.existingRepoDid?.trim() === repoDid &&
    input.existingRkey?.trim() === input.ingestRkey.trim()
  ) {
    return "verified";
  }

  const pendingDid = input.existingClaimPendingForDid?.trim() ?? null;
  if (!pendingDid || pendingDid !== repoDid) return "unverified";

  const migrated = input.record.migratedFromAtUri?.trim();
  if (!migrated || !input.atstoreDid) return "unverified";

  let prior: { repo: string; collection: string; rkey: string };
  try {
    prior = parseAtUriParts(migrated);
  } catch {
    return "unverified";
  }
  if (prior.collection !== COLLECTION.listingDetail) return "unverified";

  /**
   * Lineage must point at *this row's* prior record (when we know it), not just any store
   * record under the atstore DID. Without this, an attacker who knew any store rkey could forge a
   * lineage URI; the DID-pending check would still gate them, but pinning the rkey is cheap defense
   * in depth.
   */
  if (
    input.existingPriorAtUri &&
    input.existingPriorAtUri.trim() !== migrated
  ) {
    return "unverified";
  }

  if (prior.repo.trim() === input.atstoreDid.trim()) return "verified";

  /**
   * Owner-to-owner transfer (`claimProductListingToPds` transfer path): the server pins the previous
   * owner's record in `migratedFromAtUri` before writing, so it must be present here. Moving the
   * record doesn't change its review status — an unverified listing stays in the review queue.
   */
  if (!input.existingPriorAtUri) return "unverified";
  return input.existingVerificationStatus === "verified"
    ? "verified"
    : "unverified";
}

/**
 * Current `slug` of a listing.detail record on its PDS: `null` when the record is gone,
 * `undefined` when the PDS can't be reached.
 */
async function fetchLiveListingSlug(
  did: string,
  rkey: string,
): Promise<string | null | undefined> {
  const pds = await resolveAtprotoPdsBaseUrl(did);
  if (!pds) return undefined;
  try {
    const u = new URL("/xrpc/com.atproto.repo.getRecord", `${pds}/`);
    u.searchParams.set("repo", did);
    u.searchParams.set("collection", COLLECTION.listingDetail);
    u.searchParams.set("rkey", rkey);
    const res = await fetch(u, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) return undefined;
    const data = (await res.json()) as { value?: { slug?: unknown } };
    return typeof data.value?.slug === "string" ? data.value.slug : null;
  } catch {
    return undefined;
  }
}

/**
 * The upsert below matches rows by slug, but this record may already be mirrored under a different
 * slug (renamed listing). Inserting would then collide on `at_uri`, throw, and Tap would redeliver
 * the event forever — holding back that repo's later events too.
 *
 * Whether the event is a real rename or a replayed pre-rename event is decided by the record as it
 * is on the PDS right now (renames are rare, so the extra fetch is cheap). `updated_at` alone can't
 * tell: admin moderation bumps it without touching the record.
 *
 * - Live record has a different slug (or is gone): stale replay — skip so the event is acked.
 * - Live record matches and the slug is free: rename the row, then let the slug-based upsert run.
 * - Live record matches but another listing owns the slug: skip; the row keeps its slug.
 */
async function resolveRecordSlugChange(
  db: Database,
  input: { did: string; rkey: string; record: FyiAtstoreListingDetail },
): Promise<"continue" | "skip"> {
  const { did, rkey, record } = input;
  const t = schema.storeListings;
  const [row] = await db
    .select({ id: t.id, slug: t.slug, updatedAt: t.updatedAt })
    .from(t)
    .where(and(eq(t.repoDid, did), eq(t.rkey, rkey)))
    .limit(1);
  if (!row || row.slug === record.slug) return "continue";

  const liveSlug = await fetchLiveListingSlug(did, rkey);
  const isCurrent =
    liveSlug === undefined
      ? // PDS unreachable — fall back to comparing timestamps.
        new Date(record.updatedAt) > row.updatedAt
      : liveSlug === record.slug;
  if (!isCurrent) {
    console.log(
      `[tap-ingest] skip stale listing ${atUriFor(did, rkey)} — event slug=${record.slug}, live record slug=${liveSlug ?? "(unknown)"}, row slug=${row.slug}`,
    );
    return "skip";
  }

  const [taken] = await db
    .select({ id: t.id })
    .from(t)
    .where(eq(t.slug, record.slug))
    .limit(1);
  if (taken) {
    console.warn(
      `[tap-ingest] skip listing ${atUriFor(did, rkey)} — renamed to slug=${record.slug}, which another listing (${taken.id}) owns; keeping slug=${row.slug}`,
    );
    return "skip";
  }

  await db.update(t).set({ slug: record.slug }).where(eq(t.id, row.id));
  console.log(
    `[tap-ingest] renamed listing ${row.id} slug ${row.slug} → ${record.slug}`,
  );
  return "continue";
}

/**
 * Upsert `store_listings` from Tap (`fyi.atstore.listing.detail` only — does not touch `directory_listings`).
 * Resolves icon / hero / screenshots to Bluesky CDN URLs from blob refs (Kitchen-style).
 */
export async function upsertDirectoryListingFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
  record: FyiAtstoreListingDetail;
  trustedPublisher: boolean;
}) {
  const { db, did, rkey, record, trustedPublisher } = input;
  const atUri = atUriFor(did, rkey);
  const sourceUrl = record.externalUrl.trim();
  const atstoreDidRaw = process.env.ATSTORE_REPO_DID?.trim() ?? null;
  const atstoreDid = atstoreDidRaw?.startsWith("did:") ? atstoreDidRaw : null;

  const slugChange = await resolveRecordSlugChange(db, {
    did,
    rkey,
    record,
  });
  if (slugChange === "skip") return;

  const [existingRow] = await db
    .select({
      claimPendingForDid: schema.storeListings.claimPendingForDid,
      migratedFromAtUri: schema.storeListings.migratedFromAtUri,
      priorAtUris: schema.storeListings.priorAtUris,
      productAccountDid: schema.storeListings.productAccountDid,
      repoDid: schema.storeListings.repoDid,
      rkey: schema.storeListings.rkey,
      verificationStatus: schema.storeListings.verificationStatus,
      atUri: schema.storeListings.atUri,
      gameDefineAtUri: schema.storeListings.gameDefineAtUri,
    })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.slug, record.slug))
    .limit(1);

  /**
   * A claim or transfer moved this listing to another repo, but the record it moved from can still
   * exist (the store copy after a claim; a previous owner's copy if cleanup failed). A replay of it
   * would otherwise match by slug and hand the row back to the old repo.
   */
  if (
    existingRow &&
    existingRow.repoDid !== did &&
    (existingRow.migratedFromAtUri === atUri ||
      existingRow.priorAtUris.includes(atUri))
  ) {
    console.log(
      `[tap-ingest] skip superseded listing ${atUri} slug=${record.slug} — row now lives at ${existingRow.atUri ?? "(unknown)"}`,
    );
    return;
  }

  /**
   * Game-only rows (backed by `games.atmosphere.define`) share the slug namespace. A listing.detail
   * may only take one over when it is from a trusted publisher or explicitly declares that game —
   * otherwise any record reusing the slug would hijack the game's page, reviews, and favorites.
   */
  if (
    existingRow?.gameDefineAtUri &&
    existingRow.atUri === existingRow.gameDefineAtUri &&
    !trustedPublisher &&
    record.game !== existingRow.gameDefineAtUri
  ) {
    console.warn(
      `[tap-ingest] skip listing ${atUri} slug=${record.slug} — slug belongs to game ${existingRow.gameDefineAtUri}`,
    );
    return;
  }
  const existingClaimPendingForDid =
    existingRow?.claimPendingForDid?.trim() ?? null;
  const existingPriorAtUri = existingRow?.migratedFromAtUri?.trim() ?? null;
  const existingRepoDid = existingRow?.repoDid ?? null;
  const existingRkey = existingRow?.rkey ?? null;
  const existingVerificationStatus = existingRow?.verificationStatus ?? null;

  let verificationStatus = resolveListingVerificationStatus({
    trustedPublisher,
    record,
    ingestRepoDid: did,
    ingestRkey: rkey,
    existingClaimPendingForDid,
    existingPriorAtUri,
    existingRepoDid,
    existingRkey,
    existingVerificationStatus,
    atstoreDid,
  });
  if (
    verificationStatus !== "rejected" &&
    (process.env.LOCAL_VERIFY_ALL_TAP_LISTINGS === "1" ||
      process.env.LOCAL_VERIFY_ALL_TAP_LISTINGS === "true")
  ) {
    verificationStatus = "verified";
  }

  /** Successful claim handshake — clear the pending marker so it cannot be reused. */
  const claimPendingForDidNext =
    verificationStatus === "verified" && existingClaimPendingForDid
      ? null
      : (existingClaimPendingForDid ?? null);
  const now = new Date();
  const appTags = record.appTags ?? [];
  const categorySlugs = record.categorySlug;

  const iconUrl = blobLikeToBskyCdnUrl(record.icon, did);
  const heroImageUrl = blobLikeToBskyCdnUrl(record.heroImage, did);
  const screenshotUrls = (record.screenshots ?? []).flatMap((b) => {
    const url = blobLikeToBskyCdnUrl(b, did);
    return url ? [url] : [];
  });

  const iconCid = getBlobCidString(record.icon);
  const heroCid = getBlobCidString(record.heroImage);
  const shotsParsed = (record.screenshots ?? []).length;
  console.log(
    `[tap-ingest] slug=${record.slug} rkey=${rkey} images: icon=${iconUrl ? `cdn(${iconCid?.slice(0, 12)}…)` : `MISS:${explainMissingBlobUrl(record.icon)}`} hero=${heroImageUrl ? `cdn(${heroCid?.slice(0, 12)}…)` : `MISS:${explainMissingBlobUrl(record.heroImage)}`} screenshots=${screenshotUrls.length}/${shotsParsed}`,
  );

  const productDid = record.productAccountDid?.trim() ?? null;
  let productAccountHandle: string | null = null;
  if (productDid) {
    const profile = await fetchBlueskyPublicProfileFields(productDid);
    const h = profile?.handle?.trim();
    productAccountHandle = h && h.length > 0 ? h : null;
  }

  const migratedFromAtUri = record.migratedFromAtUri?.trim() ?? null;
  const links = normalizeListingLinks(record.links ?? null);

  try {
    await db
      .insert(schema.storeListings)
      .values({
        sourceUrl,
        name: record.name,
        slug: record.slug,
        externalUrl: record.externalUrl,
        iconUrl,
        screenshotUrls,
        tagline: record.tagline,
        fullDescription: record.description,
        categorySlugs,
        heroImageUrl,
        atUri,
        repoDid: did,
        rkey,
        sourceAccountDid: did,
        verificationStatus,
        appTags,
        links,
        productAccountDid: productDid,
        productAccountHandle,
        migratedFromAtUri,
        claimPendingForDid: claimPendingForDidNext,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.storeListings.slug,
        set: {
          sourceUrl,
          name: record.name,
          externalUrl: record.externalUrl,
          iconUrl,
          heroImageUrl,
          screenshotUrls,
          tagline: record.tagline,
          fullDescription: record.description ?? null,
          categorySlugs,
          atUri,
          repoDid: did,
          rkey,
          sourceAccountDid: did,
          verificationStatus,
          appTags,
          links,
          productAccountDid: productDid,
          productAccountHandle,
          migratedFromAtUri,
          claimPendingForDid: claimPendingForDidNext,
          updatedAt: now,
        },
      });
  } catch (error) {
    /**
     * Unique constraint on `source_url` only. The upsert resolves slug collisions, but two
     * different PDS users can publish listings with the same `externalUrl` and different slugs
     * (e.g. both pointing at `https://example.com`). The first row wins ownership of the URL;
     * the second insert hits `store_listings_source_url_idx` and Postgres returns 23505.
     *
     * Skip the offending event with a warning instead of throwing — otherwise tap-consumer
     * crashes its WebSocket loop on every duplicate-URL record it sees.
     */
    if (isSourceUrlUniqueViolation(error)) {
      const [conflictRow] = await db
        .select({
          atUri: schema.storeListings.atUri,
          slug: schema.storeListings.slug,
          repoDid: schema.storeListings.repoDid,
        })
        .from(schema.storeListings)
        .where(eq(schema.storeListings.sourceUrl, sourceUrl))
        .limit(1);
      console.warn(
        `[tap-ingest] skip listing ${atUri} slug=${record.slug} — sourceUrl=${sourceUrl} already owned by ${conflictRow?.atUri ?? "(unknown row)"} slug=${conflictRow?.slug ?? "?"} repoDid=${conflictRow?.repoDid ?? "?"}`,
      );
      return;
    }
    throw error;
  }

  const [saved] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.slug, record.slug))
    .limit(1);

  if (saved?.id && record.game && verificationStatus === "verified") {
    try {
      await linkListingToGameDefine({
        db,
        listingId: saved.id,
        defineAtUri: record.game,
      });
    } catch (linkError) {
      console.warn(
        `[tap-ingest] game link failed slug=${record.slug} game=${record.game}`,
        linkError,
      );
    }
  }

  /** Product account replaced by a record edited outside the app (in-app edits prune directly). */
  if (
    saved?.id &&
    existingRow &&
    (existingRow.productAccountDid ?? null) !== productDid
  ) {
    try {
      await pruneReplacedProductAccountMentions(db, saved.id);
    } catch (pruneError) {
      console.warn(
        `[tap-ingest] mention prune failed slug=${record.slug} id=${saved.id}`,
        pruneError,
      );
    }
  }

  if (saved?.id) {
    try {
      await refreshListingPageSnapshot(db, saved.id);
    } catch (refreshError) {
      console.warn(
        `[tap-ingest] page snapshot refresh failed slug=${record.slug} id=${saved.id}`,
        refreshError,
      );
    }
  }
}

/**
 * Detect a Postgres `unique_violation` (SQLSTATE 23505) on `store_listings_source_url_idx`.
 * Drizzle wraps driver errors in `DrizzleQueryError`, so the Postgres error lives on `.cause`.
 */
function isSourceUrlUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as {
      code?: unknown;
      constraint_name?: unknown;
      cause?: unknown;
    };
    if (
      e.code === "23505" &&
      e.constraint_name === "store_listings_source_url_idx"
    ) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

/**
 * Remove the mirrored `store_listings` row when the listing record is deleted on the PDS (matched by repo + rkey).
 *
 * Skips the delete when some row records `migratedFromAtUri` equal to this record's AT URI — that means a product
 * claim repointed the mirror to the owner's repo first; a racing Tap delete for the **old** store record must not
 * wipe the surviving directory row (see claim flow in `claimProductListingToPds`).
 */
export async function markListingRemovedFromTap(input: {
  db: Database;
  did: string;
  rkey: string;
}) {
  const { db, did, rkey } = input;
  const deletedAtUri = atUriFor(did, rkey);

  const [superseded] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(
      or(
        eq(schema.storeListings.migratedFromAtUri, deletedAtUri),
        sql`${deletedAtUri} = ANY(${schema.storeListings.priorAtUris})`,
      ),
    )
    .limit(1);

  if (superseded) {
    console.log(
      `[tap-ingest] skip listing delete for ${deletedAtUri} — URI recorded as migratedFromAtUri (claim / lineage); mirror row must stay`,
    );
    return;
  }

  await db
    .delete(schema.storeListings)
    .where(
      and(
        eq(schema.storeListings.repoDid, did),
        eq(schema.storeListings.rkey, rkey),
      ),
    );
}
