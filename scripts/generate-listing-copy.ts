#!/usr/bin/env node
import 'dotenv/config'

import Anthropic from '@anthropic-ai/sdk'
import { desc, eq } from 'drizzle-orm'
import { chromium } from 'playwright'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import {
  isMeaningfulListingCopy,
  sanitizeListingDescription,
  sanitizeListingTagline,
  stripEmbeddedListingMetadata,
} from '../src/lib/listing-copy'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const GENERIC_TAGLINE_PATTERNS = [
  /^a tool for the bluesky and at protocol ecosystem\.?$/i,
  /^a bluesky client\.?$/i,
  /^alternative bluesky client\.?$/i,
  /^find your community\.?$/i,
]

type CandidateListing = {
  id: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
}

function taxonomyHintsFromCategorySlugs(
  slugs: string[] | null | undefined,
): Pick<CandidateListing, 'rawCategoryHint' | 'scope' | 'productType' | 'domain'> {
  const primary = slugs?.[0]?.trim()
  if (!primary) {
    return { rawCategoryHint: null, scope: null, productType: null, domain: null }
  }
  const parts = primary.split('/').map((s) => s.trim()).filter(Boolean)
  return {
    rawCategoryHint: null,
    scope: primary,
    productType: parts[0] ?? null,
    domain: parts[1] ?? null,
  }
}

type ScriptArgs = {
  dryRun: boolean
  force: boolean
  limit: number | null
  id: string | null
  help: boolean
}

type ExtractedPageCopy = {
  finalUrl: string
  title: string | null
  metaDescription: string | null
  ogDescription: string | null
  headings: string[]
  paragraphs: string[]
}

type GeneratedCopy = {
  tagline: string
  fullDescription: string
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    limit: null,
    id: null,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      out.help = true
      continue
    }
    if (arg === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (arg === '--force') {
      out.force = true
      continue
    }
    if (arg === '--limit' || arg === '-l') {
      const raw = argv[++i]
      const value = Number.parseInt(raw ?? '', 10)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value "${raw ?? ''}"`)
      }
      out.limit = value
      continue
    }
    if (arg === '--id') {
      out.id = argv[++i] ?? null
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp(): void {
  console.log(`
Usage: npm run generate:listing-copy -- [options]

Options:
      --dry-run       Print updates without writing to the database
      --force         Reprocess listings even if their copy already looks usable
  -l, --limit <n>     Process at most n listings
      --id <listing>  Process a single listing id
  -h, --help          Show help

Environment:
  ANTHROPIC_API_KEY or ANTHROPIC_KEY   Required when fallback generation is needed
  ANTHROPIC_MODEL                      Optional (default: ${DEFAULT_MODEL})
`)
}

function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY ?? ''
  if (!key) {
    throw new Error(
      'Missing API key: set ANTHROPIC_API_KEY (or ANTHROPIC_KEY) in the environment.',
    )
  }
  return key
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const cleaned = stripEmbeddedListingMetadata(value)
  if (!cleaned) {
    return null
  }

  return cleaned
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    const cleaned = normalizeText(value)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
  }

  return out
}

function shortenToSentence(value: string, maxLength = 160): string {
  const cleaned = normalizeText(value) ?? value.trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  const sentenceMatch = cleaned.match(/^(.{30,200}?[.!?])(?:\s|$)/)
  if (sentenceMatch?.[1] && sentenceMatch[1].length <= maxLength) {
    return sentenceMatch[1].trim()
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`
}

function isWeakTagline(value: string | null | undefined): boolean {
  const cleaned = sanitizeListingTagline(value)
  if (!cleaned) {
    return true
  }
  if (cleaned.length < 24) {
    return true
  }
  return GENERIC_TAGLINE_PATTERNS.some((pattern) => pattern.test(cleaned))
}

function hasEmbeddedMetadata(value: string | null | undefined): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return false
  }

  return sanitizeListingDescription(raw) !== raw
}

function isWeakDescription(value: string | null | undefined): boolean {
  const cleaned = sanitizeListingDescription(value)
  if (!cleaned) {
    return true
  }
  if (cleaned.length < 80) {
    return true
  }
  if (hasEmbeddedMetadata(value)) {
    return true
  }
  return !isMeaningfulListingCopy(cleaned, { minLength: 80 })
}

function needsCopyRefresh(listing: CandidateListing, force: boolean): boolean {
  if (force) {
    return true
  }

  return (
    isWeakTagline(listing.tagline) ||
    isWeakDescription(listing.fullDescription) ||
    hasEmbeddedMetadata(listing.tagline) ||
    hasEmbeddedMetadata(listing.fullDescription)
  )
}

