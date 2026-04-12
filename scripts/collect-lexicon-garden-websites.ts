#!/usr/bin/env node
import * as cheerio from "cheerio"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const BROWSE_URL = "https://lexicon.garden/browse"
const DEFAULT_OUTPUT_PATH = "scripts/output/lexicon-garden-websites.txt"
const FETCH_USER_AGENT = "at-store-lexicon-garden-site-scraper/1.0 (+https://github.com/)"
const PAGE_CONCURRENCY = 8

type ScriptArgs = {
  outputPath: string
  printStdout: boolean
}

function parseArgs(argv: string[]): ScriptArgs {
  let outputPath = DEFAULT_OUTPUT_PATH
  let printStdout = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--stdout") {
      printStdout = true
      continue
    }
    if (arg === "--out") {
      const next = argv[i + 1]
      if (!next) {
        throw new Error("Missing value for --out")
      }
      outputPath = next
      i += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return { outputPath, printStdout }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": FETCH_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

function extractTlds(html: string): string[] {
  const $ = cheerio.load(html)
  const tlds = new Set<string>()

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return

    const match = href.match(/^\/browse\/([a-z0-9-]+)$/i)
    if (!match?.[1]) return

    tlds.add(match[1].toLowerCase())
  })

  return [...tlds].sort((a, b) => a.localeCompare(b))
}

function extractWebsitesForTld(html: string, tld: string): string[] {
  const $ = cheerio.load(html)
  const websites = new Set<string>()
  const escapedTld = tld.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const lexiconPattern = new RegExp(`^/browse/${escapedTld}\\.([a-z0-9.-]+)$`, "i")

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return

    const match = href.match(lexiconPattern)
    const domain = match?.[1]?.trim()
    if (!domain) return

    websites.add(`${domain.toLowerCase()}.${tld}`)
  })

  return [...websites]
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return

      results[index] = await mapper(items[index] as TItem)
    }
  })

  await Promise.all(workers)
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rootHtml = await fetchHtml(BROWSE_URL)
  const tlds = extractTlds(rootHtml)

  if (tlds.length === 0) {
    throw new Error("No TLD pages found on Lexicon Garden browse page")
  }

  console.log(`Found ${tlds.length} TLD pages`)

  const nestedWebsiteLists = await mapWithConcurrency(
    tlds,
    PAGE_CONCURRENCY,
    async (tld) => {
      const tldPageUrl = `${BROWSE_URL}/${encodeURIComponent(tld)}`
      const html = await fetchHtml(tldPageUrl)
      const websites = extractWebsitesForTld(html, tld)
      console.log(`Parsed ${websites.length} websites from ${tld}`)
      return websites
    },
  )

  const websites = [...new Set(nestedWebsiteLists.flat())].sort((a, b) =>
    a.localeCompare(b),
  )

  const absoluteOutputPath = resolve(process.cwd(), args.outputPath)
  await mkdir(dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, websites.join("\n") + "\n", "utf8")

  console.log(`\nWrote ${websites.length} websites to ${absoluteOutputPath}`)

  if (args.printStdout) {
    console.log("\n---")
    console.log(websites.join("\n"))
  }
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
