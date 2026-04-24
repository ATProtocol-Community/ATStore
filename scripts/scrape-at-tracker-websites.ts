#!/usr/bin/env node
import * as cheerio from "cheerio"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"

const TRACKER_URL = "https://at-tracker.opensci.dev/"
const DEFAULT_OUTPUT_PATH = "scripts/output/at-tracker-websites.txt"
const FETCH_USER_AGENT = "at-store-at-tracker-scraper/1.0 (+https://github.com/)"

type ScriptArgs = {
  outputPath: string
  includeListed: boolean
  printStdout: boolean
}

type DomainWebsite = {
  domain: string
  websiteUrl: string
}

function parseArgs(argv: string[]): ScriptArgs {
  let outputPath = DEFAULT_OUTPUT_PATH
  let includeListed = false
  let printStdout = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--include-listed") {
      includeListed = true
      continue
    }
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

  return { outputPath, includeListed, printStdout }
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

function getNextPageUrl(html: string): string | null {
  const $ = cheerio.load(html)
  const nextHref = $("a[href]").filter((_, el) => $(el).text().trim() === "Next").first().attr("href")
  if (!nextHref) return null
  return new URL(nextHref, TRACKER_URL).toString()
}

function extractDomainWebsites(html: string): DomainWebsite[] {
  const matches = html.matchAll(
    /href="\/domain\/([^"?]+)\?from=[^"]*".*?<a href="(https?:\/\/[^"#]+)" target="_blank"/gis,
  )
  const rows: DomainWebsite[] = []

  for (const match of matches) {
    const domain = match[1]?.trim().toLowerCase()
    const websiteUrl = match[2]?.trim()
    if (domain && websiteUrl) {
      rows.push({ domain, websiteUrl })
    }
  }

  return rows
}

function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null

  const raw = value.trim().toLowerCase()
  if (!raw) return null

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`

  try {
    const hostname = new URL(candidate).hostname.toLowerCase().replace(/\.+$/, "")
    if (!hostname) return null
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname
  } catch {
    return null
  }
}

type ListedIndex = {
  hosts: Set<string>
  slugs: Set<string>
}

async function loadListedIndexFromDb(): Promise<ListedIndex> {
  const rows = await db
    .select({
      sourceUrl: storeListings.sourceUrl,
      externalUrl: storeListings.externalUrl,
      slug: storeListings.slug,
    })
    .from(storeListings)

  const hosts = new Set<string>()
  const slugs = new Set<string>()
  for (const row of rows) {
    const externalHost = normalizeHost(row.externalUrl)
    if (externalHost) {
      hosts.add(externalHost)
    }

    const sourceHost = normalizeHost(row.sourceUrl)
    if (sourceHost) {
      hosts.add(sourceHost)
    }

    if (row.slug) {
      slugs.add(row.slug.toLowerCase())
    }
  }

  return { hosts, slugs }
}

function getDomainLeaf(domain: string): string | null {
  const parts = domain.split(".").filter((part) => part.length > 0)
  if (parts.length === 0) return null
  return parts[parts.length - 1]?.toLowerCase() ?? null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const allRows: DomainWebsite[] = []
  const seenPageUrls = new Set<string>()

  let page = 1
  let pageUrl: string | null = TRACKER_URL
  while (pageUrl) {
    if (seenPageUrls.has(pageUrl)) {
      break
    }
    seenPageUrls.add(pageUrl)

    const html = await fetchHtml(pageUrl)
    const rows = extractDomainWebsites(html)
    if (rows.length === 0) {
      break
    }
    allRows.push(...rows)

    console.log(`Parsed ${rows.length} domains from page ${page}`)
    pageUrl = getNextPageUrl(html)
    page += 1
  }

  const domainToWebsite = new Map<string, string>()
  for (const row of allRows) {
    if (!domainToWebsite.has(row.domain)) {
      domainToWebsite.set(row.domain, row.websiteUrl)
    }
  }

  const listedIndex = args.includeListed
    ? { hosts: new Set<string>(), slugs: new Set<string>() }
    : await loadListedIndexFromDb()

  const filteredEntries = [...domainToWebsite.entries()].filter(([domain, websiteUrl]) => {
    if (args.includeListed) return true
    const websiteHost = normalizeHost(websiteUrl)
    if (listedIndex.hosts.has(domain)) return false
    if (websiteHost && listedIndex.hosts.has(websiteHost)) return false
    const leaf = getDomainLeaf(domain)
    if (leaf && listedIndex.slugs.has(leaf)) return false
    return true
  })

  const lines = filteredEntries
    .map(([domain, websiteUrl]) => `${domain} -> ${websiteUrl}`)
    .sort((a, b) => a.localeCompare(b))

  const absoluteOutputPath = resolve(process.cwd(), args.outputPath)
  await mkdir(dirname(absoluteOutputPath), { recursive: true })
  await writeFile(absoluteOutputPath, lines.join("\n") + "\n", "utf8")

  if (!args.includeListed) {
    console.log(`Filtered out ${domainToWebsite.size - lines.length} already-listed domain(s)`)
    console.log(`Compared against current DB store listings`)
  }
  console.log(`\nWrote ${lines.length} website entries to ${absoluteOutputPath}`)

  if (args.printStdout) {
    console.log("\n---")
    console.log(lines.join("\n"))
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