function getListingUrl(listing: CandidateListing): string {
  return listing.externalUrl || listing.sourceUrl
}

function isLikelyBoilerplateText(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized.length < 30) {
    return true
  }

  return (
    normalized.includes('cookie') ||
    normalized.includes('privacy policy') ||
    normalized.includes('terms of service') ||
    normalized.includes('all rights reserved') ||
    normalized.includes('sign in') ||
    normalized.includes('log in') ||
    normalized.includes('create account')
  )
}

async function extractPageCopy(url: string): Promise<ExtractedPageCopy> {
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 960,
      },
    })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForTimeout(2_500)

    const [title, finalUrl, metaDescription, ogDescription, headings, paragraphs] =
      await Promise.all([
        page.title(),
        page.url(),
        page
          .locator('meta[name="description"]')
          .first()
          .getAttribute('content')
          .catch(() => null),
        page
          .locator('meta[property="og:description"]')
          .first()
          .getAttribute('content')
          .catch(() => null),
        page
          .locator('main h1, main h2, main h3, article h1, article h2, article h3, [role="main"] h1, [role="main"] h2, [role="main"] h3, body h1, body h2, body h3')
          .evaluateAll((nodes) =>
            nodes
              .map((node) => node.textContent ?? '')
              .map((value) => value.replace(/\s+/g, ' ').trim())
              .filter((value) => value.length > 0)
              .slice(0, 10),
          ),
        page
          .locator('main p, main li, article p, article li, [role="main"] p, [role="main"] li, body p, body li')
          .evaluateAll((nodes) =>
            nodes
              .map((node) => node.textContent ?? '')
              .map((value) => value.replace(/\s+/g, ' ').trim())
              .filter((value) => value.length >= 30)
              .slice(0, 24),
          ),
      ])

    return {
      finalUrl,
      title,
      metaDescription,
      ogDescription,
      headings: dedupeStrings(headings),
      paragraphs: dedupeStrings(paragraphs),
    }
  } finally {
    await browser.close()
  }
}

function chooseSiteTagline(extracted: ExtractedPageCopy): string | null {
  const candidates = dedupeStrings([
    extracted.metaDescription,
    extracted.ogDescription,
    extracted.headings[1],
    extracted.paragraphs[0],
    extracted.title,
  ])

  for (const candidate of candidates) {
    if (isLikelyBoilerplateText(candidate)) continue
    if (candidate.length < 24) continue
    return shortenToSentence(candidate, 140)
  }

  return null
}

function chooseSiteDescription(extracted: ExtractedPageCopy): string | null {
  const parts: string[] = []

  for (const paragraph of extracted.paragraphs) {
    if (isLikelyBoilerplateText(paragraph)) continue
    if (parts.some((existing) => existing.toLowerCase() === paragraph.toLowerCase())) {
      continue
    }
    parts.push(paragraph)
    if (parts.join('\n\n').length >= 420) {
      break
    }
  }

  const joined = normalizeText(parts.join('\n\n'))
  if (joined && joined.length >= 80) {
    return joined
  }

  const fallback = dedupeStrings([
    extracted.metaDescription,
    extracted.ogDescription,
    extracted.paragraphs[0],
  ])[0]

  return fallback ?? null
}

