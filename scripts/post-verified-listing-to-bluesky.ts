#!/usr/bin/env node
/**
 * Post one verified listing to Bluesky that has never been posted about before.
 *
 * Picks a random `store_listings` row with `verification_status = 'verified'` AND either an
 * admin approval event or a confirmed product-owner claim (most of the original bulk-imported
 * directory defaults to `verified` without either — that default alone isn't enough to post
 * about), that has no row yet in `store_listing_bluesky_posts` (unique on `store_listing_id`,
 * so a listing can never be posted about twice). Writes a short LLM-generated blurb and posts
 * it as `app.bsky.feed.post` from the AT Store account with a link-card embed back to the
 * listing's product page.
 */
// Railway cron (suggested): once every other day, one post per run — `0 15 */2 * *` (15:00 UTC every 2 days).
/**
 * Env:
 *   DATABASE_URL                                  (required)
 *   ATSTORE_IDENTIFIER / ATSTORE_APP_PASSWORD     (required; store account app password)
 *   ATSTORE_SERVICE=https://bsky.social           (optional)
 *   ATSTORE_WEBSITE_URL=https://at.store          (optional; used to build the listing URL)
 *   ANTHROPIC_API_KEY or ANTHROPIC_KEY            (required unless --text is passed)
 *   ANTHROPIC_MODEL                               (optional; default claude-haiku-4-5)
 *
 * CLI (override defaults):
 *   --dry-run          Print the chosen listing and generated post text; no post or DB write
 *   --text=...          Use this post body instead of the LLM (URL/mention are added after)
 */
import "dotenv/config";

import type { Database } from "#/db/index.server";

import { Anthropic } from "@anthropic-ai/sdk";
import * as schema from "#/db/schema";
import { uploadImageBlob } from "#/lib/atproto/blob-upload";
import {
  assembleListingPromoPost,
  maxPromoBodyGraphemes,
} from "#/lib/atproto/bluesky-facets";
import { createAtstorePublishClient } from "#/lib/atproto/publish-directory-listing";
import { createBlueskyFeedPostRecord } from "#/lib/atproto/repo-records";
import { fetchBlueskyHandleForDid } from "#/lib/bluesky-public-profile";
import { and, eq, exists, isNotNull, isNull, or, sql } from "drizzle-orm";

const DEFAULT_MODEL = "claude-haiku-4-5";

function ts(): string {
  return new Date().toISOString();
}

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
) {
  const base = `[post-verified-listing-to-bluesky] ${ts()} [${level}] ${msg}`;
  const out = extra && Object.keys(extra).length > 0 ? [base, extra] : [base];
  if (level === "error") console.error(...out);
  else if (level === "warn") console.warn(...out);
  else console.log(...out);
}

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function listingUrl(listing: { slug: string }): string {
  const base =
    process.env.ATSTORE_WEBSITE_URL?.trim().replace(/\/$/, "") ||
    "https://at.store";
  return `${base}/products/${listing.slug}`;
}

const UNICODE_DASHES = /[‐-―−﹘﹣－]/g;

/** Enforce promo style: no emoji, no dashes of any kind (LLM tends to overuse both). */
function sanitizePromoPostText(text: string): string {
  return text
    .replace(UNICODE_DASHES, ", ")
    .replaceAll("-", " ")
    .replaceAll(/,(\s*,)+/g, ",")
    .replaceAll(/\s+,/g, ",")
    .replaceAll(/,\s*/g, ", ")
    .replaceAll(/\p{Extended_Pictographic}/gu, "")
    .replaceAll(/ +/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateListingPromoPost(listing: {
  name: string;
  tagline: string | null;
  fullDescription: string | null;
  categorySlugs: Array<string>;
  appTags: Array<string>;
  productAccountHandle: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    throw new Error(
      "Set ANTHROPIC_API_KEY (or ANTHROPIC_KEY), or pass --text with post copy.",
    );
  }
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const maxBodyGraphemes = maxPromoBodyGraphemes(listing.productAccountHandle);

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: 300,
    temperature: 0.4,
    system: `You are the social voice for AT Store (https://at.store), a directory of apps and tools built on the AT Protocol (the tech behind Bluesky).

Write ONE Bluesky post announcing a newly verified listing. Requirements:
- Plain text only, no markdown
- One or two short sentences, ending on a complete sentence
- At most ${maxBodyGraphemes} characters
- Do not include a URL or @mention (those are added automatically after)
- Warm and informative, not salesy or corporate
- Do not say you are AI or a bot
- No emoji
- No dashes of any kind (hyphen, em dash, en dash); use commas and periods instead
- Mention the product name naturally`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          name: listing.name,
          tagline: listing.tagline,
          description: listing.fullDescription,
          categories: listing.categorySlugs,
          tags: listing.appTags,
        }),
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();
  if (!text) {
    throw new Error("Anthropic returned an empty promo post");
  }
  return text;
}

