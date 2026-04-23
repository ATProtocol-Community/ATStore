#!/usr/bin/env node
import 'dotenv/config'

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

import { eq, sql } from 'drizzle-orm'

import {
  buildDirectoryListingSlug,
  slugifyDirectoryListingName,
} from '../src/lib/directory-listing-slugs'

type InputRecord = {
  name: string
  sourceUrl: string
  externalUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  appTags: string[]
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
  categorySlug: string | null
  productAccountHandle: string | null
}

type ScriptArgs = {
  help: boolean
  dryRun: boolean
  shouldImport: boolean
  shouldGenerateAssets: boolean
  name: string | null
  sourceUrl: string | null
  externalUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  appTags: string[]
  iconAssetUrl: string | null
  screenshotAssetUrls: string[]
  categorySlug: string | null
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
  assetSlug: string | null
  productAccountHandle: string | null
}

const MANUAL_LISTINGS_PATH = resolve(process.cwd(), 'out/manual-directory-listings.json')
const GENERATED_LISTINGS_DIR = resolve(process.cwd(), 'public/generated/listings')
const FETCH_USER_AGENT = 'at-store-manual-listing-import/1.0'

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    help: false,
    dryRun: false,
    shouldImport: true,
    shouldGenerateAssets: true,
    name: null,
    sourceUrl: null,
    externalUrl: null,
    iconUrl: null,
    screenshotUrls: [],
    appTags: [],
    iconAssetUrl: null,
    screenshotAssetUrls: [],
    categorySlug: null,
    tagline: null,
    fullDescription: null,
    rawCategoryHint: null,
    scope: null,
    productType: null,
    domain: null,
    vertical: null,
    classificationReason: null,
    assetSlug: null,
    productAccountHandle: null,
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
    if (arg === '--no-import') {
      out.shouldImport = false
      continue
    }
    if (arg === '--no-generate-assets') {
      out.shouldGenerateAssets = false
      continue
    }
    if (arg === '--name') {
      out.name = argv[++i] ?? null
      continue
    }
    if (arg === '--source-url') {
      out.sourceUrl = argv[++i] ?? null
      continue
    }
    if (arg === '--external-url') {
      out.externalUrl = argv[++i] ?? null
      continue
    }
    if (arg === '--icon-url') {
      out.iconUrl = argv[++i] ?? null
      continue
    }
    if (arg === '--screenshot-url') {
      const value = argv[++i] ?? null
      if (value) out.screenshotUrls.push(value)
      continue
    }
    if (arg === '--app-tag') {
      const value = argv[++i] ?? null
      if (value) out.appTags.push(value)
      continue
    }
    if (arg === '--icon-asset-url') {
      out.iconAssetUrl = argv[++i] ?? null
      continue
    }
    if (arg === '--screenshot-asset-url') {
      const value = argv[++i] ?? null
      if (value) out.screenshotAssetUrls.push(value)
      continue
    }
    if (arg === '--category-slug') {
      out.categorySlug = argv[++i] ?? null
      continue
    }
    if (arg === '--tagline') {
      out.tagline = argv[++i] ?? null
      continue
    }
    if (arg === '--description' || arg === '--full-description') {
      out.fullDescription = argv[++i] ?? null
      continue
    }
    if (arg === '--raw-category-hint') {
      out.rawCategoryHint = argv[++i] ?? null
      continue
    }
    if (arg === '--scope') {
      out.scope = argv[++i] ?? null
      continue
    }
    if (arg === '--product-type') {
      out.productType = argv[++i] ?? null
      continue
    }
    if (arg === '--domain') {
      out.domain = argv[++i] ?? null
      continue
    }
    if (arg === '--vertical') {
      out.vertical = argv[++i] ?? null
      continue
    }
    if (arg === '--classification-reason') {
      out.classificationReason = argv[++i] ?? null
      continue
    }
    if (arg === '--asset-slug') {
      out.assetSlug = argv[++i] ?? null
      continue
    }
    if (
      arg === '--product-account-handle' ||
      arg === '--product-handle' ||
      arg === '--handle'
    ) {
      out.productAccountHandle = argv[++i] ?? null
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp() {
  console.log(`
Usage:
  npm run listing:add -- --name "Product" --source-url "https://source" --category-slug "protocol/pds" [options]

Required:
  --name <value>                   Listing name
  --source-url <url>               Canonical source URL used as upsert key
  --category-slug <slug>           Directory category, e.g. protocol/pds

Content:
  --external-url <url>             Destination site URL (defaults to source URL)
  --tagline <text>                 Short listing tagline
  --description <text>             Full description
  --raw-category-hint <text>       Legacy/raw category label, e.g. PDS
  --scope <value>                  Taxonomy scope, e.g. atproto
  --product-type <value>           Taxonomy product type, e.g. service
  --domain <value>                 Taxonomy domain, e.g. hosting
  --vertical <value>               Optional vertical
  --classification-reason <text>   Why the category assignment fits
  --product-account-handle <handle> ATProto handle for the product account, e.g. kikbak.tv
                                   (DID is resolved at publish time and stored in Postgres + the listing record)

Assets:
  --icon-url <path>                Existing local/public icon path
  --screenshot-url <path>          Existing local/public screenshot path (repeatable)
  --app-tag <text>                 App tag for discovery/filtering (repeatable)
  --icon-asset-url <url>           Download remote icon into public/generated/listings
  --screenshot-asset-url <url>     Download remote screenshot into public/generated/listings (repeatable)
  --asset-slug <slug>              Override generated asset filename prefix
                                   If you skip screenshots, run
                                   npm run generate:listing-images -- --input out/manual-directory-listings.json
                                   to create fallback-styled generated listing art

Flags:
  --no-import                      Only update out/manual-directory-listings.json
  --no-generate-assets             Skip running hero/icon generation helper after import
  --dry-run                        Print intended record without writing
  -h, --help                       Show help

Examples:
  npm run listing:add -- \\
    --name "Eurosky" \\
    --source-url "https://www.eurosky.tech/eurosky-accounts" \\
    --external-url "https://www.eurosky.tech/eurosky-accounts" \\
    --category-slug "protocol/pds" \\
    --tagline "European-hosted AT Protocol accounts..." \\
    --description "Eurosky offers European-hosted..." \\
    --raw-category-hint "PDS" \\
    --scope "atproto" \\
    --product-type "service" \\
    --domain "hosting" \\
    --classification-reason "Hosted AT Protocol accounts whose identity acts as a PDS." \\
    --icon-asset-url "https://eurosky.tech/logos/star-logos_eurosky-logo-black.png" \\
    --screenshot-asset-url "https://eurosky.tech/og-image.png"
`)
}

function assertNonEmptyString(value: string | null, field: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    throw new Error(`Missing required argument: ${field}`)
  }
  return normalized
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized ? normalized : null
}

