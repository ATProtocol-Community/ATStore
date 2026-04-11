#!/usr/bin/env node
/**
 * One-off: canonical product URL + official Bluesky (`productAccountDid`) for
 * "Bluesky Feed Creator" — profile https://bsky.app/profile/blueskyfeedcreator.com
 *
 * Requires DATABASE_URL, ATSTORE_IDENTIFIER, ATSTORE_APP_PASSWORD.
 */
import 'dotenv/config'

import { eq, or } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import {
  fetchBlueskyPublicProfileFields,
  resolveBlueskyHandleToDid,
} from '../src/lib/bluesky-public-profile'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

const SOURCE_URL = 'https://blueskydirectory.com/utilities/bluesky-feed-creator'
const EXTERNAL_URL = 'https://blueskyfeedcreator.com/'
/** Custom-domain Bluesky handle for this product (see bsky.app/profile/...). */
const PRODUCT_BSKY_HANDLE = 'blueskyfeedcreator.com'

async function main() {
  const [row] = await db
    .select()
    .from(storeListings)
    .where(
      or(
        eq(storeListings.sourceUrl, SOURCE_URL),
        eq(storeListings.name, 'Bluesky Feed Creator'),
      ),
    )
    .limit(1)

  if (!row) {
    console.error(
      'No store_listings row found (source_url or name Bluesky Feed Creator).',
    )
    process.exitCode = 1
    return
  }

  const productDid = await resolveBlueskyHandleToDid(PRODUCT_BSKY_HANDLE)
  if (!productDid) {
    console.error(
      `Could not resolve Bluesky handle "${PRODUCT_BSKY_HANDLE}" to a DID.`,
    )
    process.exitCode = 1
    return
  }

  const profile = await fetchBlueskyPublicProfileFields(productDid)
  const productHandle =
    profile?.handle?.trim() && profile.handle.length > 0
      ? profile.handle.trim()
      : PRODUCT_BSKY_HANDLE

  await publishDirectoryListingDetail(row, {
    externalUrl: EXTERNAL_URL,
    productAccountDid: productDid,
  })

  const now = new Date()
  await db
    .update(storeListings)
    .set({
      externalUrl: EXTERNAL_URL,
      productAccountDid: productDid,
      productAccountHandle: productHandle,
      updatedAt: now,
    })
    .where(eq(storeListings.id, row.id))

  console.log(
    `Updated listing ${row.slug}: external_url → ${EXTERNAL_URL}; product account ${productDid} (${productHandle}) (PDS + Postgres).`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
