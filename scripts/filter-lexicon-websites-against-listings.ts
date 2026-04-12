#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"

const DEFAULT_INPUT_PATH = "scripts/output/lexicon-garden-websites.txt"
const DEFAULT_OUTPUT_PATH = "scripts/output/lexicon-garden-websites-unlisted.txt"
const DEFAULT_MATCHED_OUTPUT_PATH =
  "scripts/output/lexicon-garden-websites-already-listed.txt"

type ScriptArgs = {
  inputPath: string
  outputPath: string
  matchedPath: string
}

function parseArgs(argv: string[]): ScriptArgs {
  let inputPath = DEFAULT_INPUT_PATH
  let outputPath = DEFAULT_OUTPUT_PATH
  let matchedPath = DEFAULT_MATCHED_OUTPUT_PATH

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
      outputPath = next
      i += 1
      continue
    }

    if (arg === "--matched-out") {
      const next = argv[i + 1]
      if (!next) throw new Error("Missing value for --matched-out")
      matchedPath = next
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { inputPath, outputPath, matchedPath }
}

function parseLines(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0)
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
  const absoluteOutputPath = resolve(process.cwd(), args.outputPath)
  const absoluteMatchedPath = resolve(process.cwd(), args.matchedPath)

  const inputContents = await readFile(absoluteInputPath, "utf8")
  const candidates = parseLines(inputContents)
  const uniqueCandidates = [...new Set(candidates)]

  const rows = await db
    .select({
      externalUrl: storeListings.externalUrl,
    })
    .from(storeListings)

  const listedHosts = new Set<string>()
  for (const row of rows) {
    const host = normalizeHost(row.externalUrl)
    if (host) listedHosts.add(host)
  }

  const matched = uniqueCandidates.filter((domain) => listedHosts.has(domain))
  const unlisted = uniqueCandidates.filter((domain) => !listedHosts.has(domain))

  await mkdir(dirname(absoluteOutputPath), { recursive: true })
  await mkdir(dirname(absoluteMatchedPath), { recursive: true })

  await writeFile(absoluteOutputPath, `${unlisted.join("\n")}\n`, "utf8")
  await writeFile(absoluteMatchedPath, `${matched.join("\n")}\n`, "utf8")

  console.log(`Input domains: ${uniqueCandidates.length}`)
  console.log(`Already listed: ${matched.length}`)
  console.log(`Not listed yet: ${unlisted.length}`)
  console.log(`\nWrote unlisted domains to ${absoluteOutputPath}`)
  console.log(`Wrote already-listed domains to ${absoluteMatchedPath}`)
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
