#!/usr/bin/env node
/**
 * Create `fyi.atstore.listing.detail` records on the AT Store account for rows missing `at_uri`.
 * Uploads icon, hero, and screenshots via `com.atproto.repo.uploadBlob` (Kitchen-style) before createRecord.
 *
 * Env: ATSTORE_IDENTIFIER, ATSTORE_APP_PASSWORD, optional ATSTORE_SERVICE,
 * optional ATSTORE_PROFILE_DISPLAY_NAME (default "AT Store").
 * Optional: ATSTORE_SEED_LIMIT=N — only process the first N pending rows (e.g. 1 for a smoke test).
 *
 * Does not write Postgres: Tap ingest updates `directory_listings` after records appear on the PDS.
 */
import 'dotenv/config'
import { isNull } from 'drizzle-orm'

import { db } from '../src/db/index.server'
import * as schema from '../src/db/schema'
import { buildListingDetailRecordWithBlobs } from '../src/lib/atproto/listing-record'
import {
  createListingDetailRecord,
  putProfileSelfRecord,
} from '../src/lib/atproto/repo-records'
import { Client, CredentialManager } from '@atcute/client'

async function main() {
  const identifier = process.env.ATSTORE_IDENTIFIER?.trim()
  const password = process.env.ATSTORE_APP_PASSWORD?.trim()
  if (!identifier || !password) {
    console.error(
      'Set ATSTORE_IDENTIFIER and ATSTORE_APP_PASSWORD (app password for the @store account).',
    )
    process.exit(1)
  }

  const limitRaw = process.env.ATSTORE_SEED_LIMIT?.trim()
  const limit =
    limitRaw && /^\d+$/.test(limitRaw) ? Math.max(0, parseInt(limitRaw, 10)) : undefined

  const service = process.env.ATSTORE_SERVICE?.trim() || 'https://bsky.social'
  const displayName =
    process.env.ATSTORE_PROFILE_DISPLAY_NAME?.trim() || 'AT Store'

  const manager = new CredentialManager({ service })
  await manager.login({ identifier, password })
  const session = manager.session
  if (!session?.did) {
    console.error('Login failed.')
    process.exit(1)
  }

  const repo = session.did
  const client = new Client({ handler: manager })

  await putProfileSelfRecord(client, repo, {
    $type: 'fyi.atstore.profile',
    displayName,
    description: 'Directory of apps and protocol tooling for the AT Protocol ecosystem.',
    website: process.env.ATSTORE_WEBSITE_URL?.trim() || 'https://at.store',
  })
  console.log(`Ensured fyi.atstore.profile on ${repo}`)

  const table = schema.directoryListings
  const allPending = await db
    .select()
    .from(table)
    .where(isNull(table.atUri))
    .orderBy(table.slug)

  const pending =
    limit !== undefined ? allPending.slice(0, limit) : allPending

  if (limit !== undefined) {
    console.log(
      `ATSTORE_SEED_LIMIT=${limit} — processing up to ${limit} pending row(s).`,
    )
  }

  let okCount = 0
  for (const row of pending) {
    try {
      const { record } = await buildListingDetailRecordWithBlobs(client, row)
      const { uri } = await createListingDetailRecord(client, repo, record)
      console.log(`${row.slug} -> ${uri} (Tap will sync Postgres)`)
      okCount += 1
    } catch (err) {
      console.error(`Failed ${row.slug}:`, err)
    }
  }

  console.log(`Seeded ${okCount} / ${pending.length} listing record(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
