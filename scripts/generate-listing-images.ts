#!/usr/bin/env node
import "dotenv/config"

import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

import { desc, eq } from "drizzle-orm"
import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"
import { geminiFlashGenerateImageFromPromptAndImage } from "../src/lib/gemini-flash-image-gen"
import { buildIconPolishFromSiteAssetPrompt } from "../src/lib/listing-icon-prompts"
import { captureListingPageScreenshotForGeneration } from "../src/lib/listing-page-screenshot"
import {
  discoverSiteBrandIconAsset,
  rasterizeBrandIconForGeminiInput,
} from "../src/lib/site-brand-icon"

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const
const PAGE_SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  "out/generated-listing-page-shots",
)
const GENERATED_IMAGE_DIR = path.resolve(
  process.cwd(),
  "public/generated/listings",
)
const GENERATED_ICON_DIR = path.resolve(
  process.cwd(),
  "public/generated/listing-icons",
)
const IMAGE_REQUEST_TIMEOUT_MS = 60_000
const IMAGE_REQUEST_MAX_ATTEMPTS = 2
type CandidateListing = {
  id: string
  slug: string
  name: string
  assetBaseName: string
  sourceUrl: string
  externalUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  productType: string | null
  domain: string | null
  scope: string | null
  existingGeneratedImageUrl?: string
}

function taxonomyHintsFromCategorySlugs(
  slugs: string[] | null | undefined,
): Pick<CandidateListing, "productType" | "domain" | "scope"> {
  const primary = slugs?.[0]?.trim()
  if (!primary) {
    return { productType: null, domain: null, scope: null }
  }
  const parts = primary.split("/").map((s) => s.trim()).filter(Boolean)
  return {
    productType: parts[0] ?? null,
    domain: parts[1] ?? null,
    scope: primary,
  }
}