async function generateCopyWithAnthropic(input: {
  listing: CandidateListing
  extracted: ExtractedPageCopy
  preferredTagline: string | null
  preferredDescription: string | null
}): Promise<GeneratedCopy> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() })
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL

  const payload = {
    name: input.listing.name,
    url: input.extracted.finalUrl,
    sourceUrl: input.listing.sourceUrl,
    rawCategoryHint: input.listing.rawCategoryHint,
    scope: input.listing.scope,
    productType: input.listing.productType,
    domain: input.listing.domain,
    currentTagline: sanitizeListingTagline(input.listing.tagline),
    currentDescription: sanitizeListingDescription(input.listing.fullDescription),
    preferredTagline: input.preferredTagline,
    preferredDescription: input.preferredDescription,
    pageTitle: input.extracted.title,
    metaDescription: input.extracted.metaDescription,
    ogDescription: input.extracted.ogDescription,
    headings: input.extracted.headings.slice(0, 8),
    paragraphs: input.extracted.paragraphs.slice(0, 10),
  }

  const message = await client.messages.create({
    model,
    max_tokens: 600,
    temperature: 0.2,
    system: `You write concise, accurate software directory copy.

Rules:
- Prefer the product's own wording when it is available and clear.
- Do not invent features, platforms, pricing, or claims not supported by the provided page text.
- The tagline must be a single sentence under 140 characters.
- The fullDescription should be 2-4 sentences and explain what the product is and why someone would use it.
- Avoid hype, filler, and phrases like "revolutionary" or "next-generation".
- Never include metadata labels such as Category, Platforms, Status, or Last checked.
- Return JSON only with keys "tagline" and "fullDescription".`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
  })

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()

  const parsed = parseJsonObject(text)
  const tagline = sanitizeListingTagline(String(parsed.tagline ?? ''))
  const fullDescription = sanitizeListingDescription(
    String(parsed.fullDescription ?? ''),
  )

  if (!tagline || !fullDescription) {
    throw new Error('Model returned incomplete listing copy')
  }

  return {
    tagline,
    fullDescription,
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  const parsed: unknown = JSON.parse(slice)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected JSON object from model')
  }
  return parsed as Record<string, unknown>
}

async function buildImprovedCopy(
  listing: CandidateListing,
): Promise<{
  tagline: string
  fullDescription: string
  usedModel: boolean
}> {
  const extracted = await extractPageCopy(getListingUrl(listing))

  const siteTagline = chooseSiteTagline(extracted)
  const siteDescription = chooseSiteDescription(extracted)

  const hasGoodSiteTagline = !isWeakTagline(siteTagline)
  const hasGoodSiteDescription = !isWeakDescription(siteDescription)

  if (hasGoodSiteTagline && hasGoodSiteDescription) {
    return {
      tagline: siteTagline!,
      fullDescription: siteDescription!,
      usedModel: false,
    }
  }

  const generated = await generateCopyWithAnthropic({
    listing,
    extracted,
    preferredTagline: hasGoodSiteTagline ? siteTagline : null,
    preferredDescription: hasGoodSiteDescription ? siteDescription : null,
  })

  return {
    tagline: hasGoodSiteTagline ? siteTagline! : generated.tagline,
    fullDescription: hasGoodSiteDescription
      ? siteDescription!
      : generated.fullDescription,
    usedModel: true,
  }
}

async function getCandidateListings(args: ScriptArgs): Promise<CandidateListing[]> {
  const rows = await db
    .select({
      id: storeListings.id,
      name: storeListings.name,
      sourceUrl: storeListings.sourceUrl,
      externalUrl: storeListings.externalUrl,
      tagline: storeListings.tagline,
      fullDescription: storeListings.fullDescription,
      categorySlugs: storeListings.categorySlugs,
    })
    .from(storeListings)
    .orderBy(desc(storeListings.updatedAt), desc(storeListings.createdAt))

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      sourceUrl: row.sourceUrl,
      externalUrl: row.externalUrl,
      tagline: row.tagline,
      fullDescription: row.fullDescription,
      ...taxonomyHintsFromCategorySlugs(row.categorySlugs),
    }))
    .filter((row) => (args.id ? row.id === args.id : true))
    .filter((row) => needsCopyRefresh(row, args.force))
    .slice(0, args.limit ?? Number.POSITIVE_INFINITY)
}

async function processListing(
  listing: CandidateListing,
  args: ScriptArgs,
): Promise<void> {
  console.log(`Processing ${listing.name} (${listing.id})`)

  const nextCopy = await buildImprovedCopy(listing)
  console.log(
    `Prepared copy for ${listing.name} using ${nextCopy.usedModel ? 'site + model' : 'site copy'}.`,
  )

  if (args.dryRun) {
    console.log(`Tagline: ${nextCopy.tagline}`)
    console.log(`Description: ${nextCopy.fullDescription}`)
    return
  }

  await db
    .update(storeListings)
    .set({
      tagline: nextCopy.tagline,
      fullDescription: nextCopy.fullDescription,
      updatedAt: new Date(),
    })
    .where(eq(storeListings.id, listing.id))

  console.log(`Updated store_listings copy for ${listing.name}.`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const candidates = await getCandidateListings(args)
  if (candidates.length === 0) {
    console.log('No listings need copy refresh.')
    return
  }

  console.log(`Found ${candidates.length} listing(s) to process.`)

  for (const listing of candidates) {
    try {
      await processListing(listing, args)
    } catch (error) {
      console.error(`Failed for ${listing.name} (${listing.id}).`)
      console.error(error)
    }
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
