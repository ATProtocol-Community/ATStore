#!/usr/bin/env node
/**
 * Backfill on-chain `productAccountDid` when `product_account_handle` is set in Postgres
 * but DID was never written to the record (e.g. bulk handle imports).
 *
 * Resolves the handle via `com.atproto.identity.resolveHandle`, then publishes
 * `fyi.atstore.listing.detail` with `productAccountDid` set. Tap ingest updates
 * Postgres — this script does not write to the DB.
 *
 * Only processes listings that already have a published record (`at_uri` + `rkey`).
 *
 * Requires DATABASE_URL, ATSTORE_IDENTIFIER, ATSTORE_APP_PASSWORD.
 *
 * Usage:
 *   tsx -r dotenv/config scripts/backfill-product-account-did-from-handle.ts [options]
 */
import 'dotenv/config'

import { and, asc, eq, sql } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import type { StoreListing } from '../src/db/schema'
import { storeListings } from '../src/db/schema'
import { resolveBlueskyHandleToDid } from '../src/lib/bluesky-public-profile'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

type Args = {
  dryRun: boolean
  limit: number | null
  slug: string | null
  help: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dryRun: false,
    limit: null,
    slug: null,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--slug' && argv[i + 1]) out.slug = argv[++i] ?? null
    else if (a === '--limit' && argv[i + 1]) out.limit = Number(argv[++i])
  }
  return out
}

function printHelp() {
  console.log(`
backfill-product-account-did-from-handle — publish productAccountDid from stored handle (Tap syncs DB)

Usage:
  tsx -r dotenv/config scripts/backfill-product-account-did-from-handle.ts [options]

Options:
  --dry-run        Print planned publishes only (no ATProto writes)
  --slug <slug>    Only this listing slug
  --limit <n>      Max rows to process
  -h, --help       Show this help
`)
}

function trimOrEmpty(s: string | null | undefined): string {
  return s?.trim() ?? ''
}

async function resolveStoredActorToDid(stored: string): Promise<string | null> {
  const t = stored.trim().replace(/^@+/, '')
  if (!t) return null
  if (t.startsWith('did:')) {
    return t
  }
  return resolveBlueskyHandleToDid(t)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const conditions = [
    sql`coalesce(trim(${storeListings.productAccountHandle}), '') <> ''`,
    sql`coalesce(trim(${storeListings.productAccountDid}), '') = ''`,
    sql`coalesce(trim(${storeListings.atUri}), '') <> ''`,
    sql`coalesce(trim(${storeListings.rkey}), '') <> ''`,
  ]
  if (args.slug) {
    conditions.push(eq(storeListings.slug, args.slug))
  }

  const base = db
    .select()
    .from(storeListings)
    .where(and(...conditions))
    .orderBy(asc(storeListings.slug))

  const rows =
    args.limit != null && Number.isFinite(args.limit) && args.limit > 0
      ? await base.limit(args.limit)
      : await base

  if (rows.length === 0) {
    console.log(
      'No rows need backfill (handle set, DID empty, listing published on ATProto).',
    )
    return
  }

  console.log(`Processing ${rows.length} listing(s).`)

  let ok = 0
  let failed = 0

  for (const row of rows) {
    const handleRaw = trimOrEmpty(row.productAccountHandle)
    const label = `${row.slug} (${row.id})`

    const did = await resolveStoredActorToDid(handleRaw)
    if (!did) {
      console.error(`[skip] ${label}: could not resolve handle "${handleRaw}" to a DID.`)
      failed++
      await sleep(150)
      continue
    }

    if (args.dryRun) {
      console.log(`[dry-run] ${label}: would publish productAccountDid=${did}`)
      ok++
      await sleep(150)
      continue
    }

    try {
      await publishDirectoryListingDetail(row as StoreListing, {
        productAccountDid: did,
      })
      console.log(`[ok] ${label} → published ${did} (Tap will sync Postgres)`)
      ok++
    } catch (err) {
      console.error(`[fail] ${label}:`, err)
      failed++
    }

    await sleep(150)
  }

  console.log(`Done. ${ok} published, ${failed} failed or skipped.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
