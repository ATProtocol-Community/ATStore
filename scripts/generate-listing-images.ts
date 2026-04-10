#!/usr/bin/env node
import "dotenv/config"

import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

import { desc, eq } from "drizzle-orm"
import { chromium } from "playwright"

import { db, dbClient } from "../src/db/index.server"
import { directoryListings } from "../src/db/schema"

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const
const PAGE_SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  "out/generated-listing-page-shots",
)
const GENERATED_IMAGE_DIR = path.resolve(
  process.cwd(),
  "public/generated/listings",
)
const IMAGE_REQUEST_TIMEOUT_MS = 60_000
const IMAGE_REQUEST_MAX_ATTEMPTS = 2
const VIEWPORT = {
  width: 1440,
  height: 960,
} as const

type CandidateListing = {
  id: string
  name: string
  assetBaseName: string
  sourceUrl: string
  externalUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  productType: string | null
  domain: string | null
  scope: string | null
  existingGeneratedImageUrl?: string
  manualRecordIndex?: number
}

type ScriptArgs = {
  concurrency: number
  dryRun: boolean
  force: boolean
  limit: number | null
  id: string | null
  input: string | null
  help: boolean
}

type GeneratedImage = {
  buffer: Buffer
  mimeType: string
}

type ManualListingRecord = {
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
  categorySlug?: string | null
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    concurrency: 4,
    dryRun: false,
    force: false,
    limit: null,
    id: null,
    input: null,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      out.help = true
      continue
    }
    if (arg === "--dry-run") {
      out.dryRun = true
      continue
    }
    if (arg === "--force") {
      out.force = true
      continue
    }
    if (arg === "--concurrency" || arg === "-c") {
      const raw = argv[++i]
      const value = Number.parseInt(raw ?? "", 10)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --concurrency value "${raw ?? ""}"`)
      }
      out.concurrency = value
      continue
    }
    if (arg === "--limit" || arg === "-l") {
      const raw = argv[++i]
      const value = Number.parseInt(raw ?? "", 10)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value "${raw ?? ""}"`)
      }
      out.limit = value
      continue
    }
    if (arg === "--id") {
      out.id = argv[++i] ?? null
      continue
    }
    if (arg === "--input" || arg === "-i") {
      out.input = argv[++i] ?? null
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run generate:listing-images -- [options]

Options:
      --dry-run       Capture screenshots and generate files, but do not update the database or JSON
      --force         Reprocess even if a generated marketing image already exists
  -c, --concurrency <n> Run up to n listings in parallel (default: 4)
  -l, --limit <n>     Process at most n listings
      --id <listing>  Process a single listing id
  -i, --input <path>  Process a manual listings JSON file instead of the database
  -h, --help          Show help
`)
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ""
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_API_KEY is required. Set it in your environment variables.",
    )
  }
  return key
}

function getListingUrl(listing: CandidateListing): string | null {
  return listing.externalUrl || listing.sourceUrl || null
}

function isGeneratedImageUrl(url: string): boolean {
  return url.startsWith("/generated/listings/")
}

async function findExistingGeneratedImageUrl(
  listing: CandidateListing,
): Promise<string | null> {
  for (const url of listing.screenshotUrls) {
    if (!isGeneratedImageUrl(url)) {
      continue
    }

    const filePath = path.resolve(process.cwd(), "public", url.replace(/^\//, ""))

    try {
      await stat(filePath)
      return url
    } catch {
      continue
    }
  }

  for (const extension of [".png", ".jpg", ".webp"]) {
    try {
      await stat(path.resolve(GENERATED_IMAGE_DIR, `${listing.assetBaseName}${extension}`))
      return `/generated/listings/${listing.assetBaseName}${extension}`
    } catch {
      continue
    }
  }

  return null
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "listing"
}

function getContentHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 10)
}

function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return ".jpg"
  if (mimeType === "image/webp") return ".webp"
  return ".png"
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function parseManualListingRecord(value: unknown, rowIndex: number): ManualListingRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Row ${rowIndex}: expected object`)
  }

  const row = value as Record<string, unknown>
  const screenshotUrls = Array.isArray(row.screenshotUrls)
    ? row.screenshotUrls.map((entry, screenshotIndex) => {
        if (typeof entry !== "string") {
          throw new Error(
            `Row ${rowIndex}: expected screenshotUrls[${screenshotIndex}] to be a string`,
          )
        }
        return entry
      })
    : []

  if (typeof row.name !== "string" || row.name.length === 0) {
    throw new Error(`Row ${rowIndex}: expected non-empty string for name`)
  }

  if (typeof row.sourceUrl !== "string" || row.sourceUrl.length === 0) {
    throw new Error(`Row ${rowIndex}: expected non-empty string for sourceUrl`)
  }

  return {
    name: row.name,
    sourceUrl: row.sourceUrl,
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

async function readManualListingRecords(inputPath: string): Promise<ManualListingRecord[]> {
  const absoluteInputPath = path.resolve(process.cwd(), inputPath)
  const raw = await readFile(absoluteInputPath, "utf8")
  const data: unknown = JSON.parse(raw)

  if (!Array.isArray(data)) {
    throw new Error(`Expected ${inputPath} to contain a JSON array`)
  }

  return data.map((row, index) => parseManualListingRecord(row, index))
}

function buildPageScreenshotPath(listing: CandidateListing, url: string): string {
  const baseName = `${listing.assetBaseName}-${getContentHash(`${listing.id}:${url}`)}.png`
  return path.resolve(PAGE_SCREENSHOT_DIR, baseName)
}

function buildGeneratedImageTarget(listing: CandidateListing, mimeType: string): {
  absolutePath: string
  publicPath: string
} {
  const extension = getExtensionFromMimeType(mimeType)
  const baseName = `${listing.assetBaseName}${extension}`

  return {
    absolutePath: path.resolve(GENERATED_IMAGE_DIR, baseName),
    publicPath: `/generated/listings/${baseName}`,
  }
}

function buildMarketingPrompt(listing: CandidateListing, pageUrl: string): string {
  const metadata = [
    `Name: ${listing.name}`,
    `URL: ${pageUrl}`,
    listing.tagline ? `Tagline: ${listing.tagline}` : null,
    listing.productType ? `Product type: ${listing.productType}` : null,
    listing.domain ? `Domain: ${listing.domain}` : null,
    listing.scope ? `Scope: ${listing.scope}` : null,
    listing.fullDescription ? `Description: ${listing.fullDescription}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n")

  return `Create a polished product-marketing image for this software listing using the provided website screenshot as reference.

Goals:
- Preserve the brand feeling, palette, and product category suggested by the screenshot.
- Produce a clean, aspirational hero image suitable for an app directory card or product detail page.
- Show a plausible product UI or marketing composition inspired by the screenshot, but improve clarity and composition.
- Keep it realistic and product-focused, not abstract art.
- If the listing is dev focused and doesnt have much branding to work with, use this fallback style:
  - Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.
  - Use soft 3D gradients, glossy lighting, rounded cards, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.
  - Composition: wide 16:9 banner with richer decorative energy.
  - Show layered foreground, midground, and background depth with floating app-like tiles and abstract interface hints.

Constraints:
- No device mockups, browser chrome, cursors, or visible cookie banners.
- No watermarks.
- No tiny unreadable text blocks.
- Avoid adding extra logos unless they are clearly implied by the source.
- Use a landscape composition that reads well when cropped to a wide card.

Listing metadata:
${metadata}`
}

async function captureReferenceScreenshot(
  listing: CandidateListing,
  url: string,
): Promise<{ buffer: Buffer; filePath: string }> {
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    })

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.waitForTimeout(2_500)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })

    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
    })

    const filePath = buildPageScreenshotPath(listing, url)
    await writeFile(filePath, buffer)

    return {
      buffer,
      filePath,
    }
  } finally {
    await browser.close()
  }
}

async function generateMarketingImage(
  screenshot: Buffer,
  listing: CandidateListing,
  pageUrl: string,
): Promise<GeneratedImage> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`
  let lastError: unknown = null

  for (let attempt = 1; attempt <= IMAGE_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-goog-api-key": getGeminiApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildMarketingPrompt(listing, pageUrl),
                },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: screenshot.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
        signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        throw new Error(`Gemini image request failed: ${await response.text()}`)
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: {
                data?: string
                mimeType?: string
              }
            }>
          }
        }>
      }

      const imagePart = json.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data,
      )?.inlineData

      if (!imagePart?.data) {
        throw new Error(`No image data returned by Gemini: ${JSON.stringify(json)}`)
      }

      return {
        buffer: Buffer.from(imagePart.data, "base64"),
        mimeType: imagePart.mimeType ?? "image/png",
      }
    } catch (error) {
      lastError = error

      if (attempt < IMAGE_REQUEST_MAX_ATTEMPTS) {
        console.warn(
          `Image generation attempt ${attempt} failed for ${listing.name}; retrying...`,
        )
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function saveGeneratedImage(
  listing: CandidateListing,
  image: GeneratedImage,
): Promise<string> {
  const target = buildGeneratedImageTarget(listing, image.mimeType)
  await writeFile(target.absolutePath, image.buffer)
  return target.publicPath
}

async function getCandidateListings(args: ScriptArgs): Promise<CandidateListing[]> {
  if (args.input) {
    const rows = await readManualListingRecords(args.input)
    const candidates: CandidateListing[] = []

    for (const [index, row] of rows.entries()) {
      if (args.id && row.sourceUrl !== args.id) {
        continue
      }

      if (getListingUrl(row) === null) {
        continue
      }

      const candidate: CandidateListing = {
        id: row.sourceUrl,
        name: row.name,
        assetBaseName: `${slugify(row.name)}-screenshot`,
        sourceUrl: row.sourceUrl,
        externalUrl: row.externalUrl,
        screenshotUrls: row.screenshotUrls,
        tagline: row.tagline,
        fullDescription: row.fullDescription,
        productType: row.productType,
        domain: row.domain,
        scope: row.scope,
        manualRecordIndex: index,
      }

      const existingGeneratedImageUrl = args.force
        ? null
        : await findExistingGeneratedImageUrl(candidate)

      if (existingGeneratedImageUrl) {
        if (row.screenshotUrls.length > 0) {
          continue
        }

        candidate.existingGeneratedImageUrl = existingGeneratedImageUrl
        candidates.push(candidate)
      } else {
        candidates.push(candidate)
      }

      if (candidates.length >= (args.limit ?? Number.POSITIVE_INFINITY)) {
        break
      }
    }

    return candidates
  }

  const rows = await db
    .select({
      id: directoryListings.id,
      name: directoryListings.name,
      sourceUrl: directoryListings.sourceUrl,
      externalUrl: directoryListings.externalUrl,
      screenshotUrls: directoryListings.screenshotUrls,
      tagline: directoryListings.tagline,
      fullDescription: directoryListings.fullDescription,
      productType: directoryListings.productType,
      domain: directoryListings.domain,
      scope: directoryListings.scope,
    })
    .from(directoryListings)
    .orderBy(desc(directoryListings.updatedAt), desc(directoryListings.createdAt))

  const candidates: CandidateListing[] = []

  for (const row of rows) {
    if (args.id && row.id !== args.id) {
      continue
    }

    if (getListingUrl(row) === null) {
      continue
    }

      if (!args.force && (await findExistingGeneratedImageUrl(row))) {
      continue
    }

    candidates.push(row)

    if (candidates.length >= (args.limit ?? Number.POSITIVE_INFINITY)) {
      break
    }
  }

  return candidates
}

async function processListing(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<{ manualRecordIndex: number; publicPath: string } | null> {
  if (!args.force && listing.existingGeneratedImageUrl) {
    console.log(
      `Reusing existing generated image for ${listing.name} -> ${listing.existingGeneratedImageUrl}`,
    )

    return typeof listing.manualRecordIndex === "number"
      ? {
          manualRecordIndex: listing.manualRecordIndex,
          publicPath: listing.existingGeneratedImageUrl,
        }
      : null
  }

  const pageUrl = getListingUrl(listing)
  if (!pageUrl) {
    console.log(`Skipping ${listing.name} (${listing.id}) because it has no usable URL.`)
    return null
  }

  console.log(`Processing ${listing.name} (${listing.id}) -> ${pageUrl}`)

  const { buffer: screenshotBuffer, filePath: screenshotPath } =
    await captureReferenceScreenshot(listing, pageUrl)
  console.log(`Saved page screenshot -> ${screenshotPath}`)

  const generated = await generateMarketingImage(screenshotBuffer, listing, pageUrl)
  const publicPath = await saveGeneratedImage(listing, generated)
  console.log(`Saved generated image -> ${publicPath}`)

  if (args.dryRun) {
    console.log(`Dry run enabled; leaving database row unchanged for ${listing.name}.`)
    return null
  }

  if (typeof listing.manualRecordIndex === "number") {
    return {
      manualRecordIndex: listing.manualRecordIndex,
      publicPath,
    }
  }

  await db
    .update(directoryListings)
    .set({
      screenshotUrls: [publicPath],
      updatedAt: new Date(),
    })
    .where(eq(directoryListings.id, listing.id))

  console.log(`Updated screenshotUrls for ${listing.name}.`)
  return null
}

async function writeManualListingRecords(
  inputPath: string,
  records: ManualListingRecord[],
): Promise<void> {
  const absoluteInputPath = path.resolve(process.cwd(), inputPath)
  await writeFile(absoluteInputPath, JSON.stringify(records, null, 2) + "\n")
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  await mkdir(PAGE_SCREENSHOT_DIR, { recursive: true })
  await mkdir(GENERATED_IMAGE_DIR, { recursive: true })

  const candidates = await getCandidateListings(args)
  if (candidates.length === 0) {
    console.log("No matching listings need image generation.")
    return
  }

  console.log(`Found ${candidates.length} listing(s) to process.`)
  const concurrency = Math.min(args.concurrency, candidates.length)
  let nextIndex = 0
  const manualRecords = args.input ? await readManualListingRecords(args.input) : null
  const manualUpdates = new Map<number, string>()

  async function worker(): Promise<void> {
    while (nextIndex < candidates.length) {
      const listing = candidates[nextIndex]
      nextIndex += 1

      if (!listing) {
        return
      }

      try {
        const result = await processListing(listing, args)
        if (result) {
          manualUpdates.set(result.manualRecordIndex, result.publicPath)
        }
      } catch (error) {
        console.error(`Failed for ${listing.name} (${listing.id}).`)
        console.error(error)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  if (manualRecords && manualUpdates.size > 0 && !args.dryRun) {
    for (const [recordIndex, publicPath] of manualUpdates) {
      const record = manualRecords[recordIndex]
      if (!record) {
        continue
      }
      record.screenshotUrls = [publicPath]
    }

    await writeManualListingRecords(args.input, manualRecords)
    console.log(`Updated ${manualUpdates.size} manual listing record(s) in ${args.input}.`)
  }
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
