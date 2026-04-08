#!/usr/bin/env node
import 'dotenv/config'

import { desc, eq } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { directoryListings } from '../src/db/schema'
import { classifyProduct } from './scrape-bluesky-directory/anthropic.ts'

type CandidateListing = {
  id: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
}

type ScriptArgs = {
  dryRun: boolean
  force: boolean
  limit: number | null
  id: string | null
  delayMs: number
  help: boolean
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    limit: null,
    id: null,
    delayMs: 0,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      out.help = true
      continue
    }
    if (arg === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (arg === '--force') {
      out.force = true
      continue
    }
    if (arg === '--id') {
      out.id = argv[++i] ?? null
      continue
    }
    if (arg === '--delay-ms') {
      const value = Number(argv[++i] ?? '0')
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --delay-ms value "${argv[i] ?? ''}"`)
      }
      out.delayMs = value
      continue
    }
    if (arg === '--limit' || arg === '-l') {
      const raw = argv[++i]
      const value = Number.parseInt(raw ?? '', 10)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value "${raw ?? ''}"`)
      }
      out.limit = value
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run backfill:listing-taxonomy -- [options]

Options:
      --dry-run        Print proposed taxonomy updates without writing to the database
      --force          Reclassify listings even when scope/domain are already populated
  -l, --limit <n>      Process at most n listings
      --id <listing>   Process a single listing id
      --delay-ms <n>   Delay between listings (default: 0)
  -h, --help           Show help

Behavior:
  - By default, only listings with missing or "unknown" scope/domain are processed.
  - The script updates scope, domain, and classificationReason.
  - productType and vertical are inferred by the model but not written by this script.

Environment:
  DATABASE_URL                           Required
  ANTHROPIC_API_KEY or ANTHROPIC_KEY     Required
  ANTHROPIC_MODEL                        Optional
`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeMissingTaxonomyValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'unknown') {
    return null
  }

  return normalized
}

function needsBackfillValue(value: string | null | undefined): boolean {
  return normalizeMissingTaxonomyValue(value) === null
}

function getCandidateListings(rows: CandidateListing[], args: ScriptArgs): CandidateListing[] {
  return rows
    .filter((row) => (args.id ? row.id === args.id : true))
    .filter((row) => {
      if (args.force) {
        return true
      }

      return needsBackfillValue(row.scope) || needsBackfillValue(row.domain)
    })
    .slice(0, args.limit ?? Number.POSITIVE_INFINITY)
}

function formatValue(value: string | null | undefined): string {
  const normalized = normalizeMissingTaxonomyValue(value)
  return normalized ?? 'null'
}

async function processListing(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<'updated' | 'skipped'> {
  console.log(`Classifying ${listing.name} (${listing.id})`)

  const result = await classifyProduct({
    name: listing.name,
    tagline: listing.tagline,
    fullDescription: listing.fullDescription,
    rawCategoryHint: listing.rawCategoryHint,
    sourceUrl: listing.sourceUrl,
    visitOutUrl: listing.sourceUrl,
    externalUrl: listing.externalUrl,
  })

  const shouldWriteScope = args.force || needsBackfillValue(listing.scope)
  const shouldWriteDomain = args.force || needsBackfillValue(listing.domain)

  const patch: {
    scope?: string
    domain?: string
    classificationReason?: string
    updatedAt?: Date
  } = {}
  const changes: string[] = []

  if (shouldWriteScope && listing.scope !== result.scope) {
    patch.scope = result.scope
    changes.push(`scope ${formatValue(listing.scope)} -> ${result.scope}`)
  }

  if (shouldWriteDomain && listing.domain !== result.domain) {
    patch.domain = result.domain
    changes.push(`domain ${formatValue(listing.domain)} -> ${result.domain}`)
  }

  const nextReason = result.classificationReason.trim()
  const shouldWriteReason =
    changes.length > 0 ||
    args.force ||
    !listing.classificationReason ||
    listing.classificationReason.trim().length === 0

  if (
    shouldWriteReason &&
    nextReason &&
    nextReason !== (listing.classificationReason?.trim() ?? '')
  ) {
    patch.classificationReason = nextReason
    changes.push('classificationReason updated')
  }

  if (changes.length === 0) {
    console.log(
      `No update needed. Suggested taxonomy: scope=${result.scope}, domain=${result.domain}`,
    )
    return 'skipped'
  }

  if (args.dryRun) {
    console.log(`Dry run changes: ${changes.join('; ')}`)
    console.log(
      `Model also suggested productType=${result.productType}, vertical=${result.vertical ?? 'null'}`,
    )
    return 'updated'
  }

  patch.updatedAt = new Date()

  await db
    .update(directoryListings)
    .set(patch)
    .where(eq(directoryListings.id, listing.id))

  console.log(`Updated ${listing.name}: ${changes.join('; ')}`)
  return 'updated'
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const rows = await db
    .select({
      id: directoryListings.id,
      name: directoryListings.name,
      sourceUrl: directoryListings.sourceUrl,
      externalUrl: directoryListings.externalUrl,
      tagline: directoryListings.tagline,
      fullDescription: directoryListings.fullDescription,
      rawCategoryHint: directoryListings.rawCategoryHint,
      scope: directoryListings.scope,
      productType: directoryListings.productType,
      domain: directoryListings.domain,
      vertical: directoryListings.vertical,
      classificationReason: directoryListings.classificationReason,
    })
    .from(directoryListings)
    .orderBy(desc(directoryListings.updatedAt), desc(directoryListings.createdAt))

  const candidates = getCandidateListings(rows, args)
  if (candidates.length === 0) {
    console.log('No listings need taxonomy backfill.')
    return
  }

  console.log(`Found ${candidates.length} listing(s) to process.`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const listing of candidates) {
    try {
      const outcome = await processListing(listing, args)
      if (outcome === 'updated') {
        updated += 1
      } else {
        skipped += 1
      }
    } catch (error) {
      failed += 1
      console.error(`Failed for ${listing.name} (${listing.id}).`)
      console.error(error)
    }

    if (args.delayMs > 0) {
      await sleep(args.delayMs)
    }
  }

  console.log(
    `Finished taxonomy backfill (${updated} updated, ${skipped} skipped, ${failed} failed).`,
  )
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
