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

Heuristics:
  - Same apex domain as the product URL is tried as a handle (e.g. https://anisota.net → anisota.net).
  - Tries listing slug and compact product name as *.bsky.social (e.g. aerune → aerune.bsky.social).
  - Google runs multiple queries including "{name} bsky" to surface bsky.app/profile links.
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

const SKIP_PRODUCT_HOST_FOR_HANDLE = new Set([
  'localhost',
  '127.0.0.1',
  'bsky.app',
  'bsky.social',
  'github.com',
  'gitlab.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'medium.com',
  'notion.so',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'web.app',
  'firebaseapp.com',
  'readthedocs.io',
  'npmjs.com',
  'jsdelivr.net',
  'cloudflare.com',
  'google.com',
  'apple.com',
])

/**
 * Many projects use the same apex domain as their Bluesky handle (e.g. site https://anisota.net → @anisota.net).
 * Returns hostnames to try with resolveHandle (after stripping www).
 */
export function hostnameHandleCandidatesFromUrls(
  ...urls: Array<string | null | undefined>
): string[] {
  const out = new Set<string>()
  for (const raw of urls) {
    if (!raw?.trim()) continue
    let u = raw.trim()
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    try {
      const url = new URL(u)
      let host = url.hostname.toLowerCase()
      if (host.startsWith('www.')) host = host.slice(4)
      if (!host.includes('.') || SKIP_PRODUCT_HOST_FOR_HANDLE.has(host)) continue
      if (host.endsWith('bsky.app') || host.endsWith('bsky.social')) continue
      out.add(host)
    } catch {
      /* ignore invalid URLs */
    }
  }
  return [...out]
}

/**
 * Many teams use `productname.bsky.social` or the same local part as the directory slug.
 * Also matches free-text like @aerune.bsky.social via {@link extractBskyActorHints}.
 */
export function bskySocialHandleGuessesFromListing(
  name: string,
  slug: string,
): string[] {
  const out = new Set<string>()

  const slugKey = slug.includes('/')
    ? (slug.split('/').pop() ?? slug)
    : slug

  const fromSlug = slugKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (
    fromSlug.length >= 2 &&
    fromSlug.length <= 64 &&
    /^[a-z][a-z0-9-]*$/.test(fromSlug)
  ) {
    out.add(`${fromSlug}.bsky.social`)
  }

  const compact = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (
    compact.length >= 2 &&
    compact.length <= 64 &&
    /^[a-z]/.test(compact) &&
    compact !== fromSlug.replace(/-/g, '')
  ) {
    out.add(`${compact}.bsky.social`)
  }

  const firstToken = name
    .trim()
    .toLowerCase()
    .match(/[a-z][a-z0-9-]*/)?.[0]
    ?.replace(/-+$/g, '')
  if (firstToken && firstToken.length >= 2 && firstToken.length <= 64) {
    out.add(`${firstToken}.bsky.social`)
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

type GoogleSearchResult = {
  actorHints: string[]
  /** Link + snippet lines for the LLM (handles alone are often not enough). */
  snippetLines: string[]
}

async function googleCustomSearchOnce(query: string): Promise<GoogleSearchResult> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim()
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim()
  if (!key || !cx) return { actorHints: [], snippetLines: [] }

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', '10')

  const res = await fetch(url.toString())
  if (!res.ok) {
    console.warn(
      `[discover] Google Custom Search failed (${query.slice(0, 60)}…): ${res.status} ${await res.text()}`,
    )
    return { actorHints: [], snippetLines: [] }
  }
  const data = (await res.json()) as {
    items?: { link?: string; snippet?: string; title?: string }[]
  }
  const actorHints: string[] = []
  const snippetLines: string[] = []
  for (const it of data.items ?? []) {
    const link = it.link ?? ''
    const snippet = it.snippet ?? ''
    const title = it.title ?? ''
    const blob = `${link} ${snippet} ${title}`
    actorHints.push(...extractBskyActorHints(blob))
    if (link || snippet) {
      snippetLines.push(
        [title && `title: ${title}`, link && `url: ${link}`, snippet && `snippet: ${snippet}`]
          .filter(Boolean)
          .join('\n'),
      )
    }
  }
  return { actorHints, snippetLines }
}

/** Multiple queries: "{name} bsky" often surfaces the official profile in results. */
async function googleSearchBskyHints(productName: string): Promise<GoogleSearchResult> {
  const q = productName.trim()
  if (!q) return { actorHints: [], snippetLines: [] }

  const queries = [
    `${q} bsky`,
    `${q} bluesky site:bsky.app`,
    `${q} (site:bsky.app/profile OR site:bsky.social)`,
  ]
  const hintSet = new Set<string>()
  const lines: string[] = []
  for (const query of queries) {
    const { actorHints, snippetLines } = await googleCustomSearchOnce(query)
    for (const h of actorHints) hintSet.add(h)
    lines.push(...snippetLines)
  }
  return {
    actorHints: [...hintSet],
    snippetLines: [...new Set(lines)],
  }
}

const DEFAULT_LLM_MODEL = 'claude-sonnet-4-20250514'

async function llmSuggestBlueskyHandle(input: {
  name: string
  externalUrl: string | null
  sourceUrl: string
  googleSearchResultLines: string[]
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
    googleSearchResults: input.googleSearchResultLines,
  }
  const message = await client.messages.create({
    model,
    max_tokens: 256,
    temperature: 0,
    system: `You help find the official Bluesky (bsky.app) account for a software product or tool.
Respond with JSON only, no markdown. Schema: {"handle":"string|null"}
- "handle" must be a Bluesky handle: either "name.bsky.social" OR a custom domain handle like "anisota.net" (same form as in bsky.app/profile/...).
- Use null if unknown or none exists. Do not guess wildly.`,
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
  if (!h || h.includes('/') || h.includes(' ')) return null
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

  const heuristicActors = [
    ...extractBskyActorHints(blob),
    ...hostnameHandleCandidatesFromUrls(row.externalUrl, row.sourceUrl),
    ...bskySocialHandleGuessesFromListing(row.name, row.slug),
  ]
  if (await tryActors(heuristicActors, 'url_heuristic')) return true

  let googleSearchResultLines: string[] = []
  if (!args.skipGoogle) {
    const q = `${row.name}`.trim()
    const google = await googleSearchBskyHints(q)
    googleSearchResultLines = google.snippetLines
    if (await tryActors(google.actorHints, 'google_search')) return true
  }

  if (!args.skipLlm) {
    try {
      const suggested = await llmSuggestBlueskyHandle({
        name: row.name,
        externalUrl: row.externalUrl,
        sourceUrl: row.sourceUrl,
        googleSearchResultLines,
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
