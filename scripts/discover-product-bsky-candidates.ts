#!/usr/bin/env node
import 'dotenv/config'

import Anthropic from '@anthropic-ai/sdk'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import {
  storeListingProductAccountCandidates,
  storeListings,
} from '../src/db/schema'
import {
  fetchBlueskyPublicProfileFields,
  resolveBlueskyHandleToDid,
} from '../src/lib/bluesky-public-profile'

type CandidateSource =
  | 'url_heuristic'
  | 'google_search'
  | 'llm'
  | 'manual'
  | 'import_json'

type ScriptArgs = {
  dryRun: boolean
  limit: number | null
  slug: string | null
  skipGoogle: boolean
  skipLlm: boolean
  help: boolean
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    limit: null,
    slug: null,
    skipGoogle: false,
    skipLlm: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--skip-google') out.skipGoogle = true
    else if (a === '--skip-llm') out.skipLlm = true
    else if (a === '--slug' && argv[i + 1]) {
      out.slug = argv[++i] ?? null
    } else if (a === '--limit' && argv[i + 1]) {
      out.limit = Number(argv[++i])
    }
  }
  return out
}

function printHelp() {
  console.log(`
discover-product-bsky-candidates — enqueue Bluesky account candidates for listings.

Usage:
  tsx -r dotenv/config scripts/discover-product-bsky-candidates.ts [options]

Options:
  --dry-run          Print actions without writing to the DB
  --slug <slug>      Only process this listing slug
  --limit <n>        Max listings to process
  --skip-google      Do not call Google Custom Search (requires GOOGLE_CUSTOM_SEARCH_* env)
  --skip-llm         Do not call Anthropic (requires ANTHROPIC_API_KEY)
  -h, --help         Show this help

Env (optional tiers):
  GOOGLE_CUSTOM_SEARCH_API_KEY, GOOGLE_CUSTOM_SEARCH_ENGINE_ID
  ANTHROPIC_API_KEY (or ANTHROPIC_KEY)
`)
}

/** Extract profile path segments and bare *.bsky.social handles from free text. */
export function extractBskyActorHints(text: string): string[] {
  const out = new Set<string>()
  if (!text?.trim()) return []

  for (const m of text.matchAll(/bsky\.app\/profile\/([^\s)\]'"?#]+)/gi)) {
    const seg = decodeURIComponent((m[1] ?? '').trim())
    if (seg) out.add(seg)
  }
  for (const m of text.matchAll(/@?([\w.-]+\.bsky\.social)/gi)) {
    const h = m[1]?.toLowerCase()
    if (h) out.add(h)
  }
  return [...out]
}

async function normalizeActorToDid(actor: string): Promise<{
  did: string
  handle: string | null
} | null> {
  const a = actor.trim()
  if (!a) return null
  if (a.startsWith('did:')) {
    const p = await fetchBlueskyPublicProfileFields(a)
    if (!p) return null
    return { did: a, handle: p.handle }
  }
  const did = await resolveBlueskyHandleToDid(a)
  if (!did) return null
  const p = await fetchBlueskyPublicProfileFields(did)
  return { did, handle: p?.handle ?? null }
}

async function googleSearchBskyHints(productQuery: string): Promise<string[]> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim()
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim()
  if (!key || !cx) return []

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set(
    'q',
    `${productQuery} (site:bsky.app/profile OR bsky.social)`,
  )
  url.searchParams.set('num', '8')

  const res = await fetch(url.toString())
  if (!res.ok) {
    console.warn(
      `[discover] Google Custom Search failed: ${res.status} ${await res.text()}`,
    )
    return []
  }
  const data = (await res.json()) as {
    items?: { link?: string; snippet?: string }[]
  }
  const hints: string[] = []
  for (const it of data.items ?? []) {
    const blob = `${it.link ?? ''} ${it.snippet ?? ''}`
    hints.push(...extractBskyActorHints(blob))
  }
  return [...new Set(hints)]
}

const DEFAULT_LLM_MODEL = 'claude-sonnet-4-20250514'

