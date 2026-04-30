#!/usr/bin/env node
/**
 * Publish a `store_listings` row to the AT Store repo as `fyi.atstore.listing.detail`.
 *
 * Requires `ATSTORE_IDENTIFIER`, `ATSTORE_APP_PASSWORD`, and `DATABASE_URL`.
 *
 * The Postgres mirror is **not** updated here — Tap ingest will pick up the record.
 *
 *   pnpm listing:publish-store kich
 *   pnpm listing:publish-store <uuid>
 *   pnpm listing:publish-store slug -- --icon-url https://… --hero-url https://…
 */
import 'dotenv/config'

import { stat } from 'node:fs/promises'
import path from 'node:path'

import { eq, ilike } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import { resolveBlueskyHandleToDid } from '../src/lib/bluesky-public-profile'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parsePublishArgs(argv: string[]): {
  slugOrUuid: string
  iconUrlOverride?: string
  heroUrlOverride?: string
} {
  let iconUrlOverride: string | undefined
  let heroUrlOverride: string | undefined
  const positional: string[] = []

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!
    if (a === '--') continue
    if (a === '--icon-url') {
      const next = argv[i + 1]?.trim()
      if (!next) throw new Error('Missing value for --icon-url')
      iconUrlOverride = next
      i += 1
      continue
    }
    if (a === '--hero-url') {
      const next = argv[i + 1]?.trim()
      if (!next) throw new Error('Missing value for --hero-url')
      heroUrlOverride = next
      i += 1
      continue
    }
    if (a.startsWith('-')) {
      throw new Error(`Unknown option: ${a}`)
    }
    positional.push(a)
  }

  return {
    slugOrUuid: (positional[0] ?? 'kich').trim(),
    iconUrlOverride,
    heroUrlOverride,
  }
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath)
    return true
  } catch {
    return false
  }
}

async function findFirstLocalGeneratedAsset(
  relativeCandidates: string[],
): Promise<string | null> {
  for (const rel of relativeCandidates) {
    const absolutePath = path.resolve(process.cwd(), 'public', rel)
    if (await fileExists(absolutePath)) {
      return `/${rel}`
    }
  }
  return null
}

async function resolveLocalGeneratedAssetPatch(slug: string): Promise<{
  iconUrl?: string
  heroImageUrl?: string
}> {
  const iconUrl = await findFirstLocalGeneratedAsset([
    `generated/listing-icons/${slug}-icon.jpg`,
    `generated/listing-icons/${slug}-icon.png`,
    `generated/listing-icons/${slug}-icon.webp`,
    `generated/listing-icons/${slug}-icon.svg`,
  ])

  const heroImageUrl = await findFirstLocalGeneratedAsset([
    `generated/listings/${slug}-screenshot.jpg`,
    `generated/listings/${slug}-screenshot.png`,
    `generated/listings/${slug}-screenshot.webp`,
    `generated/listings/${slug}-hero.jpg`,
    `generated/listings/${slug}-hero.png`,
    `generated/listings/${slug}-hero.webp`,
  ])

  return {
    ...(iconUrl ? { iconUrl } : {}),
    ...(heroImageUrl ? { heroImageUrl } : {}),
  }
}

async function main() {
  let parsed: ReturnType<typeof parsePublishArgs>
  try {
    parsed = parsePublishArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    console.error(
      'Usage: pnpm listing:publish-store <slug|listing-uuid> [-- --icon-url <url> --hero-url <url>]',
    )
    process.exitCode = 1
    return
  }

  const { slugOrUuid: arg, iconUrlOverride, heroUrlOverride } = parsed
  if (!arg) {
    console.error('Usage: pnpm listing:publish-store <slug|listing-uuid>')
    process.exitCode = 1
    return
  }

  const byId = UUID_RE.test(arg)
  let rows = await db
    .select()
    .from(storeListings)
    .where(byId ? eq(storeListings.id, arg) : eq(storeListings.slug, arg))
    .limit(2)

  if (rows.length === 0 && !byId) {
    rows = await db
      .select()
      .from(storeListings)
      .where(ilike(storeListings.slug, `%${arg}%`))
      .limit(2)
  }

  if (rows.length === 0) {
    console.error(`No store_listings row for ${byId ? 'id' : 'slug'}=${arg}`)
    process.exitCode = 1
    return
  }
  if (rows.length > 1) {
    console.error(
      `Multiple listings match "${arg}"; pass an exact slug or listing UUID.`,
    )
    process.exitCode = 1
    return
  }

  const row = rows[0]!
  const patch: {
    iconUrl?: string
    heroImageUrl?: string
    productAccountDid?: string
  } = await resolveLocalGeneratedAssetPatch(row.slug)
  if (iconUrlOverride) patch.iconUrl = iconUrlOverride
  if (heroUrlOverride) patch.heroImageUrl = heroUrlOverride
  if (patch.iconUrl || patch.heroImageUrl) {
    console.log(
      `Using image URLs for ${row.slug}: icon=${patch.iconUrl ?? 'unchanged'} hero=${patch.heroImageUrl ?? 'unchanged'}`,
    )
  }

  const handle = row.productAccountHandle?.trim().replace(/^@+/, '') ?? ''
  const existingDid = row.productAccountDid?.trim() ?? ''
  if (handle && !existingDid) {
    const did = handle.startsWith('did:')
      ? handle
      : await resolveBlueskyHandleToDid(handle)
    if (did) {
      patch.productAccountDid = did
      console.log(
        `Resolved product handle "${handle}" → ${did} (publishing productAccountDid)`,
      )
    } else {
      console.warn(
        `Could not resolve product handle "${handle}" to a DID; publishing without productAccountDid.`,
      )
    }
  }

  const { uri } = await publishDirectoryListingDetail(
    row,
    Object.keys(patch).length > 0 ? patch : undefined,
  )
  console.log(`Published ${row.slug}: ${uri}`)
  console.log('Postgres will update when Tap ingests this record.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