type ScriptArgs = {
  concurrency: number
  dryRun: boolean
  force: boolean
  icon: boolean
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
    icon: false,
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
    if (arg === "--icon") {
      out.icon = true
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
      --dry-run       Capture screenshots and generate files, but do not update store_listings
      --force         Reprocess even if a generated marketing image already exists
      --icon          Build listing icons: prefer site /logo paths, manifest, link icons, then favicon (upscaled); otherwise Gemini from a page screenshot
  -c, --concurrency <n> Run up to n listings in parallel (default: 4)
  -l, --limit <n>     Process at most n listings
      --id <listing>  Process a single listing id
  -i, --input <path>  Same as DB mode, but listing rows are read from JSON; each row must exist in store_listings (matched by sourceUrl)
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

function isGeneratedIconUrl(url: string): boolean {
  return url.startsWith("/generated/listing-icons/")
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

async function findExistingGeneratedIconUrl(
  listing: CandidateListing,
): Promise<string | null> {
  const raw = listing.iconUrl?.trim()
  if (!raw || !isGeneratedIconUrl(raw)) {
    return null
  }
  const filePath = path.resolve(process.cwd(), "public", raw.replace(/^\//, ""))
  try {
    await stat(filePath)
    return raw
  } catch {
    return null
  }
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
- **Always include the listing name** from metadata (the "Name:" line) as prominent, legible typography in the image—e.g. title or headline treatment. Spell it exactly as given; this is product identification, not conversion copy.
- Show a plausible marketing composition inspired by the screenshot; improve clarity and composition. Illustrative **mock product UI** (windows, panels, toolbars, in-app controls) is fine—read as the **product**, not a marketing funnel.
- If the reference is dominated by CTAs, signup strips, or "Get started"-style conversion blocks, do not recreate that focal layout—borrow palette and mood only.
- Keep it realistic and product-focused, not abstract art.
- If the listing is dev focused and doesnt have much branding to work with, use this fallback style:
  - Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.
  - Use soft 3D gradients, glossy lighting, rounded cards, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.
  - Composition: wide 16:9 banner with richer decorative energy.
  - Show layered foreground, midground, and background depth with abstract shapes and energy—still no marketing CTA text or conversion-style hero strips.

Constraints:
- No device mockups, browser chrome, cursors, or visible cookie banners.
- **CTAs only:** Do not use marketing / conversion copy as readable text—e.g. "Get started", "Sign up", "Try it free", "Learn more", "Subscribe", "Download", "Contact sales", "Book a demo". Buttons and controls are **allowed** when they read as **in-product mock UI** (neutral toolbars, editors, settings)—not as the main signup or sales pitch.
- No watermarks.
- No tiny unreadable text blocks.
- Avoid adding extra logos unless they are clearly implied by the source.
- Use a landscape composition that reads well when cropped to a wide card.

Listing metadata:
${metadata}`
}

function buildIconPrompt(listing: CandidateListing, pageUrl: string): string {
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

  return `Create a polished product icon for this software listing using the provided website screenshot as reference.

Format (required):
- Output must be exactly 1:1 — a square image (equal width and height), not a rectangle or wide banner.
- Do not add a separate "container" shape: no rounded-square plate, squircle, circle mask, glossy bubble, drop-shadow tile, or fake 3D app icon backing. The brand mark sits directly on a flat fill or transparent background across the full square.
- Safe padding only as empty margin around the mark — not an extra outlined shape.

Goals:
- Preserve the brand feeling, palette, and primary visual motif suggested by the screenshot.
- Produce a crisp standalone mark that reads clearly at small sizes in a software directory.
- Favor a simple, memorable symbol over a detailed illustration.

Style fallback order:
- If the site already suggests a clear brand mark or symbol, refine that mark only — still full-bleed square, no extra outer shape.
- If the site mostly uses a wordmark, extract one simple motif or monogram that still feels native to the brand.
- If the brand is weak or developer-tooling oriented: soft solid or gradient fill across the entire square (no inner rounded card), one centered motif, minimal detail.

Constraints:
- No browser chrome, screenshots, UI mockups, or website layouts.
- No tiny text, taglines, or readable words unless a single letter is essential to the brand.
- Avoid photorealism and avoid generic clip-art.
- Keep edges clean; readable on light or dark backgrounds.

Listing metadata:
${metadata}`
}

async function captureReferenceScreenshot(
  listing: CandidateListing,
  url: string,
): Promise<{ buffer: Buffer; filePath: string }> {
  const buffer = await captureListingPageScreenshotForGeneration(url)
  const filePath = buildPageScreenshotPath(listing, url)
  await writeFile(filePath, buffer)

  return {
    buffer,
    filePath,
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

async function generateIconImage(
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
                  text: buildIconPrompt(listing, pageUrl),
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
          `Icon generation attempt ${attempt} failed for ${listing.name}; retrying...`,
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
    const manualRows = await readManualListingRecords(args.input)
    const candidates: CandidateListing[] = []

    for (const row of manualRows) {
      if (args.id && row.sourceUrl !== args.id) {
        continue
      }

      const [match] = await db
        .select({
          id: storeListings.id,
          slug: storeListings.slug,
          categorySlugs: storeListings.categorySlugs,
          screenshotUrls: storeListings.screenshotUrls,
          iconUrl: storeListings.iconUrl,
        })
        .from(storeListings)
        .where(eq(storeListings.sourceUrl, row.sourceUrl))
        .limit(1)

      if (!match) {
        console.warn(
          `[generate:listing-images] No store_listings row for sourceUrl=${row.sourceUrl}; skip (import listing first).`,
        )
        continue
      }

      const hints = taxonomyHintsFromCategorySlugs(match.categorySlugs)
      const candidate: CandidateListing = {
        id: match.id,
        slug: match.slug,
        name: row.name,
        assetBaseName: `${match.slug}-screenshot`,
        sourceUrl: row.sourceUrl,
        externalUrl: row.externalUrl,
        iconUrl: match.iconUrl,
        screenshotUrls:
          match.screenshotUrls.length > 0 ? match.screenshotUrls : row.screenshotUrls,
        tagline: row.tagline,
        fullDescription: row.fullDescription,
        ...hints,
      }

      if (getListingUrl(candidate) === null) {
        continue
      }

      if (args.icon) {
        if (!args.force && (await findExistingGeneratedIconUrl(candidate))) {
          continue
        }
        candidates.push(candidate)
      } else {
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
      }

      if (candidates.length >= (args.limit ?? Number.POSITIVE_INFINITY)) {
        break
      }
    }

    return candidates
  }

  const rows = await db
    .select({
      id: storeListings.id,
      slug: storeListings.slug,
      name: storeListings.name,
      sourceUrl: storeListings.sourceUrl,
      externalUrl: storeListings.externalUrl,
      iconUrl: storeListings.iconUrl,
      screenshotUrls: storeListings.screenshotUrls,
      tagline: storeListings.tagline,
      fullDescription: storeListings.fullDescription,
      categorySlugs: storeListings.categorySlugs,
    })
    .from(storeListings)
    .orderBy(desc(storeListings.updatedAt), desc(storeListings.createdAt))

  const candidates: CandidateListing[] = []

  for (const row of rows) {
    if (args.id && row.id !== args.id) {
      continue
    }

    const hints = taxonomyHintsFromCategorySlugs(row.categorySlugs)
    const candidate: CandidateListing = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      assetBaseName: `${row.slug}-screenshot`,
      sourceUrl: row.sourceUrl,
      externalUrl: row.externalUrl,
      iconUrl: row.iconUrl,
      screenshotUrls: row.screenshotUrls,
      tagline: row.tagline,
      fullDescription: row.fullDescription,
      ...hints,
    }

    if (getListingUrl(candidate) === null) {
      continue
    }

    if (args.icon) {
      if (!args.force && (await findExistingGeneratedIconUrl(candidate))) {
        continue
      }
    } else if (!args.force && (await findExistingGeneratedImageUrl(candidate))) {
      continue
    }

    candidates.push(candidate)

    if (candidates.length >= (args.limit ?? Number.POSITIVE_INFINITY)) {
      break
    }
  }

  return candidates
}

async function processListing(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<void> {
  if (!args.force && listing.existingGeneratedImageUrl) {
    console.log(
      `Reusing existing generated image for ${listing.name} -> ${listing.existingGeneratedImageUrl}`,
    )
    return
  }

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
    .update(storeListings)
    .set({
      heroImageUrl: publicPath,
      screenshotUrls: [publicPath],
      updatedAt: new Date(),
    })
    .where(eq(storeListings.id, listing.id))

  console.log(`Updated store_listings hero + screenshot URLs for ${listing.name}.`)
}

async function processListingIcon(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<void> {
  const pageUrl = getListingUrl(listing)
  if (!pageUrl) {
    console.log(`Skipping ${listing.name} (${listing.id}) because it has no usable URL.`)
    return
  }

  console.log(`Processing icon for ${listing.name} (${listing.id}) -> ${pageUrl}`)

  let image: GeneratedImage
  const discovered = await discoverSiteBrandIconAsset(pageUrl)
  if (discovered) {
    try {
      console.log(
        `Discovered site favicon/logo; refining with Gemini for ${listing.name}`,
      )
      const pngIn = await rasterizeBrandIconForGeminiInput(
        discovered.bytes,
        discovered.contentType,
      )
      image = await geminiFlashGenerateImageFromPromptAndImage({
        prompt: buildIconPolishFromSiteAssetPrompt({
          name: listing.name,
          pageUrl,
          tagline: listing.tagline,
          productType: listing.productType,
          domain: listing.domain,
          scope: listing.scope,
        }),
        imageBytes: pngIn,
        imageMimeType: "image/png",
      })
    } catch (error) {
      console.warn(
        `Site asset + Gemini failed for ${listing.name}; falling back to page screenshot.`,
        error,
      )
      const { buffer: screenshotBuffer, filePath: screenshotPath } =
        await captureReferenceScreenshot(listing, pageUrl)
      console.log(`Saved page screenshot -> ${screenshotPath}`)
      image = await generateIconImage(screenshotBuffer, listing, pageUrl)
    }
  } else {
    console.log(`No suitable site icon; using Gemini for ${listing.name}`)
    const { buffer: screenshotBuffer, filePath: screenshotPath } =
      await captureReferenceScreenshot(listing, pageUrl)
    console.log(`Saved page screenshot -> ${screenshotPath}`)
    image = await generateIconImage(screenshotBuffer, listing, pageUrl)
  }

  const extension = getExtensionFromMimeType(image.mimeType)
  const fileName = `${listing.slug}-icon${extension}`
  const absolutePath = path.resolve(GENERATED_ICON_DIR, fileName)
  await mkdir(GENERATED_ICON_DIR, { recursive: true })
  await writeFile(absolutePath, image.buffer)
  const publicPath = `/generated/listing-icons/${fileName}`
  console.log(`Saved icon -> ${publicPath}`)

  if (args.dryRun) {
    console.log(`Dry run enabled; leaving database row unchanged for ${listing.name}.`)
    return
  }

  await db
    .update(storeListings)
    .set({
      iconUrl: publicPath,
      updatedAt: new Date(),
    })
    .where(eq(storeListings.id, listing.id))

  console.log(`Updated store_listings iconUrl for ${listing.name}.`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  await mkdir(PAGE_SCREENSHOT_DIR, { recursive: true })
  await mkdir(GENERATED_IMAGE_DIR, { recursive: true })
  await mkdir(GENERATED_ICON_DIR, { recursive: true })

  const candidates = await getCandidateListings(args)
  if (candidates.length === 0) {
    console.log(
      args.icon
        ? "No matching listings need icon generation."
        : "No matching listings need image generation.",
    )
    return
  }

  console.log(
    `Found ${candidates.length} listing(s) to process${args.icon ? " (icons)" : " (hero images)"}.`,
  )
  const concurrency = Math.min(args.concurrency, candidates.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < candidates.length) {
      const listing = candidates[nextIndex]
      nextIndex += 1

      if (!listing) {
        return
      }

      try {
        if (args.icon) {
          await processListingIcon(listing, args)
        } else {
          await processListing(listing, args)
        }
      } catch (error) {
        console.error(`Failed for ${listing.name} (${listing.id}).`)
        console.error(error)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
