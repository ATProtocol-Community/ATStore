#!/usr/bin/env node
import "dotenv/config"

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { eq, inArray, sql } from "drizzle-orm"

import { db, dbClient } from "../src/db/index.server"
import { directoryListings } from "../src/db/schema"
import { buildDirectoryListingSlug } from "../src/lib/directory-listing-slugs"

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
  /** When present in JSON, applied on insert and upsert. When omitted, `category_slugs` is unchanged on update. */
  categorySlug?: string | null
}

const EXCLUDED_RAW_CATEGORY_HINTS = ["Starter Pack", "List", "Feed"] as const

function shouldExcludeRecord(row: InputRecord): boolean {
  const hint = row.rawCategoryHint?.trim().toLowerCase()
  return hint === "starter pack" || hint === "list" || hint === "feed"
}

function parseArgs(argv: string[]) {
  const out: {
    input: string
    help: boolean
  } = {
    input: "out/bluesky-directory-scrape.json",
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--help" || a === "-h") out.help = true
    else if (a === "--input" || a === "-i") out.input = argv[++i] ?? out.input
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run db:import:bluesky-directory -- [options]

Options:
  -i, --input <path>   Input JSON array (default: out/bluesky-directory-scrape.json)
  -h, --help           Show help
`)
}

function assertString(value: unknown, field: string, rowIndex: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Row ${rowIndex}: expected non-empty string for ${field}`)
  }
  return value
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function parseInputRecord(value: unknown, rowIndex: number): InputRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Row ${rowIndex}: expected object`)
  }

  const row = value as Record<string, unknown>
  const screenshotUrls = Array.isArray(row.screenshotUrls)
    ? row.screenshotUrls.map((entry, idx) => {
        if (typeof entry !== "string") {
          throw new Error(
            `Row ${rowIndex}: expected screenshotUrls[${idx}] to be a string`,
          )
        }
        return entry
      })
    : []

  return {
    name: assertString(row.name, "name", rowIndex),
    sourceUrl: assertString(row.sourceUrl, "sourceUrl", rowIndex),
    externalUrl: normalizeNullableString(row.externalUrl),
    iconUrl: normalizeNullableString(row.iconUrl),
    screenshotUrls,
    tagline: normalizeNullableString(row.tagline),
    fullDescription: normalizeNullableString(row.fullDescription),
    rawCategoryHint: normalizeNullableString(row.rawCategoryHint),
    scope: normalizeNullableString(row.scope),
    productType: normalizeNullableString(row.productType),
    domain: normalizeNullableString(row.domain),
    vertical: normalizeNullableString(row.vertical),
    classificationReason: normalizeNullableString(row.classificationReason),
    categorySlug: Object.hasOwn(row, "categorySlug")
      ? normalizeNullableString(row.categorySlug)
      : undefined,
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const inputPath = resolve(process.cwd(), args.input)
  const raw = await readFile(inputPath, "utf8")
  const data: unknown = JSON.parse(raw)

  if (!Array.isArray(data)) {
    throw new Error("Expected input file to contain a JSON array")
  }

  const rows = data
    .map((row, index) => parseInputRecord(row, index))
    .filter((row) => !shouldExcludeRecord(row))

  await db
    .delete(directoryListings)
    .where(inArray(directoryListings.rawCategoryHint, [...EXCLUDED_RAW_CATEGORY_HINTS]))

  const existing = await db
    .select({ sourceUrl: directoryListings.sourceUrl })
    .from(directoryListings)
  const existingSourceUrls = new Set(existing.map((row) => row.sourceUrl))

  let inserted = 0
  let updated = 0

  for (const row of rows) {
    const alreadyExists = existingSourceUrls.has(row.sourceUrl)
    const now = new Date()
    const slug = buildDirectoryListingSlug(row)

    const categoryPatch =
      row.categorySlug !== undefined
        ? {
            categorySlugs: row.categorySlug ? [row.categorySlug] : [],
          }
        : {}

    await db
      .insert(directoryListings)
      .values({
        sourceUrl: row.sourceUrl,
        name: row.name,
        slug,
        externalUrl: row.externalUrl,
        iconUrl: row.iconUrl,
        screenshotUrls: row.screenshotUrls,
        tagline: row.tagline,
        fullDescription: row.fullDescription,
        rawCategoryHint: row.rawCategoryHint,
        scope: row.scope,
        productType: row.productType,
        domain: row.domain,
        vertical: row.vertical,
        classificationReason: row.classificationReason,
        updatedAt: now,
        ...categoryPatch,
      })
      .onConflictDoUpdate({
        target: directoryListings.sourceUrl,
        set: {
          name: row.name,
          slug: sql`coalesce(${directoryListings.slug}, ${slug})`,
          externalUrl: row.externalUrl,
          iconUrl: row.iconUrl,
          screenshotUrls: row.screenshotUrls,
          tagline: row.tagline,
          fullDescription: row.fullDescription,
          rawCategoryHint: row.rawCategoryHint,
          scope: row.scope,
          productType: row.productType,
          domain: row.domain,
          vertical: row.vertical,
          classificationReason: row.classificationReason,
          updatedAt: now,
          ...categoryPatch,
        },
        where: eq(directoryListings.sourceUrl, row.sourceUrl),
      })

    if (alreadyExists) {
      updated += 1
    } else {
      inserted += 1
      existingSourceUrls.add(row.sourceUrl)
    }
  }

  console.log(
    `Imported ${rows.length} listings from ${args.input} (${inserted} inserted, ${updated} updated).`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
