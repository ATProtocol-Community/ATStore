#!/usr/bin/env node
import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { eq } from "drizzle-orm"

import {
  sanitizeListingDescription,
  sanitizeListingTagline,
} from "../src/lib/listing-copy"

const APPS_PAGE_URL = "https://atproto.brussels/atproto-apps"
const APPS_FEED_URL = "https://atproto.brussels/apps-data.json"
const FETCH_USER_AGENT =
  "at-store-atproto-brussels-ingester/1.0 (+https://atproto.brussels/atproto-apps)"
const EXTRA_APPS: FeedApp[] = [
  {
    name: "Arabica",
    url: "https://arabica.social/",
    category: "Lifestyle",
    description: "Track your coffee brewing journey on the AT Protocol.",
    isOnline: true,
  },
  {
    name: "Drydown",
    url: "https://alpha.drydown.social/",
    category: "Lifestyle",
    description: "Fragrance reviews on the AT Protocol.",
    isOnline: true,
  },
]

type FeedApp = {
  name: string
  url: string
  category?: string
  alternativeTo?: string
  platforms?: string[]
  description?: string
  isOnline?: boolean
  hasValidFavicon?: boolean
  faviconUrl?: string
  lastChecked?: string
}

type InputRecord = {
  name: string
  sourceUrl: string
  externalUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
}

function parseArgs(argv: string[]) {
  const out: {
    dryRun: boolean
    onlyOnline: boolean
    output: string | null
    help: boolean
  } = {
    dryRun: false,
    onlyOnline: false,
    output: null,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") out.help = true
    else if (arg === "--dry-run") out.dryRun = true
    else if (arg === "--only-online") out.onlyOnline = true
    else if (arg === "--output" || arg === "-o") {
      out.output = argv[++i] ?? out.output
    }
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run db:import:atproto-brussels-apps -- [options]

Options:
      --dry-run        Fetch and normalize apps without writing to the database
      --only-online    Skip entries where isOnline is explicitly false
  -o, --output <path>  Write normalized JSON to disk
  -h, --help           Show help
`)
}

function assertNonEmptyString(
  value: unknown,
  field: string,
  rowIndex: number,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Row ${rowIndex}: expected non-empty string for ${field}`)
  }

  return value.trim()
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function normalizeHttpUrl(value: unknown, field: string, rowIndex: number): string {
  const raw = assertNonEmptyString(value, field, rowIndex)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Row ${rowIndex}: expected valid URL for ${field}`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Row ${rowIndex}: expected http(s) URL for ${field}`)
  }

  url.hash = ""
  return url.href
}

function normalizeOptionalHttpUrl(
  value: unknown,
  field: string,
  rowIndex: number,
): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }

  try {
    return normalizeHttpUrl(value, field, rowIndex)
  } catch {
    return null
  }
}

function normalizePlatforms(value: unknown, rowIndex: number): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new Error(`Row ${rowIndex}: expected platforms to be an array`)
  }

  return value.flatMap((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`Row ${rowIndex}: expected platforms[${index}] to be a string`)
    }
    return entry.trim()
  })
}

function parseFeedApp(value: unknown, rowIndex: number): FeedApp {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Row ${rowIndex}: expected object`)
  }

  const row = value as Record<string, unknown>

  return {
    name: assertNonEmptyString(row.name, "name", rowIndex),
    url: normalizeHttpUrl(row.url, "url", rowIndex),
    category: normalizeNullableString(row.category),
    alternativeTo: normalizeNullableString(row.alternativeTo),
    platforms: normalizePlatforms(row.platforms, rowIndex),
    description: normalizeNullableString(row.description),
    isOnline: typeof row.isOnline === "boolean" ? row.isOnline : undefined,
    hasValidFavicon:
      typeof row.hasValidFavicon === "boolean" ? row.hasValidFavicon : undefined,
    faviconUrl: normalizeOptionalHttpUrl(row.faviconUrl, "faviconUrl", rowIndex) ?? undefined,
    lastChecked: normalizeNullableString(row.lastChecked) ?? undefined,
  }
}

function buildSourceUrl(externalUrl: string): string {
  const url = new URL(APPS_PAGE_URL)
  url.searchParams.set("app", externalUrl)
  return url.href
}

function buildFullDescription(app: FeedApp): string | null {
  return sanitizeListingDescription(app.description ?? null)
}

function toInputRecord(app: FeedApp): InputRecord {
  return {
    name: app.name,
    sourceUrl: buildSourceUrl(app.url),
    externalUrl: app.url,
    iconUrl: app.hasValidFavicon ? app.faviconUrl ?? null : null,
    screenshotUrls: [],
    tagline: sanitizeListingTagline(app.description ?? null),
    fullDescription: buildFullDescription(app),
    rawCategoryHint: app.category ?? null,
    scope: null,
    productType: null,
    domain: null,
    vertical: null,
    classificationReason: null,
  }
}

async function fetchFeed(): Promise<FeedApp[]> {
  const response = await fetch(APPS_FEED_URL, {
    headers: {
      "user-agent": FETCH_USER_AGENT,
      accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${APPS_FEED_URL}`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    throw new Error("Expected apps feed to be a JSON array")
  }

  return [
    ...data.map((row, index) => parseFeedApp(row, index)),
    ...EXTRA_APPS,
  ]
}