function normalizeProductAccountHandle(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  const stripped = trimmed.replace(/^@+/, '').trim()
  if (!stripped) return null
  if (stripped.startsWith('did:')) return stripped
  return stripped.toLowerCase()
}

function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const value of values) {
    const tag = value.trim().toLowerCase()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

function normalizeHttpUrl(raw: string | null | undefined, field: string): string {
  const normalized = assertNonEmptyString(raw ?? null, field)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`Expected a valid URL for ${field}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Expected an http(s) URL for ${field}`)
  }

  url.hash = ''
  return url.href
}

function normalizePublicAssetPath(raw: string | null | undefined, field: string): string | null {
  const normalized = normalizeNullableString(raw)
  if (!normalized) {
    return null
  }
  if (!normalized.startsWith('/')) {
    throw new Error(`${field} must be a public path starting with /`)
  }
  return normalized
}

function parseFileExtension(url: URL) {
  const extension = extname(url.pathname).toLowerCase()
  return extension || null
}

function extensionFromContentType(contentType: string | null) {
  const normalized = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (normalized === 'image/png') return '.png'
  if (normalized === 'image/jpeg') return '.jpg'
  if (normalized === 'image/webp') return '.webp'
  if (normalized === 'image/gif') return '.gif'
  if (normalized === 'image/svg+xml') return '.svg'
  if (normalized === 'image/x-icon' || normalized === 'image/vnd.microsoft.icon') {
    return '.ico'
  }
  return null
}

function ensureSafeAssetSlug(value: string) {
  const slug = slugifyDirectoryListingName(value)
  return slug || 'listing'
}

