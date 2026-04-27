#!/usr/bin/env node
/**
 * Iterate verified listings and capture a "hero candidate" for each one:
 *   1. Try to fetch <meta property="og:image"> from the listing's external URL root.
 *   2. If no og:image is found (or it fails to download), capture a Chromium screenshot.
 *
 * Results are written incrementally to `out/hero-candidates/index.json` so the script
 * can be killed and resumed. Images live next to the index in `out/hero-candidates/`.
 *
 * Consumed by the dev-only admin page at /admin/hero-candidates.
 */
import "dotenv/config"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import * as cheerio from "cheerio"
import { and, desc, eq } from "drizzle-orm"

import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"
import { getAtstoreRepoDid } from "../src/lib/atproto/publish-directory-listing"
import { captureListingPageScreenshotForGeneration } from "../src/lib/listing-page-screenshot"

const CANDIDATES_DIR = path.resolve(
  process.cwd(),
  "out/hero-candidates",
)
const INDEX_PATH = path.resolve(CANDIDATES_DIR, "index.json")
const FETCH_TIMEOUT_MS = 25_000
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const ACCEPT_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
])

type CandidateKind = "og" | "screenshot"

type Candidate = {
  kind: CandidateKind
  /** Filename relative to `out/hero-candidates/` (e.g. `<slug>-og.png`). */
  filename: string
  /** Original URL we fetched it from (or the page URL when kind === "screenshot"). */
  sourceUrl: string
  /** Stored MIME type so the admin route can serve it with the right header. */
  mimeType: string
  /** Bytes on disk. */
  byteSize: number
  fetchedAt: string
}

type IndexEntry = {
  id: string
  slug: string
  name: string
  externalUrl: string | null
  sourceUrl: string
  currentHeroImageUrl: string | null
  candidate: Candidate | null
  status: "ok" | "no-candidate" | "error"
  error: string | null
  fetchedAt: string
}

type IndexFile = {
  generatedAt: string
  entries: IndexEntry[]
}

type ScriptArgs = {
  limit: number | null
  id: string | null
  force: boolean
  concurrency: number
  help: boolean
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    limit: null,
    id: null,
    force: false,
    concurrency: 4,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      out.help = true
      continue
    }
    if (arg === "--force") {
      out.force = true
      continue
    }
    if (arg === "--id") {
      out.id = argv[++i] ?? null
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
    if (arg === "--concurrency" || arg === "-c") {
      const raw = argv[++i]
      const value = Number.parseInt(raw ?? "", 10)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --concurrency value "${raw ?? ""}"`)
      }
      out.concurrency = value
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run scrape:product-hero-candidates -- [options]

Walks verified store_listings, fetches each one's og:image (fallback: page screenshot)
and writes the result iteratively to out/hero-candidates/index.json.

Options:
      --force           Re-fetch entries that already have a candidate on disk
      --id <listing>    Only process a single listing id
  -l, --limit <n>       Process at most n listings
  -c, --concurrency <n> Run up to n listings in parallel (default: 4)
  -h, --help            Show this help
`)
}

