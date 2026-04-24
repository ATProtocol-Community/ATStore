#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const DEFAULT_INPUT_PATH = "scripts/output/at-tracker-websites.txt"
const DEFAULT_UNRESOLVED_PATH = "scripts/output/at-tracker-websites-unresolved.txt"
const REQUEST_TIMEOUT_MS = 10_000
const CONCURRENCY = 32
const USER_AGENT = "at-store-at-tracker-scraper/1.0 (+https://github.com/)"

type Entry = {
  raw: string
  domain: string
  url: string
}

function parseEntries(contents: string): Entry[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const match = line.match(/^(\S+)\s*->\s*(\S+)$/)
      if (!match) return []
      return [{ raw: line, domain: match[1]!, url: match[2]! }]
    })
}

async function resolves(url: string): Promise<boolean> {
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      })
      if (response.status < 400) return true
      if (response.status === 405 || response.status === 403) continue
      return false
    } catch {
      if (method === "HEAD") continue
      return false
    } finally {
      clearTimeout(timer)
    }
  }
  return false
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index]!, index)
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_INPUT_PATH)
  const unresolvedPath = resolve(process.cwd(), DEFAULT_UNRESOLVED_PATH)

  const contents = await readFile(inputPath, "utf8")
  const entries = parseEntries(contents)

  console.log(`Checking ${entries.length} URL(s) with concurrency=${CONCURRENCY}…`)

  let completed = 0
  const outcomes = await runPool(entries, CONCURRENCY, async (entry) => {
    const ok = await resolves(entry.url)
    completed += 1
    if (completed % 25 === 0 || completed === entries.length) {
      console.log(`  ${completed}/${entries.length}`)
    }
    return { entry, ok }
  })

  const resolved = outcomes.filter((o) => o.ok).map((o) => o.entry.raw)
  const unresolved = outcomes.filter((o) => !o.ok).map((o) => o.entry.raw)

  await writeFile(inputPath, resolved.join("\n") + "\n", "utf8")
  await writeFile(unresolvedPath, unresolved.join("\n") + "\n", "utf8")

  console.log(`\nResolved:   ${resolved.length}`)
  console.log(`Unresolved: ${unresolved.length}`)
  console.log(`\nWrote resolved entries to   ${inputPath}`)
  console.log(`Wrote unresolved entries to ${unresolvedPath}`)
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
