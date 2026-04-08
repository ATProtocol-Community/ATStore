#!/usr/bin/env node
import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
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
const VIEWPORT = {
  width: 1440,
  height: 960,
} as const

type CandidateListing = {
  id: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  productType: string | null
  domain: string | null
  scope: string | null
}

type ScriptArgs = {
  dryRun: boolean
  force: boolean
  limit: number | null
  id: string | null
  help: boolean
}

type GeneratedImage = {
  buffer: Buffer
  mimeType: string
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    limit: null,
    id: null,
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

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run generate:listing-images -- [options]

Options:
      --dry-run       Capture screenshots and generate files, but do not update the database
      --force         Reprocess even if screenshotUrls already has an image
  -l, --limit <n>     Process at most n listings
      --id <listing>  Process a single listing id
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

function hasGeneratedImage(listing: CandidateListing): boolean {
  return listing.screenshotUrls.some((url) => typeof url === "string" && url.length > 0)
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

function buildPageScreenshotPath(listing: CandidateListing, url: string): string {
  const baseName = `${slugify(listing.name)}-${getContentHash(`${listing.id}:${url}`)}.png`
  return path.resolve(PAGE_SCREENSHOT_DIR, baseName)
}

function buildGeneratedImageTarget(listing: CandidateListing, mimeType: string): {
  absolutePath: string
  publicPath: string
} {
  const extension = getExtensionFromMimeType(mimeType)
  const baseName = `${slugify(listing.name)}-${listing.id}${extension}`

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

  return rows
    .filter((row) => (args.id ? row.id === args.id : true))
    .filter((row) => (args.force ? true : !hasGeneratedImage(row)))
    .filter((row) => getListingUrl(row) !== null)
    .slice(0, args.limit ?? Number.POSITIVE_INFINITY)
}

async function processListing(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<void> {
  const pageUrl = getListingUrl(listing)
  if (!pageUrl) {
    console.log(`Skipping ${listing.name} (${listing.id}) because it has no usable URL.`)
    return
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
    return
  }

  await db
    .update(directoryListings)
    .set({
      screenshotUrls: [publicPath],
      updatedAt: new Date(),
    })
    .where(eq(directoryListings.id, listing.id))

  console.log(`Updated screenshotUrls for ${listing.name}.`)
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

  for (const listing of candidates) {
    try {
      await processListing(listing, args)
    } catch (error) {
      console.error(`Failed for ${listing.name} (${listing.id}).`)
      console.error(error)
    }
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