async function downloadAsset(
  remoteUrl: string,
  outputBasename: string,
  dryRun: boolean,
): Promise<string> {
  const normalizedUrl = normalizeHttpUrl(remoteUrl, outputBasename)
  const url = new URL(normalizedUrl)

  const response = await fetch(url, {
    headers: {
      'user-agent': FETCH_USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${normalizedUrl}`)
  }

  const fileExtension =
    parseFileExtension(url) ??
    extensionFromContentType(response.headers.get('content-type')) ??
    '.bin'
  const filename = `${outputBasename}${fileExtension}`
  const absolutePath = resolve(GENERATED_LISTINGS_DIR, filename)
  const publicPath = `/generated/listings/${filename}`

  if (dryRun) {
    return publicPath
  }

  await mkdir(GENERATED_LISTINGS_DIR, { recursive: true })
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(absolutePath, buffer)
  return publicPath
}

async function readManualListings(): Promise<InputRecord[]> {
  try {
    const raw = await readFile(MANUAL_LISTINGS_PATH, 'utf8')
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      throw new Error('Expected manual listings file to contain a JSON array')
    }
    return data as InputRecord[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function writeManualListings(records: InputRecord[]) {
  await mkdir(resolve(process.cwd(), 'out'), { recursive: true })
  await writeFile(MANUAL_LISTINGS_PATH, JSON.stringify(records, null, 2) + '\n', 'utf8')
}

function buildRecord(args: ScriptArgs, assets: {
  iconUrl: string | null
  screenshotUrls: string[]
}): InputRecord {
  const name = assertNonEmptyString(args.name, '--name')
  const sourceUrl = normalizeHttpUrl(args.sourceUrl, '--source-url')
  const externalUrl = normalizeHttpUrl(
    normalizeNullableString(args.externalUrl) ?? sourceUrl,
    '--external-url',
  )
  const categorySlug = assertNonEmptyString(args.categorySlug, '--category-slug')

  return {
    name,
    sourceUrl,
    externalUrl,
    iconUrl: assets.iconUrl,
    screenshotUrls: assets.screenshotUrls,
    appTags: normalizeTags(args.appTags),
    tagline: normalizeNullableString(args.tagline),
    fullDescription: normalizeNullableString(args.fullDescription),
    rawCategoryHint: normalizeNullableString(args.rawCategoryHint),
    scope: normalizeNullableString(args.scope),
    productType: normalizeNullableString(args.productType),
    domain: normalizeNullableString(args.domain),
    vertical: normalizeNullableString(args.vertical),
    classificationReason: normalizeNullableString(args.classificationReason),
    categorySlug,
    productAccountHandle: normalizeProductAccountHandle(args.productAccountHandle),
  }
}

async function resolveAssets(args: ScriptArgs): Promise<{
  iconUrl: string | null
  screenshotUrls: string[]
}> {
  const assetSlug = ensureSafeAssetSlug(args.assetSlug ?? args.name ?? 'listing')

  const iconUrl =
    args.iconAssetUrl
      ? await downloadAsset(args.iconAssetUrl, `${assetSlug}-icon`, args.dryRun)
      : normalizePublicAssetPath(args.iconUrl, '--icon-url')

  const downloadedScreenshots = await Promise.all(
    args.screenshotAssetUrls.map((url, index) =>
      downloadAsset(
        url,
        `${assetSlug}-screenshot${index === 0 ? '' : `-${index + 1}`}`,
        args.dryRun,
      ),
    ),
  )

  const explicitScreenshots = args.screenshotUrls.map((url) =>
    normalizePublicAssetPath(url, '--screenshot-url'),
  )

  return {
    iconUrl,
    screenshotUrls: [...explicitScreenshots, ...downloadedScreenshots].filter(
      (value): value is string => Boolean(value),
    ),
  }
}

function upsertManualListing(records: InputRecord[], nextRecord: InputRecord) {
  const existingIndex = records.findIndex(
    (record) => record.sourceUrl === nextRecord.sourceUrl,
  )

  if (existingIndex === -1) {
    return {
      action: 'inserted' as const,
      records: [...records, nextRecord],
    }
  }

  const updated = [...records]
  updated[existingIndex] = nextRecord
  return {
    action: 'updated' as const,
    records: updated,
  }
}

async function importRecord(record: InputRecord, dryRun: boolean) {
  const slug = buildDirectoryListingSlug(record)

  if (dryRun) {
    console.log(`Would import listing "${record.name}" with slug "${slug}".`)
    return
  }

  const [{ db, dbClient }, { storeListings }] = await Promise.all([
    import('../src/db/index.server'),
    import('../src/db/schema'),
  ])
  const now = new Date()

  const handle = record.productAccountHandle
  const handlePatch = handle
    ? {
        productAccountHandle: handle,
        productAccountHandleIgnoredAt: null as Date | null,
      }
    : {}

  try {
    await db
      .insert(storeListings)
      .values({
        sourceUrl: record.sourceUrl,
        name: record.name,
        slug,
        externalUrl: record.externalUrl,
        iconUrl: record.iconUrl,
        screenshotUrls: record.screenshotUrls,
        appTags: record.appTags,
        tagline: record.tagline,
        fullDescription: record.fullDescription,
        categorySlugs: record.categorySlug ? [record.categorySlug] : [],
        updatedAt: now,
        ...handlePatch,
      })
      .onConflictDoUpdate({
        target: storeListings.sourceUrl,
        set: {
          name: record.name,
          slug: sql`coalesce(${storeListings.slug}, ${slug})`,
          externalUrl: record.externalUrl,
          iconUrl: record.iconUrl,
          screenshotUrls: record.screenshotUrls,
          appTags: record.appTags,
          tagline: record.tagline,
          fullDescription: record.fullDescription,
          categorySlugs: record.categorySlug ? [record.categorySlug] : [],
          updatedAt: now,
          ...handlePatch,
        },
        where: eq(storeListings.sourceUrl, record.sourceUrl),
      })
  } finally {
    await dbClient.end({ timeout: 5 })
  }
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', rejectPromise)
    child.on('exit', (code, signal) => {
      if (typeof code === 'number' && code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new Error(
          signal
            ? `${command} exited due to signal ${signal}`
            : `${command} exited with code ${code ?? 'unknown'}`,
        ),
      )
    })
  })
}

async function runListingImageGeneration(record: InputRecord) {
  const baseArgs = [
    'run',
    'generate:listing-images',
    '--input',
    'out/manual-directory-listings.json',
    '--id',
    record.sourceUrl,
    '--limit',
    '1',
    '--concurrency',
    '1',
  ]
  await runCommand('pnpm', baseArgs)
  await runCommand('pnpm', [...baseArgs, '--icon'])
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const assets = await resolveAssets(args)
  const record = buildRecord(args, assets)
  const existingRecords = await readManualListings()
  const { action, records } = upsertManualListing(existingRecords, record)

  if (args.dryRun) {
    console.log(`${action === 'inserted' ? 'Would insert' : 'Would update'} manual listing:`)
    console.log(JSON.stringify(record, null, 2))
  } else {
    await writeManualListings(records)
    console.log(
      `${action === 'inserted' ? 'Inserted' : 'Updated'} manual listing in ${basename(MANUAL_LISTINGS_PATH)}.`,
    )
  }

  if (args.shouldImport) {
    await importRecord(record, args.dryRun)
    if (!args.dryRun) {
      console.log(`Imported "${record.name}" into store_listings.`)
    }

    const hasIconInput = Boolean(args.iconAssetUrl ?? args.iconUrl)
    const hasScreenshotInput = args.screenshotAssetUrls.length > 0 || args.screenshotUrls.length > 0
    const shouldGenerateNow = args.shouldGenerateAssets && !hasIconInput && !hasScreenshotInput

    if (shouldGenerateNow) {
      if (args.dryRun) {
        console.log('Dry run: would generate hero and icon assets from listing page context.')
      } else {
        console.log('Generating hero and icon assets via generate:listing-images...')
        await runListingImageGeneration(record)
      }
    } else if (!args.shouldGenerateAssets) {
      console.log('Skipped asset generation (--no-generate-assets).')
    } else {
      console.log('Skipped asset generation because icon/screenshot assets were provided explicitly.')
    }
  } else {
    console.log('Skipped DB import.')
  }
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
