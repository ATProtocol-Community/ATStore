#!/usr/bin/env node
import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import * as cheerio from "cheerio"
import { desc, eq } from "drizzle-orm"
import { chromium, type Browser, type Page } from "playwright"

import { FETCH_USER_AGENT, resolveUrl } from "./scrape-bluesky-directory/scrape.ts"

const PAGE_TIMEOUT_MS = 20_000
const ICON_TIMEOUT_MS = 15_000
const MANIFEST_TIMEOUT_MS = 10_000
const GENERATED_ICON_DIR = path.resolve(
  process.cwd(),
  "public/generated/listing-icons",
)

let svgValidationBrowser: Browser | null = null
let svgValidationPage: Page | null = null

type CandidateListing = {
  id: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  iconUrl: string | null
}

type ScriptArgs = {
  dryRun: boolean
  force: boolean
  limit: number | null
  id: string | null
  delayMs: number
  help: boolean
}

type IconSource =
  | "manifest"
  | "apple-touch-icon"
  | "icon-link"
  | "meta-image"
  | "favicon"

type IconCandidate = {
  url: string
  source: IconSource
  rel: string | null
  sizes: string | null
  purpose: string | null
  score: number
  note: string
}

type SelectedIcon = {
  pageUrl: string
  candidate: IconCandidate
  finalUrl: string
  contentType: string
  bytes: Buffer
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    limit: null,
    id: null,
    delayMs: 250,
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
    if (arg === "--id") {
      out.id = argv[++i] ?? null
      continue
    }
    if (arg === "--delay-ms") {
      const value = Number(argv[++i] ?? "250")
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid --delay-ms value "${argv[i] ?? ""}"`)
      }
      out.delayMs = value
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

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run backfill:listing-icons -- [options]

Options:
      --dry-run        Scrape and report icon candidates without updating the database
      --force          Re-scrape listings even when iconUrl is already set
  -l, --limit <n>      Process at most n listings
      --id <listing>   Process a single listing id
      --delay-ms <n>   Delay between listings (default: 250)
  -h, --help           Show help

Selection order:
  1. Web app manifest icons
  2. apple-touch icons
  3. linked rel="icon" assets
  4. icon-like meta images
  5. conventional favicon paths such as /favicon.ico
`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasIcon(listing: CandidateListing): boolean {
  return typeof listing.iconUrl === "string" && listing.iconUrl.trim().length > 0
}

function getPageUrl(listing: CandidateListing): string | null {
  return listing.externalUrl || listing.sourceUrl || null
}

function normalizeSpace(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized.length > 0 ? normalized : null
}

function looksLikeImageUrl(url: string): boolean {
  try {
    if (url.startsWith("data:image/")) return true
    const pathname = new URL(url).pathname.toLowerCase()
    return /\.(avif|gif|ico|jpe?g|png|svg|webp)$/.test(pathname)
  } catch {
    return false
  }
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "listing"
}

function getExtensionFromContentType(contentType: string): string {
  if (contentType === "image/png") return ".png"
  if (contentType === "image/jpeg") return ".jpg"
  if (contentType === "image/webp") return ".webp"
  if (contentType === "image/gif") return ".gif"
  if (contentType === "image/x-icon" || contentType === "image/vnd.microsoft.icon") {
    return ".ico"
  }
  if (contentType === "image/svg+xml") return ".svg"
  return ".img"
}

function getUrlHintScore(url: string): number {
  const haystack = url.toLowerCase()
  let score = 0

  if (
    /(icon|icons|app-icon|appicon|favicon|apple-touch|tileimage|maskable)/.test(
      haystack,
    )
  ) {
    score += 55
  }
  if (/(logo|avatar|brandmark|mark)\b/.test(haystack)) {
    score += 30
  }
  if (/(banner|card|cover|hero|social|share|screenshot)/.test(haystack)) {
    score -= 90
  }
  if (haystack.endsWith(".svg")) {
    score += 40
  }

  return score
}

function parseLargestIconSize(sizes: string | null): {
  largest: number | null
  hasAny: boolean
  hasNonSquare: boolean
} {
  if (!sizes) {
    return { largest: null, hasAny: false, hasNonSquare: false }
  }

  const normalized = sizes.toLowerCase().trim()
  if (normalized.includes("any")) {
    return { largest: null, hasAny: true, hasNonSquare: false }
  }

  let largest: number | null = null
  let hasNonSquare = false

  for (const token of normalized.split(/\s+/)) {
    const match = token.match(/^(\d+)x(\d+)$/)
    if (!match) continue
    const width = Number.parseInt(match[1] ?? "0", 10)
    const height = Number.parseInt(match[2] ?? "0", 10)
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    if (width !== height) hasNonSquare = true
    const candidateSize = Math.max(width, height)
    if (largest === null || candidateSize > largest) {
      largest = candidateSize
    }
  }

  return { largest, hasAny: false, hasNonSquare }
}

function scoreCandidate(candidate: Omit<IconCandidate, "score">): number {
  let score =
    candidate.source === "manifest"
      ? 500
      : candidate.source === "apple-touch-icon"
        ? 430
        : candidate.source === "icon-link"
          ? 360
          : candidate.source === "meta-image"
            ? 220
            : 160

  const rel = candidate.rel?.toLowerCase() ?? ""
  const purpose = candidate.purpose?.toLowerCase() ?? ""
  const sizeInfo = parseLargestIconSize(candidate.sizes)

  if (rel.includes("apple-touch-icon")) score += 40
  if (rel.includes("shortcut")) score += 10
  if (rel.includes("mask-icon")) score -= 180
  if (purpose.includes("maskable")) score += 35
  if (purpose.includes("monochrome")) score -= 40

  if (sizeInfo.hasAny) {
    score += 60
  } else if (sizeInfo.largest !== null) {
    if (sizeInfo.largest >= 512) score += 120
    else if (sizeInfo.largest >= 256) score += 90
    else if (sizeInfo.largest >= 192) score += 70
    else if (sizeInfo.largest >= 96) score += 40
    else if (sizeInfo.largest >= 32) score += 20
  }

  if (sizeInfo.hasNonSquare) score -= 70
  score += getUrlHintScore(candidate.url)

  return score
}

function makeCandidate(input: Omit<IconCandidate, "score">): IconCandidate {
  return {
    ...input,
    score: scoreCandidate(input),
  }
}

async function fetchHtmlDocument(pageUrl: string): Promise<{ finalUrl: string; html: string }> {
  const response = await fetch(pageUrl, {
    redirect: "follow",
    headers: {
      "user-agent": FETCH_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${pageUrl}`)
  }

  return {
    finalUrl: response.url || pageUrl,
    html: await response.text(),
  }
}

function collectLinkedIconCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): IconCandidate[] {
  const candidates: IconCandidate[] = []

  $("link[rel][href]").each((_, element) => {
    const rel = normalizeSpace($(element).attr("rel"))
    const href = normalizeSpace($(element).attr("href"))
    if (!rel || !href) return

    const relLower = rel.toLowerCase()
    if (relLower.includes("manifest")) return
    if (!/\b(icon|apple-touch-icon|mask-icon|fluid-icon)\b/.test(relLower)) return

    const source: IconSource = relLower.includes("apple-touch-icon")
      ? "apple-touch-icon"
      : relLower.includes("icon")
        ? "icon-link"
        : "favicon"

    candidates.push(
      makeCandidate({
        url: resolveUrl(href, baseUrl),
        source,
        rel,
        sizes: normalizeSpace($(element).attr("sizes")),
        purpose: null,
        note: `link rel="${rel}"`,
      }),
    )
  })

  return candidates
}

function collectMetaImageCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): IconCandidate[] {
  const candidates: IconCandidate[] = []

  $("meta[content]").each((_, element) => {
    const rawContent = normalizeSpace($(element).attr("content"))
    if (!rawContent) return

    const prop =
      normalizeSpace($(element).attr("property")) ||
      normalizeSpace($(element).attr("name")) ||
      normalizeSpace($(element).attr("itemprop"))

    if (!prop) return

    const propLower = prop.toLowerCase()
    if (
      ![
        "msapplication-tileimage",
        "og:image",
        "og:image:url",
        "twitter:image",
        "twitter:image:src",
        "image",
      ].includes(propLower)
    ) {
      return
    }

    const resolvedUrl = resolveUrl(rawContent, baseUrl)
    const iconLike =
      propLower === "msapplication-tileimage" ||
      /(icon|logo|avatar|favicon|apple-touch|tileimage|app-icon|appicon)/.test(
        `${propLower} ${resolvedUrl}`.toLowerCase(),
      )

    if (!iconLike) return

    candidates.push(
      makeCandidate({
        url: resolvedUrl,
        source: "meta-image",
        rel: prop,
        sizes: null,
        purpose: null,
        note: `meta ${prop}`,
      }),
    )
  })

  return candidates
}

async function collectManifestCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Promise<IconCandidate[]> {
  const manifestUrls = new Set<string>()

  $("link[rel][href]").each((_, element) => {
    const rel = normalizeSpace($(element).attr("rel"))?.toLowerCase()
    const href = normalizeSpace($(element).attr("href"))
    if (!rel || !href) return
    if (!rel.split(/\s+/).includes("manifest")) return
    manifestUrls.add(resolveUrl(href, baseUrl))
  })

  const candidates: IconCandidate[] = []

  for (const manifestUrl of manifestUrls) {
    try {
      const response = await fetch(manifestUrl, {
        redirect: "follow",
        headers: {
          "user-agent": FETCH_USER_AGENT,
          accept: "application/manifest+json,application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
      })

      if (!response.ok) continue

      const manifest = (await response.json()) as {
        icons?: Array<{
          src?: string
          sizes?: string
          purpose?: string
        }>
      }

      for (const icon of manifest.icons ?? []) {
        const src = normalizeSpace(icon?.src)
        if (!src) continue

        candidates.push(
          makeCandidate({
            url: resolveUrl(src, response.url || manifestUrl),
            source: "manifest",
            rel: "manifest",
            sizes: normalizeSpace(icon?.sizes),
            purpose: normalizeSpace(icon?.purpose),
            note: `manifest ${manifestUrl}`,
          }),
        )
      }
    } catch {
      // Ignore manifest fetch issues and continue with HTML-derived candidates.
    }
  }

  return candidates
}

function collectConventionalFallbackCandidates(baseUrl: string): IconCandidate[] {
  const fallbackSpecs: Array<{
    href: string
    source: IconSource
    rel: string
    sizes: string | null
  }> = [
    {
      href: "/apple-touch-icon.png",
      source: "apple-touch-icon",
      rel: "apple-touch-icon",
      sizes: "180x180",
    },
    {
      href: "/apple-touch-icon-precomposed.png",
      source: "apple-touch-icon",
      rel: "apple-touch-icon-precomposed",
      sizes: "180x180",
    },
    {
      href: "/favicon-32x32.png",
      source: "favicon",
      rel: "favicon",
      sizes: "32x32",
    },
    {
      href: "/favicon-16x16.png",
      source: "favicon",
      rel: "favicon",
      sizes: "16x16",
    },
    {
      href: "/favicon.png",
      source: "favicon",
      rel: "favicon",
      sizes: null,
    },
    {
      href: "/favicon.ico",
      source: "favicon",
      rel: "favicon",
      sizes: null,
    },
  ]

  return fallbackSpecs.map((spec) =>
    makeCandidate({
      url: resolveUrl(spec.href, baseUrl),
      source: spec.source,
      rel: spec.rel,
      sizes: spec.sizes,
      purpose: null,
      note: `conventional ${spec.href}`,
    }),
  )
}

function dedupeCandidates(candidates: IconCandidate[]): IconCandidate[] {
  const bestByUrl = new Map<string, IconCandidate>()

  for (const candidate of candidates) {
    const existing = bestByUrl.get(candidate.url)
    if (!existing || candidate.score > existing.score) {
      bestByUrl.set(candidate.url, candidate)
    }
  }

  return [...bestByUrl.values()].sort(
    (left, right) => right.score - left.score || left.url.localeCompare(right.url),
  )
}

function bufferLooksLikeHtml(buffer: Buffer): boolean {
  const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 256)).trimStart()
  return /^(<!doctype html\b|<html\b|<head\b|<body\b)/i.test(prefix)
}

async function probeImageUrl(
  url: string,
): Promise<{ finalUrl: string; contentType: string; bytes: Buffer } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const match = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s)
      if (!match) return null
      const contentType = match[1]?.toLowerCase() ?? "unknown"
      const isBase64 = Boolean(match[2])
      const rawPayload = match[3] ?? ""
      const bytes = isBase64
        ? Buffer.from(rawPayload, "base64")
        : Buffer.from(decodeURIComponent(rawPayload), "utf8")

      return {
        finalUrl: url,
        contentType,
        bytes,
      }
    }

    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": FETCH_USER_AGENT,
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
    })

    if (!response.ok) {
      return null
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase()
    const finalUrl = response.url || url
    const body = Buffer.from(await response.arrayBuffer())
    const isImageByType = contentType.startsWith("image/")
    const isPotentialImageByUrl =
      looksLikeImageUrl(finalUrl) &&
      (contentType === "" || contentType === "application/octet-stream")
    const isImage =
      isImageByType || (isPotentialImageByUrl && !bufferLooksLikeHtml(body))

    if (!isImage) {
      return null
    }

    return {
      finalUrl,
      contentType: contentType || "unknown",
      bytes: body,
    }
  } catch {
    return null
  }
}

async function getSvgValidationPage(): Promise<Page> {
  if (svgValidationPage) {
    return svgValidationPage
  }

  svgValidationBrowser = await chromium.launch({ headless: true })
  svgValidationPage = await svgValidationBrowser.newPage()
  return svgValidationPage
}

async function browserCanRenderImage(url: string): Promise<boolean> {
  const page = await getSvgValidationPage()
  await page.setContent(`<img id="icon" src="${url}" />`)
  await page.waitForTimeout(750)

  return page.evaluate(() => {
    const image = document.getElementById("icon")
    if (!(image instanceof HTMLImageElement)) return false
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  })
}

async function materializeDataUrlIcon(
  listing: CandidateListing,
  probed: { finalUrl: string; contentType: string; bytes: Buffer },
): Promise<{ finalUrl: string; contentType: string; bytes: Buffer }> {
  if (!probed.finalUrl.startsWith("data:image/")) {
    return probed
  }

  await mkdir(GENERATED_ICON_DIR, { recursive: true })

  const extension = getExtensionFromContentType(probed.contentType)
  const fileName = `${slugify(listing.name)}-${listing.id}${extension}`
  const absolutePath = path.resolve(GENERATED_ICON_DIR, fileName)
  const publicPath = `/generated/listing-icons/${fileName}`

  await writeFile(absolutePath, probed.bytes)

  return {
    ...probed,
    finalUrl: publicPath,
  }
}

async function selectBestIcon(listing: CandidateListing): Promise<SelectedIcon | null> {
  const pageUrl = getPageUrl(listing)
  if (!pageUrl) return null

  const document = await fetchHtmlDocument(pageUrl)
  const $ = cheerio.load(document.html)

  const rankedCandidates = dedupeCandidates([
    ...(await collectManifestCandidates($, document.finalUrl)),
    ...collectLinkedIconCandidates($, document.finalUrl),
    ...collectMetaImageCandidates($, document.finalUrl),
    ...collectConventionalFallbackCandidates(document.finalUrl),
  ])

  for (const candidate of rankedCandidates) {
    const probed = await probeImageUrl(candidate.url)
    if (!probed) continue
    if (probed.contentType === "image/svg+xml") {
      const renders = await browserCanRenderImage(probed.finalUrl)
      if (!renders) continue
    }
    const normalized = await materializeDataUrlIcon(listing, probed)

    return {
      pageUrl: document.finalUrl,
      candidate,
      finalUrl: normalized.finalUrl,
      contentType: normalized.contentType,
      bytes: normalized.bytes,
    }
  }

  return null
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const [{ db, dbClient }, { directoryListings }] = await Promise.all([
    import("../src/db/index.server"),
    import("../src/db/schema"),
  ])

  try {
    await mkdir(GENERATED_ICON_DIR, { recursive: true })

    const rows = await db
      .select({
        id: directoryListings.id,
        name: directoryListings.name,
        sourceUrl: directoryListings.sourceUrl,
        externalUrl: directoryListings.externalUrl,
        iconUrl: directoryListings.iconUrl,
      })
      .from(directoryListings)
      .orderBy(desc(directoryListings.updatedAt), desc(directoryListings.createdAt))

    const candidates = rows
      .filter((row) => (args.id ? row.id === args.id : true))
      .filter((row) => (args.force ? true : !hasIcon(row)))
      .filter((row) => getPageUrl(row) !== null)
      .slice(0, args.limit ?? Number.POSITIVE_INFINITY)

    if (candidates.length === 0) {
      console.log("No matching listings need icon backfill.")
      return
    }

    console.log(`Found ${candidates.length} listing(s) to process.`)

    let updated = 0
    let skipped = 0
    let failed = 0

    for (const listing of candidates) {
      const pageUrl = getPageUrl(listing)
      console.log(`Processing ${listing.name} (${listing.id}) -> ${pageUrl}`)

      try {
        const selected = await selectBestIcon(listing)
        if (!selected) {
          skipped += 1
          console.log(`No usable icon found for ${listing.name}.`)
        } else {
          console.log(
            `Selected ${selected.finalUrl} [${selected.candidate.source}; score=${selected.candidate.score}; ${selected.contentType}]`,
          )

          if (!args.dryRun) {
            await db
              .update(directoryListings)
              .set({
                iconUrl: selected.finalUrl,
                updatedAt: new Date(),
              })
              .where(eq(directoryListings.id, listing.id))
          }

          updated += 1
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
      `${args.dryRun ? "Dry run finished" : "Done"}: ${updated} updated, ${skipped} no-icon, ${failed} failed.`,
    )
  } finally {
    if (svgValidationPage) {
      await svgValidationPage.close().catch(() => {})
      svgValidationPage = null
    }
    if (svgValidationBrowser) {
      await svgValidationBrowser.close().catch(() => {})
      svgValidationBrowser = null
    }
    await dbClient.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
