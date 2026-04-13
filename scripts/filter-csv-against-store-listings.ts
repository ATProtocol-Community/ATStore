#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"

const DEFAULT_INPUT_PATH = "ariel.csv"
const DEFAULT_UNLISTED_OUTPUT_PATH = "ariel.unlisted.csv"
const DEFAULT_MATCHED_OUTPUT_PATH = "ariel.already-listed.csv"

type ScriptArgs = {
  inputPath: string
  unlistedOutputPath: string
  matchedOutputPath: string
}

function parseArgs(argv: string[]): ScriptArgs {
  let inputPath = DEFAULT_INPUT_PATH
  let unlistedOutputPath = DEFAULT_UNLISTED_OUTPUT_PATH
  let matchedOutputPath = DEFAULT_MATCHED_OUTPUT_PATH

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === "--in") {
      const next = argv[i + 1]
      if (!next) throw new Error("Missing value for --in")
      inputPath = next
      i += 1
      continue
    }

    if (arg === "--out") {
      const next = argv[i + 1]
      if (!next) throw new Error("Missing value for --out")
      unlistedOutputPath = next
      i += 1
      continue
    }

    if (arg === "--matched-out") {
      const next = argv[i + 1]
      if (!next) throw new Error("Missing value for --matched-out")
      matchedOutputPath = next
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { inputPath, unlistedOutputPath, matchedOutputPath }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ""
  let inQuotes = false

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]
    const next = csv[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField)
      currentField = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1
      currentRow.push(currentField)
      currentField = ""
      if (currentRow.length > 1 || currentRow[0]?.trim().length) {
        rows.push(currentRow)
      }
      currentRow = []
      continue
    }

    currentField += char
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

function serializeCsv(rows: string[][]): string {
  return `${rows
    .map((row) =>
      row
        .map((field) => {
          const escaped = field.replaceAll('"', '""')
          const needsQuotes = /[",\r\n]/.test(field)
          return needsQuotes ? `"${escaped}"` : escaped
        })
        .join(","),
    )
    .join("\n")}\n`
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const absoluteInputPath = resolve(process.cwd(), args.inputPath)
  const absoluteUnlistedOutputPath = resolve(process.cwd(), args.unlistedOutputPath)
  const absoluteMatchedOutputPath = resolve(process.cwd(), args.matchedOutputPath)

  const csvContents = await readFile(absoluteInputPath, "utf8")
  const rows = parseCsv(csvContents)

  if (rows.length === 0) {
    throw new Error(`Input file has no rows: ${absoluteInputPath}`)
  }

  const [header, ...dataRows] = rows
  const primaryUrlIndex = header.findIndex(
    (columnName) => columnName.trim().toLowerCase() === "primary url",
  )

  if (primaryUrlIndex === -1) {
    throw new Error(`Missing "Primary URL" column in ${absoluteInputPath}`)
  }

  const listingRows = await db
    .select({
      sourceUrl: storeListings.sourceUrl,
      externalUrl: storeListings.externalUrl,
    })
    .from(storeListings)

  const listedHosts = new Set<string>()
  for (const listingRow of listingRows) {
    const sourceHost = normalizeHost(listingRow.sourceUrl)
    if (sourceHost) listedHosts.add(sourceHost)
    const externalHost = normalizeHost(listingRow.externalUrl)
    if (externalHost) listedHosts.add(externalHost)
  }

  const matchedRows: string[][] = [header]
  const unlistedRows: string[][] = [header]

  for (const row of dataRows) {
    const urlValue = row[primaryUrlIndex]
    const host = normalizeHost(urlValue)

    if (host && listedHosts.has(host)) {
      matchedRows.push(row)
    } else {
      unlistedRows.push(row)
    }
  }

  await mkdir(dirname(absoluteUnlistedOutputPath), { recursive: true })
  await mkdir(dirname(absoluteMatchedOutputPath), { recursive: true })

  await writeFile(absoluteUnlistedOutputPath, serializeCsv(unlistedRows), "utf8")
  await writeFile(absoluteMatchedOutputPath, serializeCsv(matchedRows), "utf8")

  console.log(`Input rows (excluding header): ${dataRows.length}`)
  console.log(`Already listed rows: ${Math.max(0, matchedRows.length - 1)}`)
  console.log(`Unlisted rows: ${Math.max(0, unlistedRows.length - 1)}`)
  console.log(`\nWrote unlisted CSV to ${absoluteUnlistedOutputPath}`)
  console.log(`Wrote already-listed CSV to ${absoluteMatchedOutputPath}`)
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