async function maybeWriteOutput(
  outputPath: string | null,
  records: InputRecord[],
): Promise<void> {
  if (!outputPath) return

  const resolved = resolve(process.cwd(), outputPath)
  await mkdir(dirname(resolved), { recursive: true })
  await writeFile(resolved, JSON.stringify(records, null, 2) + "\n", "utf8")
}

async function upsertRecords(records: InputRecord[]): Promise<{
  inserted: number
  updated: number
}> {
  const [{ db, dbClient }, { directoryListings }] = await Promise.all([
    import("../src/db/index.server"),
    import("../src/db/schema"),
  ])

  try {
    const existing = await db
      .select({ sourceUrl: directoryListings.sourceUrl })
      .from(directoryListings)
    const existingSourceUrls = new Set(existing.map((row) => row.sourceUrl))

    let inserted = 0
    let updated = 0

    for (const record of records) {
      const alreadyExists = existingSourceUrls.has(record.sourceUrl)
      const now = new Date()

      await db
        .insert(directoryListings)
        .values({
          sourceUrl: record.sourceUrl,
          name: record.name,
          externalUrl: record.externalUrl,
          iconUrl: record.iconUrl,
          screenshotUrls: record.screenshotUrls,
          tagline: record.tagline,
          fullDescription: record.fullDescription,
          rawCategoryHint: record.rawCategoryHint,
          scope: record.scope,
          productType: record.productType,
          domain: record.domain,
          vertical: record.vertical,
          classificationReason: record.classificationReason,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: directoryListings.sourceUrl,
          set: {
            name: record.name,
            externalUrl: record.externalUrl,
            iconUrl: record.iconUrl,
            screenshotUrls: record.screenshotUrls,
            tagline: record.tagline,
            fullDescription: record.fullDescription,
            rawCategoryHint: record.rawCategoryHint,
            scope: record.scope,
            productType: record.productType,
            domain: record.domain,
            vertical: record.vertical,
            classificationReason: record.classificationReason,
            updatedAt: now,
          },
          where: eq(directoryListings.sourceUrl, record.sourceUrl),
        })

      if (alreadyExists) {
        updated += 1
      } else {
        inserted += 1
        existingSourceUrls.add(record.sourceUrl)
      }
    }

    return { inserted, updated }
  } finally {
    await dbClient.end({ timeout: 5 })
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const feed = await fetchFeed()
  const filtered = args.onlyOnline
    ? feed.filter((app) => app.isOnline !== false)
    : feed

  const uniqueRecords = new Map<string, InputRecord>()
  for (const app of filtered) {
    const record = toInputRecord(app)
    uniqueRecords.set(record.sourceUrl, record)
  }

  const records = [...uniqueRecords.values()]

  await maybeWriteOutput(args.output, records)

  if (args.dryRun) {
    console.log(
      `Fetched ${feed.length} apps, normalized ${records.length} records${args.output ? `, wrote ${args.output}` : ""}.`,
    )
    return
  }

  const { inserted, updated } = await upsertRecords(records)
  console.log(
    `Imported ${records.length} apps from ${APPS_FEED_URL} (${inserted} inserted, ${updated} updated)${args.output ? `, wrote ${args.output}` : ""}.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