async function loadIndex(): Promise<IndexFile> {
  try {
    const raw = await readFile(INDEX_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<IndexFile>
    if (Array.isArray(parsed.entries)) {
      return {
        generatedAt: parsed.generatedAt ?? new Date().toISOString(),
        entries: parsed.entries as IndexEntry[],
      }
    }
  } catch {
    /* missing or unreadable — start fresh */
  }
  return { generatedAt: new Date().toISOString(), entries: [] }
}

async function persistIndex(index: IndexFile): Promise<void> {
  const tmp = `${INDEX_PATH}.tmp`
  await writeFile(tmp, JSON.stringify(index, null, 2))
  const { rename } = await import("node:fs/promises")
  await rename(tmp, INDEX_PATH)
}

function extensionForMime(mime: string): string {
  const lower = mime.toLowerCase()
  if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg"
  if (lower.includes("webp")) return ".webp"
  if (lower.includes("gif")) return ".gif"
  if (lower.includes("avif")) return ".avif"
  return ".png"
}

function resolveAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

async function discoverOgImageUrl(pageUrl: string): Promise<string | null> {
  let html: string
  try {
    const response = await fetch(pageUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return null
    }
    const contentType = response.headers.get("content-type") ?? ""
    if (
      contentType &&
      !/text\/html|application\/xhtml/i.test(contentType)
    ) {
      return null
    }
    html = await response.text()
  } catch {
    return null
  }

  const $ = cheerio.load(html)
  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | undefined) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed) return
    const absolute = resolveAbsoluteUrl(trimmed, pageUrl)
    if (!absolute) return
    if (seen.has(absolute)) return
    seen.add(absolute)
    candidates.push(absolute)
  }

  $('meta[property="og:image:secure_url"]').each((_, el) =>
    push($(el).attr("content")),
  )
  $('meta[property="og:image"]').each((_, el) => push($(el).attr("content")))
  $('meta[property="og:image:url"]').each((_, el) =>
    push($(el).attr("content")),
  )
  $('meta[name="og:image"]').each((_, el) => push($(el).attr("content")))
  $('meta[name="twitter:image"]').each((_, el) =>
    push($(el).attr("content")),
  )
  $('meta[name="twitter:image:src"]').each((_, el) =>
    push($(el).attr("content")),
  )

  return candidates[0] ?? null
}

async function downloadImage(
  imageUrl: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl, {
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_USER_AGENT,
        accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const declared = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim()
      .toLowerCase()
    const mimeType =
      declared && ACCEPT_IMAGE_MIME.has(declared) ? declared : "image/png"
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength < 256) {
      return null
    }
    return { bytes: buffer, mimeType }
  } catch {
    return null
  }
}

