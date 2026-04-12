#!/usr/bin/env node
/**
 * Recompute `favorite_count`, mention windows, and `trending_score` for all listings.
 * Run after migration `0020_store_listing_trending` or when tuning weights.
 */
import 'dotenv/config'

import * as schema from '#/db/schema'
import { recomputeListingTrending } from '#/lib/trending/recompute-listing-trending'

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[backfill:trending] DATABASE_URL is required.')
    process.exit(1)
  }

  const { db } = await import('#/db/index.server')

  const rows = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)

  console.log(`[backfill:trending] recomputing ${String(rows.length)} listings…`)

  let i = 0
  for (const row of rows) {
    await recomputeListingTrending(db, row.id)
    i += 1
    if (i % 200 === 0) {
      console.log(`[backfill:trending] ${String(i)}/${String(rows.length)}`)
    }
  }

  console.log('[backfill:trending] done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
