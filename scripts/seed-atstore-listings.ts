#!/usr/bin/env node
/**
 * Create `fyi.atstore.listing.detail` records on the AT Store account for rows missing `at_uri`.
 * Optionally ensures `fyi.atstore.profile` (self).
 *
 * Env: ATSTORE_IDENTIFIER, ATSTORE_APP_PASSWORD, optional ATSTORE_SERVICE,
 * optional ATSTORE_PROFILE_DISPLAY_NAME (default "AT Store").
 */
import 'dotenv/config'
import { eq, isNull } from 'drizzle-orm'

import { db } from '../src/db/index.server'
import * as schema from '../src/db/schema'
import { parseAtUri } from '../src/lib/atproto/at-uri'
import { directoryListingToDetailRecord } from '../src/lib/atproto/listing-record'
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
  const pending = await db
    .select()
    .from(table)
    .where(isNull(table.atUri))
    .orderBy(table.slug)

  let okCount = 0
  for (const row of pending) {
    const record = directoryListingToDetailRecord(row)
    try {
      const { uri } = await createListingDetailRecord(client, repo, record)
      const parsed = parseAtUri(uri)
      if (!parsed) {
        throw new Error(`Bad at-uri: ${uri}`)
      }
      await db
        .update(table)
        .set({
          atUri: uri,
          repoDid: parsed.repo,
          rkey: parsed.rkey,
          sourceAccountDid: repo,
          heroImageUrl: record.heroImage,
          updatedAt: new Date(),
        })
        .where(eq(table.id, row.id))
      console.log(`${row.slug} -> ${uri}`)
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
