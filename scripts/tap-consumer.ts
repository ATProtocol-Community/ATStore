#!/usr/bin/env node
/**
 * Tap consumer: WebSocket to your Tap deployment. Ingests `fyi.atstore.listing.detail`
 * into `store_listings`, `fyi.atstore.listing.review` into `store_listing_reviews`,
 * and `fyi.atstore.listing.favorite` into `store_listing_favorites`.
 * Logs identity events; other record collections are skipped except `fyi.atstore.profile` (quiet).
 * Which repos and records appear is configured on the Tap *server* (indigo `cmd/tap`): set
 * `TAP_COLLECTION_FILTERS` to include `fyi.atstore.listing.detail`, `fyi.atstore.listing.review`,
 * and `fyi.atstore.listing.favorite` (or `fyi.atstore.*`). If the server only filters `listing.detail`,
 * review/favorite creates never reach
 * this WebSocket — you will see no `[record]` lines for those records. This client has no per-DID allowlist.
 *
 * Env:
 *   TAP_URL=http://127.0.0.1:2480   # Railway Tap: use https://…railway.app (no :2480); normalized at startup
 *   TAP_ADMIN_PASSWORD=          # if Tap admin API is protected
 *   DATABASE_URL=…               # required; ingest writes to Postgres on every listing event
 *   TAP_TRUSTED_DIDS=did:plc:... # publishers whose listings get verification_status=verified
 *   TAP_VERBOSE=1                # log ignored fyi.atstore.* collections, extra record fields
 */
import 'dotenv/config'

import { SimpleIndexer, Tap } from '@atproto/tap'
import type { IdentityEvent, RecordEvent } from '@atproto/tap'

import type { Database } from '../src/db/index.server'
import { COLLECTION, NSID } from '../src/lib/atproto/nsids'
import {
  normalizeTapUrlForRailway,
  probeTapHealth,
} from '#/lib/atproto/tap-railway-url'
import {
  deleteListingFavoriteFromTap,
  tryParseListingFavoriteRecord,
  upsertListingFavoriteFromTap,
} from '#/lib/atproto/tap-favorite-sync'
import {
  deleteListingReviewFromTap,
  tryParseListingReviewRecord,
  upsertListingReviewFromTap,
} from '#/lib/atproto/tap-review-sync'
import {
  markListingRemovedFromTap,
  tryParseListingDetailRecord,
  upsertDirectoryListingFromTap,
} from '#/lib/atproto/tap-listing-sync'

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

