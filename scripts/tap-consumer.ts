#!/usr/bin/env node
/**
 * Long-running Tap consumer: WebSocket to your Tap deployment, logs record events,
 * optionally upserts `store_listings` only for `fyi.atstore.listing.detail` (does not write `directory_listings`).
 *
 * Env:
 *   TAP_URL=http://127.0.0.1:2480
 *   TAP_ADMIN_PASSWORD=          # if Tap admin API is protected
 *   TAP_TRACK_DIDS=did:plc:...,did:plc:...   # passed to Tap /repos/add on startup
 *   TAP_SYNC_DB=true             # write Postgres (requires DATABASE_URL)
 *   TAP_TRUSTED_DIDS=did:plc:... # publishers whose listings get verification_status=verified
 *   TAP_VERBOSE=1                # log ignored fyi.atstore.* collections, extra record fields
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

function isVerbose() {
  const v = process.env.TAP_VERBOSE?.trim().toLowerCase()
  return v === '1' || v === 'true' || process.env.DEBUG === 'tap'
}

function formatRecordLog(evt: RecordEvent) {
  const uri = `at://${evt.did}/${evt.collection}/${evt.rkey}`
  const revShort =
    evt.rev.length > 12 ? `${evt.rev.slice(0, 12)}…` : evt.rev
  const base = `#${evt.id} ${evt.action} ${uri} rev=${revShort}`
  if (evt.action === 'delete') {
    return base
  }
  return `${base} live=${evt.live}`
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
  const wantCollection = COLLECTION.listingDetail
  let firstListingDetailEvent = true

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

    if (evt.collection !== wantCollection) {
      if (
        evt.collection.startsWith('fyi.atstore.') &&
        evt.collection !== wantCollection
      ) {
        console.warn(
          `[tap] unexpected fyi.atstore collection (want ${wantCollection}): ${evt.collection} rkey=${evt.rkey} did=${evt.did}`,
        )
      } else if (isVerbose()) {
        console.log(
          `[tap] skip collection=${evt.collection} (ingest only ${wantCollection})`,
        )
      }
      return
    }

    if (evt.action !== 'delete' && !evt.live) {
      console.log(
        `[tap] listing.detail backfill/non-live event (still ingesting) live=false rkey=${evt.rkey} did=${evt.did}`,
      )
    }

    if (!syncDb) {
      console.warn(
        `[tap] TAP_SYNC_DB is off — set TAP_SYNC_DB=true to write store_listings (listing.detail rkey=${evt.rkey})`,
      )
      return
    }

    const db = await getDb()

    if (evt.action === 'delete') {
      console.log(
        `[tap] delete store_listings match repo_did=${evt.did} rkey=${evt.rkey}`,
      )
      await markListingRemovedFromTap({
        db,
        did: evt.did,
        rkey: evt.rkey,
      })
      console.log(`[tap] delete applied rkey=${evt.rkey}`)
      return
    }

    if (firstListingDetailEvent) {
      firstListingDetailEvent = false
      console.log(
        `[tap] first listing.detail event — if you see none after publishing, check Tap tracks this DID (TAP_TRACK_DIDS / Tap admin) and collection ${wantCollection}`,
      )
    }

    const raw = evt.record
    const body =
      raw === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(raw)) as Record<string, unknown>)
    if (body === undefined) {
      console.warn(
        `[tap] listing.detail missing record body rkey=${evt.rkey} did=${evt.did} action=${evt.action}`,
      )
      return
    }
    const parsed = parseListingDetailRecord(body)
    if (!parsed) {
      console.warn(
        `[tap] skip invalid listing.detail payload rkey=${evt.rkey} did=${evt.did}`,
      )
      if (isVerbose()) {
        console.warn(
          `[tap] payload keys: ${Object.keys(body).join(', ') || '(empty)'}`,
        )
      }
      return
    }

    const verifiedLabel = trusted.has(evt.did) ? 'verified' : 'unverified'
    console.log(
      `[tap] upsert store_listings slug=${parsed.slug} did=${evt.did} rkey=${evt.rkey} ${verifiedLabel}`,
    )
    try {
      await upsertDirectoryListingFromTap({
        db,
        did: evt.did,
        rkey: evt.rkey,
        record: parsed,
        trustedPublisher: trusted.has(evt.did),
      })
      console.log(`[tap] upsert ok slug=${parsed.slug} rkey=${evt.rkey}`)
    } catch (err) {
      console.error(
        `[tap] upsert failed slug=${parsed.slug} rkey=${evt.rkey} did=${evt.did}`,
        err,
      )
      throw err
    }
  })

  indexer.error((err: Error) => {
    console.error('[tap] error', err)
  })

  if (trackDids.length > 0) {
    console.log(`[tap] POST /repos/add DIDs (${trackDids.length}): ${trackDids.join(', ')}`)
    await tap.addRepos(trackDids)
    console.log('[tap] addRepos finished (HTTP OK)')
  } else {
    console.warn(
      '[tap] TAP_TRACK_DIDS empty — Tap must track the repo that publishes listings (set TAP_TRACK_DIDS=did:plc:… or add repos in Tap), or this consumer will not receive listing events.',
    )
  }

  const channel = tap.channel(indexer, {
    onReconnectError: (error, n, initialSetup) => {
      console.error(
        `[tap] WebSocket reconnect error (attempt ${n}, initialSetup=${initialSetup})`,
        error,
      )
    },
  })

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

  console.log(
    `[tap] config: url=${url} ingestCollection=${wantCollection} syncDb=${syncDb} hasDatabaseUrl=${Boolean(process.env.DATABASE_URL?.trim())} trustedPublishers=${trusted.size} verbose=${isVerbose()}`,
  )
  console.log(
    `[tap] WebSocket channel starting (blocking) — you should see [record] lines as repos update…`,
  )
  await channel.start()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