type Candidate = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  fullDescription: string | null;
  categorySlugs: Array<string>;
  appTags: Array<string>;
  iconUrl: string | null;
  screenshotUrls: Array<string>;
  productAccountDid: string | null;
  productAccountHandle: string | null;
};

async function pickCandidate(db: Database): Promise<Candidate | null> {
  const rows = await db
    .select({
      id: schema.storeListings.id,
      name: schema.storeListings.name,
      slug: schema.storeListings.slug,
      tagline: schema.storeListings.tagline,
      fullDescription: schema.storeListings.fullDescription,
      categorySlugs: schema.storeListings.categorySlugs,
      appTags: schema.storeListings.appTags,
      iconUrl: schema.storeListings.iconUrl,
      screenshotUrls: schema.storeListings.screenshotUrls,
      productAccountDid: schema.storeListings.productAccountDid,
      productAccountHandle: schema.storeListings.productAccountHandle,
    })
    .from(schema.storeListings)
    .leftJoin(
      schema.storeListingBlueskyPosts,
      eq(
        schema.storeListings.id,
        schema.storeListingBlueskyPosts.storeListingId,
      ),
    )
    .where(
      and(
        eq(schema.storeListings.verificationStatus, "verified"),
        isNull(schema.storeListingBlueskyPosts.storeListingId),
        or(
          isNotNull(schema.storeListings.claimedByDid),
          exists(
            db
              .select({ n: sql`1` })
              .from(schema.storeListingVerificationApprovalEvents)
              .where(
                eq(
                  schema.storeListingVerificationApprovalEvents.storeListingId,
                  schema.storeListings.id,
                ),
              ),
          ),
        ),
      ),
    )
    .orderBy(sql`random()`)
    .limit(1);

  return rows[0] ?? null;
}

async function fetchThumbBytes(
  url: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim();
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return null;
    return { bytes, mimeType: mimeType || "image/png" };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const manualText = parseFlag("text");

  if (
    !manualText &&
    !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY)
  ) {
    log(
      "error",
      "Set ANTHROPIC_API_KEY (or ANTHROPIC_KEY), or pass --text=... with post copy.",
    );
    process.exit(1);
  }

  const { db, dbClient } = await import("#/db/index.server");

  const listing = await pickCandidate(db);
  if (!listing) {
    log("info", "nothing_to_do", {
      reason: "no verified listing without a Bluesky post",
    });
    await dbClient.end({ timeout: 5 }).catch(() => {});
    return;
  }

  const url = listingUrl(listing);

  const handle =
    listing.productAccountHandle ??
    (listing.productAccountDid
      ? await fetchBlueskyHandleForDid(listing.productAccountDid)
      : null);
  const mention =
    handle && listing.productAccountDid
      ? { did: listing.productAccountDid, handle }
      : null;

  const rawBody = manualText ?? (await generateListingPromoPost(listing));
  const body = sanitizePromoPostText(rawBody);
  const { text, facets } = assembleListingPromoPost(body, mention);

  if (dryRun) {
    log("info", "preview", {
      listing: listing.name,
      slug: listing.slug,
      mention: mention?.handle ?? null,
      url,
      text,
    });
    await dbClient.end({ timeout: 5 }).catch(() => {});
    return;
  }

  const { client, repoDid } = await createAtstorePublishClient();

  const thumbSource = listing.iconUrl ?? listing.screenshotUrls[0] ?? null;
  const thumb = thumbSource ? await fetchThumbBytes(thumbSource) : null;
  const thumbBlob = thumb
    ? await uploadImageBlob(client, thumb.bytes, thumb.mimeType)
    : undefined;

  const { uri, cid } = await createBlueskyFeedPostRecord(client, repoDid, {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    facets,
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: url,
        title: listing.name,
        description: listing.tagline ?? "",
        thumb: thumbBlob,
      },
    },
  });

  await db.insert(schema.storeListingBlueskyPosts).values({
    storeListingId: listing.id,
    postUri: uri,
    postCid: cid,
  });

  const rkey = uri.split("/").at(-1);
  log("info", "posted", {
    listing: listing.name,
    url,
    permalink: rkey ? `https://bsky.app/profile/${repoDid}/post/${rkey}` : null,
  });

  await dbClient.end({ timeout: 5 }).catch(() => {});
}

main().catch((error: unknown) => {
  log("error", "fatal", {
    error:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  process.exit(1);
});