async function llmSuggestBlueskyHandle(input: {
  name: string
  externalUrl: string | null
  sourceUrl: string
  googleSnippets: string[]
}): Promise<string | null> {
  const apiKey =
    process.env.ANTHROPIC_API_KEY?.trim() ?? process.env.ANTHROPIC_KEY?.trim()
  if (!apiKey) return null
  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_LLM_MODEL
  const payload = {
    name: input.name,
    externalUrl: input.externalUrl,
    sourceUrl: input.sourceUrl,
    googleSnippets: input.googleSnippets,
  }
  const message = await client.messages.create({
    model,
    max_tokens: 256,
    temperature: 0,
    system: `You help find the official Bluesky (bsky.app) account for a software product or tool.
Respond with JSON only, no markdown. Schema: {"handle":"string|null"}
- "handle" must be a full handle like "something.bsky.social", or null if unknown or none exists.
- Do not guess wildly; prefer null if unsure.`,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      },
    ],
  })
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim()
  let parsed: { handle?: string | null }
  try {
    parsed = JSON.parse(text) as { handle?: string | null }
  } catch {
    return null
  }
  const raw = parsed.handle
  if (raw == null || typeof raw !== 'string') return null
  const h = raw.trim().toLowerCase()
  if (!h.endsWith('.bsky.social')) return null
  return h
}

async function insertCandidate(
  storeListingId: string,
  did: string,
  handle: string | null,
  source: CandidateSource,
  dryRun: boolean,
) {
  if (dryRun) {
    console.log(
      `[discover] dry-run: would insert candidate did=${did} source=${source}`,
    )
    return
  }
  await db
    .insert(storeListingProductAccountCandidates)
    .values({
      storeListingId,
      candidateDid: did,
      candidateHandle: handle,
      status: 'pending',
      source,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        storeListingProductAccountCandidates.storeListingId,
        storeListingProductAccountCandidates.candidateDid,
      ],
    })
}

async function processListing(
  row: {
    id: string
    name: string
    slug: string
    externalUrl: string | null
    sourceUrl: string
    fullDescription: string | null
  },
  args: ScriptArgs,
): Promise<boolean> {
  const blob = [
    row.externalUrl,
    row.sourceUrl,
    row.fullDescription ?? '',
  ].join('\n')

  const tryActors = async (
    actors: string[],
    source: CandidateSource,
  ): Promise<boolean> => {
    for (const actor of actors) {
      const resolved = await normalizeActorToDid(actor)
      if (resolved) {
        await insertCandidate(
          row.id,
          resolved.did,
          resolved.handle,
          source,
          args.dryRun,
        )
        console.log(
          `[discover] ${row.slug}: queued ${resolved.did} (${source})`,
        )
        return true
      }
    }
    return false
  }

  const heuristicActors = extractBskyActorHints(blob)
  if (await tryActors(heuristicActors, 'url_heuristic')) return true

  let googleSnippets: string[] = []
  if (!args.skipGoogle) {
    const q = `${row.name}`.trim()
    googleSnippets = await googleSearchBskyHints(q)
    if (await tryActors(googleSnippets, 'google_search')) return true
  }

  if (!args.skipLlm) {
    try {
      const suggested = await llmSuggestBlueskyHandle({
        name: row.name,
        externalUrl: row.externalUrl,
        sourceUrl: row.sourceUrl,
        googleSnippets,
      })
      if (suggested && (await tryActors([suggested], 'llm'))) return true
    } catch (e) {
      console.warn(`[discover] LLM step failed for ${row.slug}:`, e)
    }
  }

  console.log(`[discover] ${row.slug}: no candidate found`)
  return false
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const conditions = [isNull(storeListings.productAccountDid)]
  if (args.slug) {
    conditions.push(eq(storeListings.slug, args.slug))
  }

  const base = db
    .select({
      id: storeListings.id,
      name: storeListings.name,
      slug: storeListings.slug,
      externalUrl: storeListings.externalUrl,
      sourceUrl: storeListings.sourceUrl,
      fullDescription: storeListings.fullDescription,
    })
    .from(storeListings)
    .where(and(...conditions))
    .orderBy(asc(storeListings.createdAt))

  const rows =
    args.limit != null && Number.isFinite(args.limit)
      ? await base.limit(args.limit)
      : await base

  console.log(`[discover] Processing ${rows.length} listing(s)`)
  for (const row of rows) {
    await processListing(row, args)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