/** Prefer structuredClone so Uint8Array blob refs survive; JSON loses bytes (see blob-cdn-url numeric recovery). */
function cloneRecordForIngest(
  raw: NonNullable<RecordEvent['record']>,
): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw) as Record<string, unknown>
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
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
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      '[tap] DATABASE_URL is required — this consumer persists listing events to Postgres.',
    )
    process.exit(1)
  }

  const rawTapUrl = process.env.TAP_URL?.trim() || 'http://127.0.0.1:2480'
  const url = normalizeTapUrlForRailway(rawTapUrl)
  const adminPassword = process.env.TAP_ADMIN_PASSWORD?.trim()
  const trusted = new Set(parseDidList(process.env.TAP_TRUSTED_DIDS))

  await probeTapHealth(url, adminPassword)

  let dbCache: Database | undefined
  async function getDb(): Promise<Database> {
    dbCache ??= (await import('../src/db/index.server')).db
    return dbCache
  }

  const tap = new Tap(url, adminPassword ? { adminPassword } : {})
  const ingestCollections = new Set<string>([
    COLLECTION.listingDetail,
    COLLECTION.listingReview,
    COLLECTION.listingFavorite,
  ])
  let firstListingDetailEvent = true
  let firstListingReviewEvent = true
  let firstListingFavoriteEvent = true

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

    if (!ingestCollections.has(evt.collection)) {
      if (evt.collection.startsWith('fyi.atstore.')) {
        console.warn(
          `[tap] unexpected fyi.atstore collection (ingest ${[...ingestCollections].join(', ')}): ${evt.collection} rkey=${evt.rkey} did=${evt.did}`,
        )
      } else if (isVerbose()) {
        console.log(
          `[tap] skip collection=${evt.collection} (ingest only ${[...ingestCollections].join(', ')})`,
        )
      }
      return
    }

    const db = await getDb()

    if (evt.collection === COLLECTION.listingReview) {
      if (evt.action !== 'delete' && !evt.live) {
        console.log(
          `[tap] listing.review backfill/non-live event (still ingesting) live=false rkey=${evt.rkey} did=${evt.did}`,
        )
      }

      if (evt.action === 'delete') {
        console.log(
          `[tap] delete store_listing_reviews match author_did=${evt.did} rkey=${evt.rkey}`,
        )
        await deleteListingReviewFromTap({
          db,
          did: evt.did,
          rkey: evt.rkey,
        })
        console.log(`[tap] review delete applied rkey=${evt.rkey}`)
        return
      }

      if (firstListingReviewEvent) {
        firstListingReviewEvent = false
        console.log(
          `[tap] first listing.review event — ensure Tap relays ${COLLECTION.listingReview}`,
        )
      }

      const raw = evt.record
      const body =
        raw === undefined ? undefined : cloneRecordForIngest(raw)
      if (raw !== undefined && isVerbose()) {
        const mode =
          typeof structuredClone === 'function' ? 'structuredClone' : 'JSON'
        console.log(`[tap] record clone mode=${mode}`)
      }
      if (body === undefined) {
        console.warn(
          `[tap] listing.review missing record body rkey=${evt.rkey} did=${evt.did} action=${evt.action}`,
        )
        return
      }
      const parseResult = tryParseListingReviewRecord(body)
      if (!parseResult.ok) {
        console.warn(
          `[tap] skip listing.review rkey=${evt.rkey} did=${evt.did} stage=${parseResult.stage}: ${parseResult.reason}`,
        )
        if (parseResult.stage === 'zod' && parseResult.zodError) {
          console.warn('[tap] zod field errors:', parseResult.zodError.flatten())
        }
        return
      }

      console.log(
        `[tap] upsert store_listing_reviews subject=${parseResult.record.subject} did=${evt.did} rkey=${evt.rkey}`,
      )
      try {
        await upsertListingReviewFromTap({
          db,
          did: evt.did,
          rkey: evt.rkey,
          record: parseResult.record,
        })
        console.log(`[tap] review upsert ok rkey=${evt.rkey}`)
      } catch (err) {
        console.error(
          `[tap] review upsert failed rkey=${evt.rkey} did=${evt.did}`,
          err,
        )
        throw err
      }
      return
    }

    if (evt.collection === COLLECTION.listingFavorite) {
      if (evt.action !== 'delete' && !evt.live) {
        console.log(
          `[tap] listing.favorite backfill/non-live event (still ingesting) live=false rkey=${evt.rkey} did=${evt.did}`,
        )
      }

      if (evt.action === 'delete') {
        console.log(
          `[tap] delete store_listing_favorites match author_did=${evt.did} rkey=${evt.rkey}`,
        )
        await deleteListingFavoriteFromTap({
          db,
          did: evt.did,
          rkey: evt.rkey,
        })
        console.log(`[tap] favorite delete applied rkey=${evt.rkey}`)
        return
      }

      if (firstListingFavoriteEvent) {
        firstListingFavoriteEvent = false
        console.log(
          `[tap] first listing.favorite event — ensure Tap relays ${COLLECTION.listingFavorite}`,
        )
      }

      const raw = evt.record
      const body =
        raw === undefined ? undefined : cloneRecordForIngest(raw)
      if (raw !== undefined && isVerbose()) {
        const mode =
          typeof structuredClone === 'function' ? 'structuredClone' : 'JSON'
        console.log(`[tap] record clone mode=${mode}`)
      }
      if (body === undefined) {
        console.warn(
          `[tap] listing.favorite missing record body rkey=${evt.rkey} did=${evt.did} action=${evt.action}`,
        )
        return
      }
      const parseResult = tryParseListingFavoriteRecord(body)
      if (!parseResult.ok) {
        console.warn(
          `[tap] skip listing.favorite rkey=${evt.rkey} did=${evt.did} stage=${parseResult.stage}: ${parseResult.reason}`,
        )
        if (parseResult.stage === 'zod' && parseResult.zodError) {
          console.warn('[tap] zod field errors:', parseResult.zodError.flatten())
        }
        return
      }

      console.log(
        `[tap] upsert store_listing_favorites subject=${parseResult.record.subject} did=${evt.did} rkey=${evt.rkey}`,
      )
      try {
        await upsertListingFavoriteFromTap({
          db,
          did: evt.did,
          rkey: evt.rkey,
          record: parseResult.record,
        })
        console.log(`[tap] favorite upsert ok rkey=${evt.rkey}`)
      } catch (err) {
        console.error(
          `[tap] favorite upsert failed rkey=${evt.rkey} did=${evt.did}`,
          err,
        )
        throw err
      }
      return
    }

    if (evt.collection === COLLECTION.listingDetail) {
      if (evt.action !== 'delete' && !evt.live) {
        console.log(
          `[tap] listing.detail backfill/non-live event (still ingesting) live=false rkey=${evt.rkey} did=${evt.did}`,
        )
      }

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
          `[tap] first listing.detail event — if you see none after publishing, check Tap is configured to relay that repo and collection ${COLLECTION.listingDetail}`,
        )
      }

      const raw = evt.record
      const body =
        raw === undefined ? undefined : cloneRecordForIngest(raw)
      if (raw !== undefined && isVerbose()) {
        const mode =
          typeof structuredClone === 'function' ? 'structuredClone' : 'JSON'
        console.log(`[tap] record clone mode=${mode}`)
      }
      if (body === undefined) {
        console.warn(
          `[tap] listing.detail missing record body rkey=${evt.rkey} did=${evt.did} action=${evt.action}`,
        )
        return
      }
      const parseResult = tryParseListingDetailRecord(body)
      if (!parseResult.ok) {
        console.warn(
          `[tap] skip listing.detail rkey=${evt.rkey} did=${evt.did} stage=${parseResult.stage}: ${parseResult.reason}`,
        )
        if (parseResult.stage === 'zod' && parseResult.zodError) {
          console.warn('[tap] zod field errors:', parseResult.zodError.flatten())
        }
        if (parseResult.blobSummary) {
          console.warn(
            `[tap] blob detail (${parseResult.blobField ?? '?'}): ${parseResult.blobSummary}`,
          )
        }
        console.warn(
          `[tap] payload top-level keys: ${Object.keys(body).join(', ') || '(empty)'}`,
        )
        if (body.$type !== undefined) {
          console.warn(`[tap] record $type: ${String(body.$type)}`)
        }
        if (isVerbose()) {
          try {
            const snapshot = JSON.stringify(body)
            console.warn(
              `[tap] full record JSON (${snapshot.length} chars): ${snapshot.slice(0, 8000)}${snapshot.length > 8000 ? '…' : ''}`,
            )
          } catch {
            console.warn('[tap] full record: <could not JSON.stringify>')
          }
        }
        return
      }

      const parsed = parseResult.record
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
    }
  })

  indexer.error((err: Error) => {
    console.error('[tap] error', err)
  })

  const channel = tap.channel(indexer, {
    onReconnectError: (error: unknown, n: number, initialSetup: boolean) => {
      console.error(
        `[tap] WebSocket reconnect error (attempt ${n}, initialSetup=${initialSetup})`,
        error,
      )
    },
  })

  const shutdown = async () => {
    console.log('[tap] shutting down…')
    await channel.destroy()
    const { dbClient } = await import('../src/db/index.server')
    await dbClient.end({ timeout: 5 })
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())

  console.log(
    `[tap] config: url=${url} ingestCollections=${[...ingestCollections].join(', ')} trustedPublishers=${trusted.size} verbose=${isVerbose()}`,
  )
  console.log(
    `[tap] hint: Tap server TAP_COLLECTION_FILTERS must include listing.review + listing.favorite (or fyi.atstore.*) or those events never arrive here`,
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
