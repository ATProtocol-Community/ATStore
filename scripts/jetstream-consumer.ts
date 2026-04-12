#!/usr/bin/env node
/**
 * Jetstream consumer: subscribes to `app.bsky.feed.post`, matches mentions against
 * `store_listings`, persists `store_listing_mentions`, and updates trending scores.
 *
 * Env:
 *   DATABASE_URL=…                    (required)
 *   JETSTREAM_URL=…                  (default: wss://jetstream2.us-east.bsky.network/subscribe)
 *   JETSTREAM_CURSOR_BUFFER_SEC=5   (subtract from saved cursor on reconnect for overlap)
 *   JETSTREAM_VERBOSE=1
 */
import 'dotenv/config'

import WebSocket from 'ws'

import {
  getJetstreamCursor,
  ingestJetstreamCommitLine,
  loadListingMentionIndex,
  saveJetstreamCursor,
} from '#/lib/trending/jetstream-ingest'

function verbose() {
  const v = process.env.JETSTREAM_VERBOSE?.trim().toLowerCase()
  return v === '1' || v === 'true'
}

function parseJetstreamTimeUs(line: string): number | null {
  try {
    const o = JSON.parse(line) as { time_us?: unknown }
    return typeof o.time_us === 'number' && Number.isFinite(o.time_us)
      ? o.time_us
      : null
  } catch {
    return null
  }
}

function buildJetstreamUrl(cursor?: number): string {
  const raw =
    process.env.JETSTREAM_URL?.trim() ||
    'wss://jetstream2.us-east.bsky.network/subscribe'
  const u = new URL(raw.includes('://') ? raw : `wss://${raw}`)
  u.searchParams.append('wantedCollections', 'app.bsky.feed.post')
  if (cursor != null && Number.isFinite(cursor)) {
    const bufSec = Number(process.env.JETSTREAM_CURSOR_BUFFER_SEC ?? '5')
    const bufUs = (Number.isFinite(bufSec) ? bufSec : 5) * 1_000_000
    const c = Math.max(0, Math.floor(cursor - bufUs))
    u.searchParams.set('cursor', String(c))
  }
  return u.toString()
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[jetstream] DATABASE_URL is required.')
    process.exit(1)
  }

  const { db } = await import('#/db/index.server')

  let index = await loadListingMentionIndex(db, true)
  setInterval(() => {
    void loadListingMentionIndex(db, true).then((i) => {
      index = i
    })
  }, 5 * 60 * 1000)

  let lastCursor = await getJetstreamCursor(db)
  let reconnectDelayMs = 2000
  let shouldRun = true

  const connect = () => {
    const url = buildJetstreamUrl(lastCursor)
    if (verbose()) {
      console.log(`[jetstream] connecting ${url}`)
    }

    const ws = new WebSocket(url)

    ws.on('open', () => {
      reconnectDelayMs = 2000
      console.log('[jetstream] connected')
    })

    ws.on('message', async (data: WebSocket.RawData) => {
      const line =
        typeof data === 'string' ? data : Buffer.from(data as Buffer).toString('utf8')
      const timeUs = parseJetstreamTimeUs(line)
      try {
        const result = await ingestJetstreamCommitLine(db, line, index)
        if (verbose() && result?.processed) {
          console.log(`[jetstream] processed time_us=${String(result.time_us)}`)
        }
      } catch (err) {
        console.error('[jetstream] ingest error', err)
      }
      if (timeUs != null) {
        lastCursor = timeUs
        await saveJetstreamCursor(db, timeUs)
      }
    })

    ws.on('close', (code) => {
      console.warn(`[jetstream] closed code=${String(code)} — reconnecting in ${String(reconnectDelayMs)}ms`)
      if (!shouldRun) return
      setTimeout(() => {
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 120_000)
        connect()
      }, reconnectDelayMs)
    })

    ws.on('error', (err) => {
      console.error('[jetstream] socket error', err)
    })
  }

  connect()

  const shutdown = () => {
    shouldRun = false
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[jetstream] fatal', err)
  process.exit(1)
})
