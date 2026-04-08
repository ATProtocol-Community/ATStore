#!/usr/bin/env node
/**
 * Read an existing Bluesky Directory scrape JSON array and fill in (or refresh)
 * `visitOutUrl` + `externalUrl` by following directory /out redirects.
 * Does not call Anthropic.
 */
import "dotenv/config"

import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { deriveVisitOutUrl, resolveExternalUrl } from "./scrape.ts"

const RESOLVE_TIMEOUT_MS = 30_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs(argv: string[]) {
  const out: {
    input: string
    output: string | null
    force: boolean
    delayMs: number
    help: boolean
  } = {
    input: "",
    output: null,
    force: false,
    delayMs: 400,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--help" || a === "-h") out.help = true
    else if (a === "--force") out.force = true
    else if (a === "--input" || a === "-i") out.input = argv[++i] ?? ""
    else if (a === "--output" || a === "-o") out.output = argv[++i] ?? null
    else if (a === "--delay-ms") out.delayMs = Number(argv[++i] ?? "400")
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run backfill:bluesky-external-urls -- --input <path> [options]

Options:
  -i, --input <path>   Input JSON array (required)
  -o, --output <path>  Output path (default: overwrite --input)
      --force            Re-resolve externalUrl even when already set
      --delay-ms <n>     Delay between HTTP requests (default: 400)
  -h, --help             Show help

Each resolve uses a ${RESOLVE_TIMEOUT_MS / 1000}s fetch timeout. Rows that already have externalUrl are skipped unless --force.
`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.input) {
    printHelp()
    process.exit(args.input ? 0 : 1)
  }

  const inputPath = resolve(process.cwd(), args.input)
  const outputPath = resolve(process.cwd(), args.output ?? args.input)

  const raw = await readFile(inputPath, "utf8")
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new Error("Expected a JSON array")
  }

  let updated = 0
  let skipped = 0

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, unknown>
    const sourceUrl = row.sourceUrl
    if (typeof sourceUrl !== "string" || !sourceUrl) {
      console.error(`Skipping row ${i}: missing sourceUrl`)
      continue
    }

    const hasExternal =
      row.externalUrl != null &&
      typeof row.externalUrl === "string" &&
      row.externalUrl.length > 0

    if (!args.force && hasExternal) {
      skipped += 1
      continue
    }

    const visitOutUrl =
      typeof row.visitOutUrl === "string" && row.visitOutUrl.length > 0
        ? row.visitOutUrl
        : deriveVisitOutUrl(sourceUrl)

    process.stderr.write(`[${i + 1}/${data.length}] ${sourceUrl}\n`)

    try {
      const externalUrl = await resolveExternalUrl(visitOutUrl, {
        timeoutMs: RESOLVE_TIMEOUT_MS,
      })
      data[i] = { ...row, visitOutUrl, externalUrl }
      updated += 1
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`  warn: ${message}`)
      data[i] = {
        ...row,
        visitOutUrl,
        externalUrl:
          typeof row.externalUrl === "string" ? row.externalUrl : null,
      }
    }

    if (args.delayMs > 0) {
      await sleep(args.delayMs)
    }
  }

  await writeFile(outputPath, JSON.stringify(data, null, 2), "utf8")
  console.error(
    `Done. Wrote ${data.length} rows to ${outputPath} (${updated} updated, ${skipped} skipped with existing externalUrl).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
