#!/usr/bin/env node
/**
 * Historical script for taxonomy columns (`raw_category_hint`, `scope`, etc.)
 * on the legacy `directory_listings` table. Those columns were not carried over
 * to `store_listings`; taxonomy lives elsewhere now (categories/tags).
 *
 * Kept so `pnpm backfill:listing-taxonomy` fails loudly instead of breaking TypeScript.
 */
import 'dotenv/config'

console.error(
  'backfill-listing-taxonomy is obsolete: store_listings has no taxonomy metadata columns.',
)
process.exitCode = 1
