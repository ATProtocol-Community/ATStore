#!/usr/bin/env node
/**
 * Publish a `store_listings` row to the AT Store repo as `fyi.atstore.listing.detail`.
 *
 * Requires `ATSTORE_IDENTIFIER`, `ATSTORE_APP_PASSWORD`, and `DATABASE_URL`.
 *
 * The Postgres mirror is **not** updated here — Tap ingest will pick up the record.
 *
 *   pnpm listing:publish-store kich
 *   pnpm listing:publish-store <uuid>
 */
import 'dotenv/config'

import { eq, ilike } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function main() {
  const arg = (process.argv[2] ?? 'kich').trim()
  if (!arg) {
    console.error('Usage: pnpm listing:publish-store <slug|listing-uuid>')
    process.exitCode = 1
    return
  }

  const byId = UUID_RE.test(arg)
  let rows = await db
    .select()
    .from(storeListings)
    .where(byId ? eq(storeListings.id, arg) : eq(storeListings.slug, arg))
    .limit(2)

  if (rows.length === 0 && !byId) {
    rows = await db
      .select()
      .from(storeListings)
      .where(ilike(storeListings.slug, `%${arg}%`))
      .limit(2)
  }

  if (rows.length === 0) {
    console.error(`No store_listings row for ${byId ? 'id' : 'slug'}=${arg}`)
    process.exitCode = 1
    return
  }
  if (rows.length > 1) {
    console.error(
      `Multiple listings match "${arg}"; pass an exact slug or listing UUID.`,
    )
    process.exitCode = 1
    return
  }

  const row = rows[0]!

  const { uri } = await publishDirectoryListingDetail(row)
  console.log(`Published ${row.slug}: ${uri}`)
  console.log('Postgres will update when Tap ingests this record.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
