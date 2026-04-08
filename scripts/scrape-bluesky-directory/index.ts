#!/usr/bin/env node
import "dotenv/config"

/**
 * Crawl https://blueskydirectory.com listing pages, scrape product details,
 * optionally classify each product with Anthropic using a closed 2-level taxonomy.
 *
 * Discovery uses a Playwright browser pass first so we can paginate Livewire listing views
 * and exercise homepage type filters that do not exist as plain links in SSR HTML.
 * If browser discovery fails, we fall back to the previous HTML-only crawl.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { classifyProduct } from "./anthropic.ts"
import {
  BASE_ORIGIN,
  PRODUCT_PATH_PREFIXES,
  collectListingUrls,
  deriveVisitOutUrl,
  enrichWithExternalUrl,
  extractProductUrlsFromHtml,
  fetchHtml,
  parseProductDetail,
  resolveExternalUrl,
  type ScrapedProduct,
} from "./scrape.ts"

export type OutputRecord = ScrapedProduct & {
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
  error: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs(argv: string[]) {
  const out: {
    output: string
    maxProducts: number | null
    maxVisits: number
    dryRun: boolean
    delayMs: number
    maxPagesPerListing: number
    listingBases: string[]
    followRelated: boolean
    help: boolean
  } = {
    output: "out/bluesky-directory-scrape.json",
    maxProducts: null,
    maxVisits: 400,
    dryRun: false,
    delayMs: 400,
    maxPagesPerListing: 0,
    listingBases: ["/", ...PRODUCT_PATH_PREFIXES.map((p) => `/${p}`)],
    followRelated: true,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--help" || a === "-h") out.help = true
    else if (a === "--dry-run") out.dryRun = true
    else if (a === "--no-follow-related") out.followRelated = false
    else if (a === "--output" || a === "-o") {
      out.output = argv[++i] ?? out.output
    } else if (a === "--max-products" || a === "-n") {
      out.maxProducts = Number(argv[++i] ?? "NaN")
    } else if (a === "--max-visits") {
      out.maxVisits = Number(argv[++i] ?? "NaN")
    } else if (a === "--delay-ms") {
      out.delayMs = Number(argv[++i] ?? "0")
    } else if (a === "--max-pages") {
      out.maxPagesPerListing = Number(argv[++i] ?? "0")
    } else if (a === "--listings") {
      const raw = argv[++i] ?? ""
      out.listingBases = raw.split(",").map((s) => s.trim()).filter(Boolean)
    }
  }

  if (
    out.maxProducts !== null &&
    (!Number.isFinite(out.maxProducts) || out.maxProducts < 0)
  ) {
    throw new Error("--max-products must be a non-negative number")
  }
  if (!Number.isFinite(out.maxVisits) || out.maxVisits < 1) {
    throw new Error("--max-visits must be a positive number")
  }
  if (!Number.isFinite(out.maxPagesPerListing) || out.maxPagesPerListing < 0) {
    throw new Error("--max-pages must be a non-negative number")
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run scrape:bluesky -- [options]

Options:
  -o, --output <path>     Output JSON array file, appended after each product (default: out/bluesky-directory-scrape.json)
  -n, --max-products <n>  Max products to output (omit for unlimited within --max-visits)
      --max-visits <n>    Max unique product pages to fetch (default: 400)
      --dry-run           Skip Anthropic; scrape only
      --delay-ms <n>      Delay between requests (default: 400)
      --max-pages <n>     Listing pagination depth per filtered/listing view (default: 0 = all pages)
      --listings <urls>   Comma-separated listing bases (e.g. /,/clients,/utilities)
      --no-follow-related Only use URLs found on listing pages (no related-product BFS)
  -h, --help              Show help

Environment:
  ANTHROPIC_API_KEY or ANTHROPIC_KEY   Required unless --dry-run
  ANTHROPIC_MODEL                      Optional (default: claude-sonnet-4-20250514)
`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  console.error(
    `Discovering seed product URLs from listings: ${args.listingBases.join(", ")}`,
  )
  const seeds = await collectListingUrls({
    listingBases: args.listingBases.map((b) =>
      b === "/" ? BASE_ORIGIN : b.startsWith("http") ? b : `${BASE_ORIGIN}${b}`,
    ),
    maxPagesPerListing: args.maxPagesPerListing,
    delayMs: args.delayMs,
  })

  const queue = [...new Set(seeds)].sort()
  const visited = new Set<string>()
  let recordsWritten = 0
  let firstRecord = true

  const outPath = resolve(process.cwd(), args.output)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, "[", "utf8")

  async function writeRecord(rec: OutputRecord): Promise<void> {
    const sep = firstRecord ? "\n" : ",\n"
    firstRecord = false
    await appendFile(outPath, sep + JSON.stringify(rec, null, 2), "utf8")
    recordsWritten += 1
  }

  console.error(
    `Starting crawl: ${queue.length} seed URLs, followRelated=${args.followRelated}, maxVisits=${args.maxVisits}`,
  )

  try {
    while (queue.length > 0) {
      if (visited.size >= args.maxVisits) {
        console.error("Reached --max-visits; stopping.")
        break
      }
      if (args.maxProducts !== null && recordsWritten >= args.maxProducts) {
        console.error("Reached --max-products; stopping.")
        break
      }

      const url = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      process.stderr.write(`[${visited.size}/${args.maxVisits}] ${url}\n`)

      let html: string
      try {
        html = await fetchHtml(url)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        const visitOutUrl = deriveVisitOutUrl(url)
        let externalUrl: string | null = null
        try {
          externalUrl = await resolveExternalUrl(visitOutUrl)
        } catch {
          externalUrl = null
        }
        await writeRecord({
          name: "Unknown",
          sourceUrl: url,
          visitOutUrl,
          externalUrl,
          iconUrl: null,
          screenshotUrls: [],
          tagline: null,
          fullDescription: null,
          rawCategoryHint: null,
          scope: null,
          productType: null,
          domain: null,
          vertical: null,
          classificationReason: null,
          error: message,
        })
        await sleep(args.delayMs)
        continue
      }

      if (args.followRelated) {
        const more = extractProductUrlsFromHtml(html, url)
        for (const u of more) {
          if (!visited.has(u)) queue.push(u)
        }
      }

      const scraped = await enrichWithExternalUrl(parseProductDetail(html, url))

      if (args.dryRun) {
        await writeRecord({
          ...scraped,
          scope: null,
          productType: null,
          domain: null,
          vertical: null,
          classificationReason: null,
          error: null,
        })
      } else {
        try {
          const { scope, productType, domain, vertical, classificationReason } =
            await classifyProduct({
              name: scraped.name,
              tagline: scraped.tagline,
              fullDescription: scraped.fullDescription,
              rawCategoryHint: scraped.rawCategoryHint,
              sourceUrl: scraped.sourceUrl,
              visitOutUrl: scraped.visitOutUrl,
              externalUrl: scraped.externalUrl,
            })
          await writeRecord({
            ...scraped,
            scope,
            productType,
            domain,
            vertical,
            classificationReason,
            error: null,
          })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          await writeRecord({
            ...scraped,
            scope: null,
            productType: null,
            domain: null,
            vertical: null,
            classificationReason: null,
            error: message,
          })
        }
      }

      await sleep(args.delayMs)
    }
  } finally {
    await appendFile(outPath, "\n]\n", "utf8")
  }

  console.error(`Finished ${recordsWritten} records in ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
