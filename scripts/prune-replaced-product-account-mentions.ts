#!/usr/bin/env node
/**
 * Drop stored handle mentions of a listing's *previous* product account (one-off cleanup for
 * listings whose product account changed before the app pruned them on save). Only run it for
 * listings where the account itself was replaced — after a handle rename, old-handle mentions are
 * still mentions of the product.
 *
 *   pnpm listing:prune-replaced-account-mentions -- --slug=livtet
 */
import "dotenv/config";
import { refreshListingPageSnapshot } from "#/lib/listing-page-snapshot";
import { pruneReplacedProductAccountMentions } from "#/lib/trending/prune-replaced-product-account-mentions";
import { eq } from "drizzle-orm";

function slugArg(): string | null {
  const raw = process.argv.find((a) => a.startsWith("--slug="));
  if (!raw) return null;
  const value = raw.slice("--slug=".length).trim();
  return value.length > 0 ? value : null;
}

async function main() {
  const slug = slugArg();
  if (!slug) {
    console.error(
      "[prune-replaced-account-mentions] --slug=<slug> is required",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[prune-replaced-account-mentions] DATABASE_URL is required");
    process.exit(1);
  }

  const { db, dbClient } = await import("#/db/index.server");
  const schema = await import("#/db/schema");

  try {
    const [listing] = await db
      .select({ id: schema.storeListings.id })
      .from(schema.storeListings)
      .where(eq(schema.storeListings.slug, slug))
      .limit(1);
    if (!listing) {
      console.error(
        `[prune-replaced-account-mentions] no listing for slug=${slug}`,
      );
      process.exit(1);
    }

    const dropped = await pruneReplacedProductAccountMentions(db, listing.id);
    await refreshListingPageSnapshot(db, listing.id);
    console.log(
      `[prune-replaced-account-mentions] slug=${slug} dropped ${String(dropped)} mention(s)`,
    );
  } finally {
    await dbClient.end({ timeout: 5 });
  }
}

void main();
