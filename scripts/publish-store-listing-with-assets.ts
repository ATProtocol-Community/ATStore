#!/usr/bin/env node
import 'dotenv/config'

import { eq, ilike } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function main() {
  const idOrSlug = (process.argv[2] ?? '').trim()
  const iconUrl = (process.argv[3] ?? '').trim()
  const heroImageUrl = (process.argv[4] ?? '').trim()

  if (!idOrSlug || !iconUrl || !heroImageUrl) {
    console.error(
      'Usage: pnpm tsx scripts/publish-store-listing-with-assets.ts <slug|uuid> <iconUrl> <heroImageUrl>',
    )
    process.exitCode = 1
    return
  }

  const byId = UUID_RE.test(idOrSlug)
  let rows = await db
    .select()
    .from(storeListings)
    .where(byId ? eq(storeListings.id, idOrSlug) : eq(storeListings.slug, idOrSlug))
    .limit(2)

  if (rows.length === 0 && !byId) {
    rows = await db
      .select()
      .from(storeListings)
      .where(ilike(storeListings.slug, `%${idOrSlug}%`))
      .limit(2)
  }

  if (rows.length === 0) {
    throw new Error(`No store_listings row found for "${idOrSlug}"`)
  }
  if (rows.length > 1) {
    throw new Error(`Multiple rows matched "${idOrSlug}"; pass exact slug or UUID.`)
  }

  const row = rows[0]!
  const { uri } = await publishDirectoryListingDetail(row, {
    iconUrl,
    heroImageUrl,
    screenshotUrls: [],
  })
  console.log(`Published ${row.slug}: ${uri}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
