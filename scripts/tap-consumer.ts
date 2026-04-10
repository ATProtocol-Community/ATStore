#!/usr/bin/env node
/**
 * Long-running Tap consumer: WebSocket to your Tap deployment, logs record events,
 * optionally upserts `directory_listings` for `fyi.atstore.listing.detail`.
 *
 * Env:
 *   TAP_URL=http://127.0.0.1:2480
 *   TAP_ADMIN_PASSWORD=          # if Tap admin API is protected
 *   TAP_TRACK_DIDS=did:plc:...,did:plc:...   # passed to Tap /repos/add on startup
 *   TAP_SYNC_DB=true             # write Postgres (requires DATABASE_URL)
 *   TAP_TRUSTED_DIDS=did:plc:... # publishers whose listings get verification_status=verified
 */
import 'dotenv/config'

import { SimpleIndexer, Tap } from '@atproto/tap'
import type { IdentityEvent, RecordEvent } from '@atproto/tap'

import type { Database } from '../src/db/index.server'
import { COLLECTION, NSID } from '../src/lib/atproto/nsids'
import {
  markListingRemovedFromTap,
  parseListingDetailRecord,
  upsertDirectoryListingFromTap,
} from '../src/lib/atproto/tap-listing-sync'

function parseDidList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatRecordLog(evt: RecordEvent) {
  const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`
  if (evt.action === 'delete') {
    return `${evt.action} ${uri}`
  }
  return `${evt.action} ${uri} live=${evt.live}`
}

async function main() {
  const url = process.env.TAP_URL?.trim() || 'http://127.0.0.1:2480'
  const adminPassword = process.env.TAP_ADMIN_PASSWORD?.trim()
  const trackDids = parseDidList(process.env.TAP_TRACK_DIDS)
  const trusted = new Set(parseDidList(process.env.TAP_TRUSTED_DIDS))
  const syncDb = process.env.TAP_SYNC_DB === '1' || process.env.TAP_SYNC_DB === 'true'

  let dbCache: Database | undefined
  async function getDb(): Promise<Database> {
    dbCache ??= (await import('../src/db/index.server')).db
    return dbCache
  }

  const tap = new Tap(url, adminPassword ? { adminPassword } : {})

  const indexer = new SimpleIndexer()

  indexer.identity(async (evt: IdentityEvent) => {
    console.log(
      `[identity] ${evt.did} handle=${evt.handle} status=${evt.status} active=${evt.isActive}`,
    )
  })

  indexer.record(async (evt: RecordEvent) => {
    console.log(`[record] ${formatRecordLog(evt)}`)

    if (evt.collection === NSID.profile) {
      return
    }

    if (evt.collection !== COLLECTION.listingDetail) {
      return
    }

    if (!syncDb) {
      return
    }

    const db = await getDb()

    if (evt.action === 'delete') {
      await markListingRemovedFromTap({
        db,
        did: evt.did,
        rkey: evt.rkey,
      })
      return
    }

    const raw = evt.record
    const body =
      raw === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(raw)) as Record<string, unknown>)
    const parsed = parseListingDetailRecord(body)
    if (!parsed) {
      console.warn(
        `[tap] skip invalid listing.detail payload rkey=${evt.rkey} did=${evt.did}`,
      )
      return
    }

    await upsertDirectoryListingFromTap({
      db,
      did: evt.did,
      rkey: evt.rkey,
      record: parsed,
      trustedPublisher: trusted.has(evt.did),
    })
  })

  indexer.error((err: Error) => {
    console.error('[tap] error', err)
  })

  if (trackDids.length > 0) {
    console.log(`[tap] addRepos ${trackDids.join(', ')}`)
    await tap.addRepos(trackDids)
  } else {
    console.log(
      '[tap] TAP_TRACK_DIDS empty — ensure Tap already tracks repos, or set TAP_TRACK_DIDS.',
    )
  }

  const channel = tap.channel(indexer)

  const shutdown = async () => {
    console.log('[tap] shutting down…')
    await channel.destroy()
    if (syncDb) {
      const { dbClient } = await import('../src/db/index.server')
      await dbClient.end({ timeout: 5 })
    }
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())

  console.log(`[tap] connected to ${url} (sync db: ${syncDb})`)
  await channel.start()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