async function captureScreenshot(
  pageUrl: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    const buffer = await captureListingPageScreenshotForGeneration(pageUrl)
    if (buffer.byteLength < 256) return null
    return { bytes: buffer, mimeType: "image/png" }
  } catch (error) {
    console.warn(
      `Screenshot failed for ${pageUrl}:`,
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises")
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

type Listing = {
  id: string
  slug: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  heroImageUrl: string | null
}

function getListingPageUrl(listing: Listing): string | null {
  const ext = listing.externalUrl?.trim()
  if (ext) return ext
  const src = listing.sourceUrl.trim()
  return src || null
}

async function processListing(
  listing: Listing,
  args: ScriptArgs,
  existingByListingId: Map<string, IndexEntry>,
): Promise<IndexEntry> {
  const pageUrl = getListingPageUrl(listing)
  const previous = existingByListingId.get(listing.id) ?? null

  if (
    !args.force &&
    previous?.candidate &&
    (await fileExists(path.resolve(CANDIDATES_DIR, previous.candidate.filename)))
  ) {
    return previous
  }

  if (!pageUrl) {
    return {
      id: listing.id,
      slug: listing.slug,
      name: listing.name,
      externalUrl: listing.externalUrl,
      sourceUrl: listing.sourceUrl,
      currentHeroImageUrl: listing.heroImageUrl,
      candidate: null,
      status: "no-candidate",
      error: "No external or source URL on listing.",
      fetchedAt: new Date().toISOString(),
    }
  }

  let candidate: Candidate | null = null
  let lastError: string | null = null

  const ogUrl = await discoverOgImageUrl(pageUrl)
  if (ogUrl) {
    const downloaded = await downloadImage(ogUrl)
    if (downloaded) {
      const ext = extensionForMime(downloaded.mimeType)
      const filename = `${listing.slug}-og${ext}`
      await writeFile(
        path.resolve(CANDIDATES_DIR, filename),
        new Uint8Array(downloaded.bytes),
      )
      candidate = {
        kind: "og",
        filename,
        sourceUrl: ogUrl,
        mimeType: downloaded.mimeType,
        byteSize: downloaded.bytes.byteLength,
        fetchedAt: new Date().toISOString(),
      }
    } else {
      lastError = `Found og:image (${ogUrl}) but couldn't download it.`
    }
  }

  if (!candidate) {
    const shot = await captureScreenshot(pageUrl)
    if (shot) {
      const filename = `${listing.slug}-shot.png`
      await writeFile(
        path.resolve(CANDIDATES_DIR, filename),
        new Uint8Array(shot.bytes),
      )
      candidate = {
        kind: "screenshot",
        filename,
        sourceUrl: pageUrl,
        mimeType: shot.mimeType,
        byteSize: shot.bytes.byteLength,
        fetchedAt: new Date().toISOString(),
      }
    } else if (!lastError) {
      lastError = "Screenshot capture failed and no og:image was discovered."
    }
  }

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    externalUrl: listing.externalUrl,
    sourceUrl: listing.sourceUrl,
    currentHeroImageUrl: listing.heroImageUrl,
    candidate,
    status: candidate ? "ok" : lastError ? "error" : "no-candidate",
    error: candidate ? null : lastError,
    fetchedAt: new Date().toISOString(),
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  await mkdir(CANDIDATES_DIR, { recursive: true })

  const index = await loadIndex()
  const existingByListingId = new Map<string, IndexEntry>()
  for (const entry of index.entries) {
    existingByListingId.set(entry.id, entry)
  }

  const atstoreRepoDid = await getAtstoreRepoDid()
  const rows = await db
    .select({
      id: storeListings.id,
      slug: storeListings.slug,
      name: storeListings.name,
      sourceUrl: storeListings.sourceUrl,
      externalUrl: storeListings.externalUrl,
      heroImageUrl: storeListings.heroImageUrl,
    })
    .from(storeListings)
    .where(
      and(
        eq(storeListings.verificationStatus, "verified"),
        eq(storeListings.repoDid, atstoreRepoDid),
      ),
    )
    .orderBy(desc(storeListings.updatedAt), desc(storeListings.createdAt))

  const queue: Listing[] = []
  for (const row of rows) {
    if (args.id && row.id !== args.id) continue
    queue.push(row)
    if (args.limit && queue.length >= args.limit) break
  }

  if (queue.length === 0) {
    console.log("No listings to process.")
    return
  }

  console.log(
    `Processing ${queue.length} verified listing(s) with concurrency=${args.concurrency}.`,
  )

  let writeChain: Promise<void> = Promise.resolve()
  const updateAndPersist = (entry: IndexEntry): Promise<void> => {
    writeChain = writeChain.then(async () => {
      const existingIndex = index.entries.findIndex(
        (current) => current.id === entry.id,
      )
      if (existingIndex >= 0) {
        index.entries[existingIndex] = entry
      } else {
        index.entries.push(entry)
      }
      index.generatedAt = new Date().toISOString()
      await persistIndex(index)
    })
    return writeChain
  }

  let nextIndex = 0
  const concurrency = Math.min(args.concurrency, queue.length)
  let processed = 0

  async function worker(): Promise<void> {
    while (nextIndex < queue.length) {
      const listing = queue[nextIndex]
      nextIndex += 1
      if (!listing) return

      try {
        const entry = await processListing(listing, args, existingByListingId)
        existingByListingId.set(listing.id, entry)
        await updateAndPersist(entry)
        processed += 1
        const tag = entry.candidate?.kind ?? entry.status
        console.log(
          `  [${processed}/${queue.length}] ${listing.name} -> ${tag}${
            entry.error ? ` (${entry.error})` : ""
          }`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`Failed for ${listing.name} (${listing.id}):`, message)
        const entry: IndexEntry = {
          id: listing.id,
          slug: listing.slug,
          name: listing.name,
          externalUrl: listing.externalUrl,
          sourceUrl: listing.sourceUrl,
          currentHeroImageUrl: listing.heroImageUrl,
          candidate: null,
          status: "error",
          error: message,
          fetchedAt: new Date().toISOString(),
        }
        existingByListingId.set(listing.id, entry)
        await updateAndPersist(entry)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  await writeChain

  console.log(`Done. Wrote ${INDEX_PATH}.`)
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
