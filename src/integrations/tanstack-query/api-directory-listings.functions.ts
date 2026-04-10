import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import {
  normalizeAppTags,
  popularTagsFromAllAssignments,
  suggestAppTagsFromListing,
  suggestedTagsForListing,
} from '../../lib/app-tags'
import { findAppTagBySlug } from '../../lib/app-tag-metadata'
import {
  buildDirectoryCategoryTree,
  flattenDirectoryCategoryTree,
  findDirectoryCategoryNode,
  getDirectoryCategoryDescendantIds,
  getDirectoryCategoryOption,
  primaryCategorySlug,
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from '../../lib/directory-categories'
import { findProtocolCategoryBySlugParam } from '../../lib/protocol-category-metadata'
import {
  sanitizeListingDescription,
  sanitizeListingTagline,
} from '../../lib/listing-copy'
import {
  buildDirectoryListingSlug,
} from '../../lib/directory-listing-slugs'
import { getAtprotoSessionForRequest } from '#/middleware/auth'
import { dbMiddleware } from './db-middleware'
import type { Database } from '#/db/index.server'
import type { StoreListing } from '#/db/schema'
import * as dbSchema from '#/db/schema'
import { COLLECTION } from '#/lib/atproto/nsids'
import {
  createAtstorePublishClient,
  publishDirectoryListingDetail,
} from '#/lib/atproto/publish-directory-listing'
import {
  createListingReviewRecord,
  deleteRecord,
} from '#/lib/atproto/repo-records'
import { geminiFlashGenerateImageFromPromptAndImage } from '#/lib/gemini-flash-image-gen'
import { buildIconPolishFromSiteAssetPrompt } from '#/lib/listing-icon-prompts'
import { captureListingPageScreenshotForGeneration } from '#/lib/listing-page-screenshot'
import {
  discoverSiteBrandIconAsset,
  rasterizeBrandIconForGeminiInput,
} from '#/lib/site-brand-icon'
import { fetchBlueskyPublicProfileFields } from '#/lib/bluesky-public-profile'

/** Columns only on legacy `directory_listings`; absent on `store_listings` — selected as null for UI types. */
const storeListingLegacyDetailColumns = {
  rawCategoryHint: sql<string | null>`null::text`.as('rawCategoryHint'),
  scope: sql<string | null>`null::text`.as('scope'),
  productType: sql<string | null>`null::text`.as('productType'),
  domain: sql<string | null>`null::text`.as('domain'),
  vertical: sql<string | null>`null::text`.as('vertical'),
  classificationReason: sql<string | null>`null::text`.as('classificationReason'),
}

function listingPublicWhere(
  table: typeof dbSchema.storeListings,
  extra?: SQL,
) {
  const pub = eq(table.verificationStatus, 'verified')
  return extra ? and(pub, extra) : pub
}

/** Listing has a two-segment path under `apps/…` or `protocol/…` (e.g. `apps/bluesky`). */
function sqlCategorySlugsHasRootTwoSegment(
  col: AnyPgColumn,
  prefix: 'apps' | 'protocol',
): SQL {
  const pattern = `${prefix}/%`
  return sql<boolean>`exists (
    select 1 from unnest(${col}) as u(slug)
    where cardinality(string_to_array(trim(both from u.slug::text), '/')) = 2
      and trim(both from u.slug::text) like ${pattern}
  )`
}

function sqlCategorySlugsMatchesLike(col: AnyPgColumn, pattern: string): SQL {
  return sql<boolean>`exists (
    select 1 from unnest(${col}) as u(slug) where trim(both from u.slug::text) like ${pattern}
  )`
}

function categorySlugsOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) {
    return false
  }
  const bs = new Set(b)
  for (const x of a) {
    if (bs.has(x)) {
      return true
    }
  }
  return false
}

type DirectoryListingRow = {
  id: string
  name: string
  slug: string | null
  iconUrl: string | null
  /** Dedicated hero/cover from `store_listings.hero_image_url` (Tap / publish). */
  heroImageUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  categorySlugs: string[]
  reviewCount: number
  averageRating: number | null
}

type CategoryAccent = DirectoryCategoryAccent

export interface DirectoryListingCard {
  id: string
  name: string
  slug?: string | null
  tagline: string
  description: string
  iconUrl: string | null
  /** Resolved hero for cards: `store_listings.hero_image_url`, else first screenshot. */
  heroImageUrl: string | null
  /** Primary path (first of `categorySlugs`); used for ecosystem/category UI. */
  categorySlug: string | null
  categorySlugs: string[]
  category: string
  accent: CategoryAccent
  /** Mean star rating when there is at least one review; otherwise null. */
  rating: number | null
  reviewCount: number
  priceLabel: string
}

export interface DirectoryListingDetail extends DirectoryListingCard {
  /** Canonical AT URI for `fyi.atstore.listing.detail` when Tap-synced; needed to publish reviews. */
  atUri: string | null
  screenshots: string[]
  externalUrl: string | null
  sourceUrl: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
  categoryPathLabel: string | null
  appTags: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface DirectoryListingReview {
  id: string
  authorDid: string
  rating: number
  text: string | null
  reviewCreatedAt: string
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

export interface DirectoryCategorySummary {
  id: string
  label: string
  description: string
  accent: CategoryAccent
  count: number
  pathLabels: string[]
}

export interface DirectoryCategoryPageData {
  category: DirectoryCategoryTreeNode
  listings: DirectoryListingCard[]
}

export interface DirectoryAppTagGroup {
  tag: string
  count: number
  listings: DirectoryListingCard[]
}

export interface DirectoryAppTagSummary {
  tag: string
  count: number
}

export interface DirectoryProtocolCategoryGroup {
  /** Full path e.g. `protocol/pds`. */
  categoryId: string
  /** Second path segment; used in URLs `/protocol/$segment`. */
  segment: string
  label: string
  description: string
  count: number
  listings: DirectoryListingCard[]
}

export interface DirectoryProtocolCategorySummary {
  segment: string
  label: string
  count: number
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export interface DirectoryListingCategoryAssignment {
  id: string
  name: string
  iconUrl: string | null
  tagline: string
  description: string
  externalUrl: string | null
  categorySlug: string | null
  categorySlugs: string[]
  categoryPathLabel: string | null
  legacyCategoryHint: string
}

export interface DirectoryListingAppTagAssignment {
  id: string
  name: string
  iconUrl: string | null
  tagline: string
  description: string
  externalUrl: string | null
  appTags: string[]
  suggestedTags: string[]
  categorySlug: string | null
  categorySlugs: string[]
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  rawCategoryHint: string | null
}

export interface DirectoryHomePageData {
  featured: DirectoryListingCard
  spotlights: DirectoryListingCard[]
  popular: DirectoryListingCard[]
  fresh: DirectoryListingCard[]
  tags: DirectoryAppTagSummary[]
  protocolFeatured: DirectoryListingCard
  protocolSpotlights: DirectoryListingCard[]
  protocolCategories: DirectoryProtocolCategorySummary[]
}

const CATEGORY_ACCENTS: CategoryAccent[] = ['blue', 'pink', 'purple', 'green']

const listDirectoryListingsInput = z.object({
  limit: z.number().int().min(1).max(24).default(12),
  query: z.string().trim().min(1).optional(),
})

const getDirectoryCategoryPageInput = z.object({
  categoryId: z.string().trim().min(1),
})

const updateDirectoryListingCategoryAssignmentInput = z.object({
  id: z.string().min(1),
  categorySlug: z.string().trim().min(1).nullable(),
})

const deleteDirectoryListingInput = z.object({
  id: z.string().min(1),
})

const regenerateDirectoryListingContentInput = z.object({
  id: z.string().min(1),
})

const commitGeneratedListingImageInput = z.object({
  id: z.string().min(1),
  mimeType: z
    .string()
    .min(1)
    .max(128)
    .refine((s) => s.trim().toLowerCase().startsWith('image/'), {
      message: 'mimeType must be an image/* type',
    }),
  imageBase64: z.string().min(1).max(25_000_000),
})

const updateDirectoryListingAppTagsInput = z.object({
  id: z.string().min(1),
  appTags: z.array(z.string()).max(64),
})

const getAppsByTagPageInput = z.object({
  tag: z.string().trim().min(1),
})

const getProtocolCategoryPageInput = z.object({
  category: z.string().trim().min(1),
})

const getRelatedDirectoryListingsInput = z.object({
  id: z.string().trim().min(1),
  limit: z.number().int().min(1).max(8).default(4),
})

const getDirectoryListingReviewsInput = z.object({
  id: z.string().min(1),
})

const createDirectoryListingReviewInput = z.object({
  listingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(8000).optional().nullable(),
})

const fallbackCategoryIds = ['apps', 'protocol']

function formatMetadataLabel(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (normalized.length === 0) {
    return 'Utility'
  }

  const shouldTitleCase =
    /[_-]/.test(value) || value === value.toLowerCase() || value === value.toUpperCase()

  if (!shouldTitleCase) {
    return normalized
  }

  return normalized
    .split(' ')
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function toDirectoryCategorySummary(input: {
  id: string
  label: string
  description: string
  accent: CategoryAccent
  count: number
  pathLabels: string[]
}) {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    accent: input.accent,
    count: input.count,
    pathLabels: input.pathLabels,
  } satisfies DirectoryCategorySummary
}

function getListingCategory(row: Pick<DirectoryListingRow, 'categorySlugs'>) {
  return getDirectoryCategoryOption(primaryCategorySlug(row.categorySlugs))
}

function getCategoryLabel(
  row: Pick<DirectoryListingRow, 'scope' | 'productType' | 'domain' | 'categorySlugs'>,
) {
  const assignedCategory = getListingCategory(row)
  if (assignedCategory) {
    return assignedCategory.pathLabels.slice(1).join(' ') || assignedCategory.label
  }

  return formatMetadataLabel(row.productType || row.domain || row.scope || 'Utility')
}

function getCardAccent(input: string): CategoryAccent {
  const index =
    Array.from(input).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    CATEGORY_ACCENTS.length

  return CATEGORY_ACCENTS[index]
}

function getListingAccent(row: Pick<DirectoryListingRow, 'name' | 'categorySlugs' | 'scope' | 'productType' | 'domain'>) {
  const assignedCategory = getListingCategory(row)
  if (assignedCategory) {
    return assignedCategory.accent
  }

  return getCardAccent(`${row.name}-${getCategoryLabel(row)}`)
}

function getListingDescription(row: DirectoryListingRow) {
  return (
    sanitizeListingDescription(row.fullDescription) ||
    sanitizeListingTagline(row.tagline) ||
    'Discover a polished tool for your Bluesky workflow.'
  )
}

function toListingCard(row: DirectoryListingRow): DirectoryListingCard {
  const category = getCategoryLabel(row)
  const tagline =
    sanitizeListingTagline(row.tagline) ||
    sanitizeListingTagline(row.fullDescription) ||
    'Discover a polished Bluesky tool.'
  const slugs = row.categorySlugs ?? []
  const reviewCount = row.reviewCount ?? 0
  const averageRating = row.averageRating
  const rating =
    reviewCount > 0 && averageRating != null && !Number.isNaN(Number(averageRating))
      ? Number(Number(averageRating).toFixed(1))
      : null

  return {
    id: row.id,
    name: row.name,
    slug: row.slug || buildDirectoryListingSlug({ name: row.name }),
    tagline,
    description: getListingDescription(row),
    iconUrl: row.iconUrl,
    heroImageUrl: row.heroImageUrl ?? row.screenshotUrls[0] ?? null,
    categorySlugs: slugs,
    categorySlug: primaryCategorySlug(slugs),
    category,
    accent: getListingAccent(row),
    rating,
    reviewCount,
    priceLabel: 'GET',
  }
}

type DirectoryListingDetailRow = DirectoryListingRow & {
  atUri: string | null
  sourceUrl: string
  externalUrl: string | null
  rawCategoryHint: string | null
  vertical: string | null
  classificationReason: string | null
  appTags: string[]
  createdAt: Date
  updatedAt: Date
}

type DirectoryListingGenerationCandidate = {
  id: string
  name: string
  sourceUrl: string
  externalUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
}

type ExtractedPageCopy = {
  finalUrl: string
  title: string | null
  metaDescription: string | null
  ogDescription: string | null
  headings: string[]
  paragraphs: string[]
}

function toListingDetail(row: DirectoryListingDetailRow): DirectoryListingDetail {
  const primary = primaryCategorySlug(row.categorySlugs)
  const assignedCategory = getDirectoryCategoryOption(primary)

  return {
    ...toListingCard(row),
    atUri: row.atUri,
    screenshots: row.screenshotUrls,
    externalUrl: row.externalUrl,
    sourceUrl: row.sourceUrl,
    rawCategoryHint: row.rawCategoryHint
      ? formatMetadataLabel(row.rawCategoryHint)
      : null,
    scope: row.scope ? formatMetadataLabel(row.scope) : null,
    productType: row.productType ? formatMetadataLabel(row.productType) : null,
    domain: row.domain ? formatMetadataLabel(row.domain) : null,
    vertical: row.vertical ? formatMetadataLabel(row.vertical) : null,
    classificationReason: row.classificationReason,
    categorySlugs: row.categorySlugs ?? [],
    categorySlug: primary,
    categoryPathLabel: assignedCategory?.pathLabel || null,
    appTags: normalizeAppTags(row.appTags ?? []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function dedupeListings(rows: DirectoryListingRow[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false
    }

    seen.add(row.id)
    return true
  })
}

function requireCards(
  cards: DirectoryListingCard[],
  desiredCount: number,
  label: string,
) {
  if (cards.length < desiredCount) {
    throw new Error(`Expected ${desiredCount} ${label}, found ${cards.length}`)
  }

  return cards.slice(0, desiredCount)
}

function buildCategories(rows: DirectoryListingRow[], limit = 4) {
  const tree = buildDirectoryCategoryTree(
    rows.flatMap((row) => row.categorySlugs ?? []),
  )
  const assignedCategories = flattenDirectoryCategoryTree(tree)
    .filter((node) => node.depth > 0 && node.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      if (right.depth !== left.depth) {
        return right.depth - left.depth
      }

      return left.pathLabels.join(' / ').localeCompare(right.pathLabels.join(' / '))
    })

  if (assignedCategories.length > 0) {
    return assignedCategories.slice(0, limit).map((category) =>
      toDirectoryCategorySummary(category),
    )
  }

  return fallbackCategoryIds
    .map((categoryId) => getDirectoryCategoryOption(categoryId))
    .filter((category): category is NonNullable<typeof category> => category !== null)
    .map((category) =>
      toDirectoryCategorySummary({
        ...category,
        count: 0,
      }),
    )
    .slice(0, limit)
}

type DirectoryListingAppTagRow = DirectoryListingRow & {
  appTags: string[] | null
}

function isBrowseableAppRow(row: Pick<DirectoryListingRow, 'categorySlugs'>) {
  return row.categorySlugs.some(
    (slug) =>
      slug.startsWith('apps/') && slug.split('/').length === 2,
  )
}

function buildAppTagGroups(rows: DirectoryListingAppTagRow[]) {
  const groups = new Map<string, DirectoryListingCard[]>()

  for (const row of rows) {
    if (!isBrowseableAppRow(row)) {
      continue
    }

    const card = toListingCard(row)

    for (const tag of normalizeAppTags(row.appTags ?? [])) {
      const listings = groups.get(tag)
      if (listings) {
        listings.push(card)
        continue
      }

      groups.set(tag, [card])
    }
  }

  return [...groups.entries()]
    .map(([tag, listings]) => ({
      tag,
      count: listings.length,
      listings: [...listings].sort((left, right) => left.name.localeCompare(right.name)),
    }) satisfies DirectoryAppTagGroup)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.tag.localeCompare(right.tag)
    })
}

function buildAllApps(rows: DirectoryListingRow[]) {
  return dedupeListings(rows.filter(isBrowseableAppRow))
    .map(toListingCard)
}

function isHomePageFeaturedAppRow(row: Pick<DirectoryListingRow, 'categorySlugs'>) {
  return row.categorySlugs.some(
    (slug) =>
      slug.startsWith('apps/') && slug.split('/').length === 2,
  )
}

function isBrowseableProtocolRow(row: Pick<DirectoryListingRow, 'categorySlugs'>) {
  return row.categorySlugs.some(
    (slug) =>
      slug.startsWith('protocol/') && slug.split('/').length === 2,
  )
}

function buildProtocolCategoryGroups(rows: DirectoryListingRow[]): DirectoryProtocolCategoryGroup[] {
  const groups = new Map<string, DirectoryListingCard[]>()

  for (const row of rows) {
    const protocolIds = row.categorySlugs.filter(
      (slug) =>
        slug.startsWith('protocol/') && slug.split('/').length === 2,
    )
    if (protocolIds.length === 0) {
      continue
    }

    const card = toListingCard(row)
    for (const categoryId of protocolIds) {
      const listings = groups.get(categoryId)
      if (listings) {
        listings.push(card)
        continue
      }

      groups.set(categoryId, [card])
    }
  }

  return [...groups.entries()]
    .map(([categoryId, listings]) => {
      const option = getDirectoryCategoryOption(categoryId)
      const segment = categoryId.split('/')[1] ?? categoryId

      return {
        categoryId,
        segment,
        label: option?.label ?? segment,
        description: option?.description ?? '',
        count: listings.length,
        listings: [...listings].sort((left, right) => left.name.localeCompare(right.name)),
      } satisfies DirectoryProtocolCategoryGroup
    })
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.label.localeCompare(right.label)
    })
}

function buildAllProtocolListings(rows: DirectoryListingRow[]) {
  return dedupeListings(rows.filter(isBrowseableProtocolRow))
    .map(toListingCard)
    .sort((left, right) => left.name.localeCompare(right.name))
}

function buildHomePageTagSummaries(
  rows: DirectoryListingAppTagRow[],
  limit = 4,
): DirectoryAppTagSummary[] {
  const groups = buildAppTagGroups(rows)

  if (groups.length > 0) {
    return groups.slice(0, limit).map(({ tag, count }) => ({ tag, count }))
  }

  throw new Error('No app tag summaries found')
}

function getListingSelect(table: typeof dbSchema.storeListings) {
  return {
    id: table.id,
    name: table.name,
    slug: table.slug,
    iconUrl: table.iconUrl,
    heroImageUrl: table.heroImageUrl,
    screenshotUrls: table.screenshotUrls,
    tagline: table.tagline,
    fullDescription: table.fullDescription,
    scope: sql<string | null>`null::text`.as('scope'),
    productType: sql<string | null>`null::text`.as('productType'),
    domain: sql<string | null>`null::text`.as('domain'),
    categorySlugs: table.categorySlugs,
    reviewCount: table.reviewCount,
    averageRating: table.averageRating,
  }
}

function assertDevelopmentOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This action is only available in development.')
  }
}

async function getFullDirectoryListing(
  context: { db: Database; schema: typeof dbSchema },
  id: string,
): Promise<StoreListing> {
  const table = context.schema.storeListings
  const [row] = await context.db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
  if (!row) {
    throw new Error(`Listing not found: ${id}`)
  }
  return row
}

function getListingGenerationUrl(listing: DirectoryListingGenerationCandidate) {
  return listing.externalUrl || listing.sourceUrl || null
}

function normalizeGeneratedText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const cleaned = value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned.length > 0 ? cleaned : null
}

function dedupeGeneratedStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    const cleaned = normalizeGeneratedText(value)
    if (!cleaned) continue

    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    out.push(cleaned)
  }

  return out
}

function shortenToSentence(value: string, maxLength = 160): string {
  const cleaned = normalizeGeneratedText(value) ?? value.trim()
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  const sentenceMatch = cleaned.match(/^(.{30,200}?[.!?])(?:\s|$)/)
  if (sentenceMatch?.[1] && sentenceMatch[1].length <= maxLength) {
    return sentenceMatch[1].trim()
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`
}

function isLikelyBoilerplateText(value: string) {
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
  const { chromium } = await import(/* @vite-ignore */ 'playwright')
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
    await page.emulateMedia({ reducedMotion: 'reduce' })
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
      headings: dedupeGeneratedStrings(headings),
      paragraphs: dedupeGeneratedStrings(paragraphs),
    }
  } finally {
    await browser.close()
  }
}

function chooseSiteTagline(extracted: ExtractedPageCopy): string | null {
  const candidates = dedupeGeneratedStrings([
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

  const joined = normalizeGeneratedText(parts.join('\n\n'))
  if (joined && joined.length >= 80) {
    return joined
  }

  return dedupeGeneratedStrings([
    extracted.metaDescription,
    extracted.ogDescription,
    extracted.paragraphs[0],
  ])[0] ?? null
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

async function generateListingCopyField(input: {
  field: 'tagline' | 'description'
  listing: DirectoryListingGenerationCandidate
  extracted: ExtractedPageCopy
  preferredTagline: string | null
  preferredDescription: string | null
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY ?? ''
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY or ANTHROPIC_KEY in the environment for copy generation.',
    )
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
  const responseKey = input.field === 'tagline' ? 'tagline' : 'description'
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
    max_tokens: 400,
    temperature: 0.2,
    system:
      input.field === 'tagline'
        ? `You write concise, accurate software directory taglines.

Rules:
- Prefer the product's own wording when it is available and clear.
- Do not invent features, platforms, pricing, or claims not supported by the provided page text.
- The tagline must be a single sentence under 140 characters.
- Avoid hype, filler, and phrases like "revolutionary" or "next-generation".
- Return JSON only with the key "tagline".`
        : `You write concise, accurate software directory descriptions.

Rules:
- Prefer the product's own wording when it is available and clear.
- Do not invent features, platforms, pricing, or claims not supported by the provided page text.
- Always write the final description in English, even if the source website is in another language.
- Translate or paraphrase non-English source text into natural English.
- The description should be 2-4 sentences and explain what the product is and why someone would use it.
- Avoid hype, filler, and phrases like "revolutionary" or "next-generation".
- Never include metadata labels such as Category, Platforms, Status, or Last checked.
- Return JSON only with the key "description".`,
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
  const value = String(parsed[responseKey] ?? '')

  if (input.field === 'tagline') {
    const tagline = sanitizeListingTagline(value)
    if (!tagline) {
      throw new Error('Model returned an empty tagline')
    }

    return tagline
  }

  const description = sanitizeListingDescription(value)
  if (!description) {
    throw new Error('Model returned an empty description')
  }

  return description
}

async function generateListingTextField(input: {
  field: 'tagline' | 'description'
  listing: DirectoryListingGenerationCandidate
}): Promise<{ value: string; source: 'website' | 'model' }> {
  const pageUrl = getListingGenerationUrl(input.listing)
  if (!pageUrl) {
    throw new Error(`Missing URL for ${input.listing.name}`)
  }

  const extracted = await extractPageCopy(pageUrl)
  const siteTagline = chooseSiteTagline(extracted)
  const siteDescription = chooseSiteDescription(extracted)

  if (input.field === 'tagline' && siteTagline) {
    return {
      value: siteTagline,
      source: 'website',
    }
  }

  return {
    value: await generateListingCopyField({
      field: input.field,
      listing: input.listing,
      extracted,
      preferredTagline: siteTagline,
      preferredDescription: siteDescription,
    }),
    source: 'model',
  }
}

async function getDirectoryListingGenerationCandidate(
  context: { db: Database; schema: typeof dbSchema },
  id: string,
): Promise<DirectoryListingGenerationCandidate> {
  const table = context.schema.storeListings
  const [listing] = await context.db
    .select({
      id: table.id,
      name: table.name,
      sourceUrl: table.sourceUrl,
      externalUrl: table.externalUrl,
      screenshotUrls: table.screenshotUrls,
      tagline: table.tagline,
      fullDescription: table.fullDescription,
      rawCategoryHint: sql<string | null>`null::text`.as('rawCategoryHint'),
      scope: sql<string | null>`null::text`.as('scope'),
      productType: sql<string | null>`null::text`.as('productType'),
      domain: sql<string | null>`null::text`.as('domain'),
    })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)

  if (!listing) {
    throw new Error(`Listing not found: ${id}`)
  }

  return listing
}

function buildListingGenerationMetadata(
  listing: DirectoryListingGenerationCandidate,
  pageUrl: string,
) {
  return [
    `Name: ${listing.name}`,
    `URL: ${pageUrl}`,
    listing.tagline ? `Tagline: ${listing.tagline}` : null,
    listing.productType ? `Product type: ${listing.productType}` : null,
    listing.domain ? `Domain: ${listing.domain}` : null,
    listing.scope ? `Scope: ${listing.scope}` : null,
    listing.rawCategoryHint ? `Category hint: ${listing.rawCategoryHint}` : null,
    listing.fullDescription ? `Description: ${listing.fullDescription}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n')
}

function buildMarketingPrompt(
  listing: DirectoryListingGenerationCandidate,
  pageUrl: string,
) {
  const metadata = buildListingGenerationMetadata(listing, pageUrl)

  return `Create a polished product-marketing image for this software listing using the provided website screenshot as reference.

Goals:
- Preserve the brand feeling, palette, and product category suggested by the screenshot.
- Produce a clean, aspirational hero image suitable for an app directory card or product detail page.
- Show a plausible marketing composition inspired by the screenshot; improve clarity and composition. Illustrative **mock product UI** (windows, panels, toolbars, in-app controls) is fine—read as the **product**, not a marketing funnel.
- If the reference is dominated by CTAs, signup strips, or "Get started"-style conversion blocks, do not recreate that focal layout—borrow palette and mood only.
- Keep it realistic and product-focused, not abstract art.
- If the listing doesnt have any branding use the following, otherwise stick as closely as possible the brand feeling, palette, and product category suggested by the screenshot.

Constraints:
- No device mockups, browser chrome, cursors, or visible cookie banners.
- **CTAs only:** Do not use marketing / conversion copy as readable text—e.g. "Get started", "Sign up", "Try it free", "Learn more", "Subscribe", "Download", "Contact sales", "Book a demo". Buttons and controls are **allowed** when they read as **in-product mock UI** (neutral toolbars, editors, settings)—not as the main signup or sales pitch.
- No watermarks.
- No tiny unreadable text blocks.
- Avoid adding extra logos unless they are clearly implied by the source.
- Use a landscape composition that reads well when cropped to a wide card.

Fallback style (DO NOT USE IF THE LISTING HAS BRANDING):
- Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.
- Use soft 3D gradients, glossy lighting, rounded cards, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.
- Composition: wide 16:9 banner with richer decorative energy.
- Show layered foreground, midground, and background depth with abstract shapes and energy—still no marketing CTA text or conversion-style hero strips.

Listing metadata:
${metadata}`
}

function buildIconPrompt(
  listing: DirectoryListingGenerationCandidate,
  pageUrl: string,
) {
  const metadata = buildListingGenerationMetadata(listing, pageUrl)

  return `Create a polished product icon for this software listing using the provided website screenshot as reference.

Format (required):
- Output must be exactly 1:1 — a square image (equal width and height), not a rectangle or wide banner.
- Do not add a separate "container" shape: no rounded-square plate, squircle, circle mask, glossy bubble, drop-shadow tile, or fake 3D app icon backing. The brand mark sits directly on a flat fill or transparent background across the full square.
- Safe padding only as empty margin around the mark — not an extra outlined shape.

Goals:
- Preserve the brand feeling, palette, and primary visual motif suggested by the screenshot.
- Produce a crisp standalone mark that reads clearly at small sizes in a software directory.
- Favor a simple, memorable symbol over a detailed illustration.

Style fallback order:
- If the site already suggests a clear brand mark or symbol, refine that mark only — still full-bleed square, no extra outer shape.
- If the site mostly uses a wordmark, extract one simple motif or monogram that still feels native to the brand.
- If the brand is weak or developer-tooling oriented: soft solid or gradient fill across the entire square (no inner rounded card), one centered motif, minimal detail.

Constraints:
- No browser chrome, screenshots, UI mockups, or website layouts.
- No tiny text, taglines, or readable words unless a single letter is essential to the brand.
- Avoid photorealism and avoid generic clip-art.
- Keep edges clean; readable on light or dark backgrounds.

Listing metadata:
${metadata}`
}

async function generateImageFromScreenshot(input: {
  screenshot: Buffer
  prompt: string
}): Promise<{ buffer: Buffer; mimeType: string }> {
  return geminiFlashGenerateImageFromPromptAndImage({
    prompt: input.prompt,
    imageBytes: input.screenshot,
    imageMimeType: 'image/png',
  })
}

const getHomePageData = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const listingSelect = getListingSelect(table)

    const [recentRows, newestRows, tagRows, protocolRows] = await Promise.all([
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, 'apps'),
          ),
        )
        .orderBy(desc(table.updatedAt), desc(table.createdAt))
        .limit(30),
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, 'apps'),
          ),
        )
        .orderBy(desc(table.createdAt))
        .limit(6),
      context.db
        .select({
          ...listingSelect,
          appTags: table.appTags,
        })
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, 'apps'),
          ),
        )
        .orderBy(desc(table.updatedAt), desc(table.createdAt))
        .limit(96),
      context.db
        .select(listingSelect)
        .from(table)
        .where(
          listingPublicWhere(
            table,
            sqlCategorySlugsHasRootTwoSegment(table.categorySlugs, 'protocol'),
          ),
        )
        .orderBy(desc(table.updatedAt), desc(table.createdAt)),
    ])

    if (recentRows.length === 0) {
      throw new Error('No recent rows found')
    }

    const dedupedRecentRows = dedupeListings(recentRows)
    const dedupedRecentAppRows = dedupedRecentRows.filter(isHomePageFeaturedAppRow)
    const featuredSource =
      dedupedRecentAppRows.find(
        (row) =>
          row.heroImageUrl ||
          row.screenshotUrls.length > 0 ||
          row.iconUrl,
      ) || dedupedRecentAppRows[0]

    if (!featuredSource) {
      throw new Error('No homepage featured listing found')
    }

    const featured = toListingCard(featuredSource)
    const remainingAppRows = dedupedRecentAppRows.filter(
      (row) => row.id !== featuredSource.id,
    )

    const spotlights = requireCards(
      remainingAppRows.slice(0, 2).map(toListingCard),
      2,
      'homepage spotlights',
    )

    const popular = requireCards(
      dedupedRecentRows
        .filter((row) => row.id !== featuredSource.id)
        .slice(0, 3)
        .map(toListingCard),
      3,
      'homepage popular listings',
    )

    const fresh = requireCards(
      dedupeListings(newestRows)
        .filter((row) => row.id !== featuredSource.id)
        .slice(0, 3)
        .map(toListingCard),
      3,
      'homepage fresh listings',
    )

    const tags = buildHomePageTagSummaries(tagRows, 8)
    const dedupedProtocolRows = dedupeListings(protocolRows)
    const protocolFeaturedSource =
      dedupedProtocolRows.find((row) => row.screenshotUrls.length > 0 || row.iconUrl) ||
      dedupedProtocolRows[0]
    if (!protocolFeaturedSource) {
      throw new Error('No homepage protocol featured listing found')
    }

    const protocolFeatured = toListingCard(protocolFeaturedSource)
    const protocolSpotlights = requireCards(
      dedupedProtocolRows
        .filter((row) => row.id !== protocolFeaturedSource?.id)
        .slice(0, 2)
        .map(toListingCard),
      2,
      'homepage protocol spotlights',
    )

    const protocolGroups = buildProtocolCategoryGroups(protocolRows)
    const protocolCategories: DirectoryProtocolCategorySummary[] =
      protocolGroups.length > 0
        ? protocolGroups.slice(0, 8 ).map(({ segment, label, count }) => ({
            segment,
            label,
            count,
          }))
        : []

    return {
      featured,
      spotlights,
      popular,
      fresh,
      tags,
      protocolFeatured,
      protocolSpotlights,
      protocolCategories,
    } satisfies DirectoryHomePageData
  })

const getHomePageQueryOptions = queryOptions({
  queryKey: ['storeListings', 'home'],
  queryFn: async () => getHomePageData(),
})

const getDirectoryCategories = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(listingPublicWhere(table))
      .orderBy(desc(table.updatedAt), desc(table.createdAt))
      .limit(500)

    return buildCategories(rows, 12)
  })

const getDirectoryCategoriesQueryOptions = queryOptions({
  queryKey: ['storeListings', 'categories'],
  queryFn: async () => getDirectoryCategories(),
})

const getDirectoryCategoryTree = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select({
        categorySlugs: table.categorySlugs,
      })
      .from(table)
      .where(listingPublicWhere(table))

    return buildDirectoryCategoryTree(
      rows.flatMap((row) => row.categorySlugs ?? []),
    )
  })

const getDirectoryCategoryTreeQueryOptions = queryOptions({
  queryKey: ['storeListings', 'categoryTree'],
  queryFn: async () => getDirectoryCategoryTree(),
})

const getDirectoryCategoryPage = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryCategoryPageInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(listingPublicWhere(table))
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const tree = buildDirectoryCategoryTree(
      rows.flatMap((row) => row.categorySlugs ?? []),
    )
    const category = findDirectoryCategoryNode(tree, data.categoryId)

    if (!category) {
      return null
    }

    const descendantIds = new Set(getDirectoryCategoryDescendantIds(tree, category.id))
    const listings = rows
      .filter((row) =>
        (row.categorySlugs ?? []).some((slug: string) =>
          descendantIds.has(slug),
        ),
      )
      .map(toListingCard)

    return {
      category,
      listings,
    } satisfies DirectoryCategoryPageData
  })

function getDirectoryCategoryPageQueryOptions(
  input: z.input<typeof getDirectoryCategoryPageInput>,
) {
  const normalizedInput = getDirectoryCategoryPageInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'categoryPage', normalizedInput],
    queryFn: async () => getDirectoryCategoryPage({ data: normalizedInput }),
  })
}

const getAppsByTag = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select({
        ...getListingSelect(table),
        appTags: table.appTags,
      })
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'apps/%'),
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return buildAppTagGroups(rows)
  })

const getAppsByTagQueryOptions = queryOptions({
  queryKey: ['storeListings', 'appsByTag'],
  queryFn: async () => getAppsByTag(),
})

const getAllAppsInput = z.object({
  sort: z.enum(['popular', 'newest']).default('popular'),
})

const getAllApps = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getAllAppsInput)
  .handler(async ({ data, context }) => {
    const input = getAllAppsInput.parse(data)
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'apps/%'),
        ),
      )
      .orderBy(
        input.sort === 'newest'
          ? desc(table.createdAt)
          : desc(table.updatedAt),
        desc(table.createdAt),
      )

    return buildAllApps(rows)
  })

function getAllAppsQueryOptions(input: z.input<typeof getAllAppsInput> = {}) {
  const normalizedInput = getAllAppsInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'allApps', normalizedInput],
    queryFn: async () => getAllApps({ data: normalizedInput }),
  })
}

const getAppsByTagPage = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getAppsByTagPageInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select({
        ...getListingSelect(table),
        appTags: table.appTags,
      })
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'apps/%'),
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const groups = buildAppTagGroups(rows)
    const tag = findAppTagBySlug(
      groups.map((group) => group.tag),
      data.tag,
    )

    if (!tag) {
      return null
    }

    return groups.find((group) => group.tag === tag) ?? null
  })

function getAppsByTagPageQueryOptions(input: z.input<typeof getAppsByTagPageInput>) {
  const normalizedInput = getAppsByTagPageInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'appsByTagPage', normalizedInput],
    queryFn: async () => getAppsByTagPage({ data: normalizedInput }),
  })
}

const getProtocolCategories = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'protocol/%'),
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return buildProtocolCategoryGroups(rows)
  })

const getProtocolCategoriesQueryOptions = queryOptions({
  queryKey: ['storeListings', 'protocolCategories'],
  queryFn: async () => getProtocolCategories(),
})

const getProtocolCategoryPage = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getProtocolCategoryPageInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'protocol/%'),
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const groups = buildProtocolCategoryGroups(rows)
    return findProtocolCategoryBySlugParam(groups, data.category) ?? null
  })

function getProtocolCategoryPageQueryOptions(
  input: z.input<typeof getProtocolCategoryPageInput>,
) {
  const normalizedInput = getProtocolCategoryPageInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'protocolCategoryPage', normalizedInput],
    queryFn: async () => getProtocolCategoryPage({ data: normalizedInput }),
  })
}

const getAllProtocolListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.storeListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(
        listingPublicWhere(
          table,
          sqlCategorySlugsMatchesLike(table.categorySlugs, 'protocol/%'),
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return buildAllProtocolListings(rows)
  })

const getAllProtocolListingsQueryOptions = queryOptions({
  queryKey: ['storeListings', 'allProtocol'],
  queryFn: async () => getAllProtocolListings(),
})

const getDirectoryListingDetail = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        heroImageUrl: table.heroImageUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        categorySlugs: table.categorySlugs,
        atUri: table.atUri,
        reviewCount: table.reviewCount,
        averageRating: table.averageRating,
        ...storeListingLegacyDetailColumns,
        appTags: table.appTags,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.id)))
      .limit(1)

    if (!row) {
      return null
    }

    return toListingDetail(row)
  })

const getDirectoryListingDetailBySlug = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({
      slug: z.string().trim().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        heroImageUrl: table.heroImageUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        categorySlugs: table.categorySlugs,
        atUri: table.atUri,
        reviewCount: table.reviewCount,
        averageRating: table.averageRating,
        ...storeListingLegacyDetailColumns,
        appTags: table.appTags,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.slug, data.slug)))
      .limit(1)

    if (!row) {
      return null
    }

    return toListingDetail(row)
  })

function getDirectoryListingDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['storeListings', 'detail', id],
    queryFn: async () => getDirectoryListingDetail({ data: { id } }),
  })
}

function getDirectoryListingDetailBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['storeListings', 'detailBySlug', slug],
    queryFn: async () => getDirectoryListingDetailBySlug({ data: { slug } }),
  })
}

const getDirectoryListingReviews = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryListingReviewsInput)
  .handler(async ({ data, context }) => {
    if (!isUuid(data.id)) {
      return []
    }

    const table = context.schema.storeListings
    const [listing] = await context.db
      .select({ id: table.id })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.id)))
      .limit(1)

    if (!listing) {
      return []
    }

    const rev = context.schema.storeListingReviews
    const rows = await context.db
      .select({
        id: rev.id,
        authorDid: rev.authorDid,
        rating: rev.rating,
        text: rev.text,
        reviewCreatedAt: rev.reviewCreatedAt,
        authorDisplayName: rev.authorDisplayName,
        authorAvatarUrl: rev.authorAvatarUrl,
      })
      .from(rev)
      .where(eq(rev.storeListingId, listing.id))
      .orderBy(desc(rev.reviewCreatedAt))

    const enriched: DirectoryListingReview[] = await Promise.all(
      rows.map(async (row) => {
        const profile = await fetchBlueskyPublicProfileFields(row.authorDid)
        const displayName =
          row.authorDisplayName?.trim() ||
          profile?.displayName?.trim() ||
          profile?.handle ||
          null
        const avatarUrl =
          row.authorAvatarUrl?.trim() || profile?.avatarUrl || null

        return {
          id: row.id,
          authorDid: row.authorDid,
          rating: row.rating,
          text: row.text,
          reviewCreatedAt: row.reviewCreatedAt.toISOString(),
          authorDisplayName: displayName,
          authorAvatarUrl: avatarUrl,
        }
      }),
    )

    return enriched
  })

function getDirectoryListingReviewsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['storeListings', 'reviews', id],
    queryFn: async () => getDirectoryListingReviews({ data: { id } }),
  })
}

const createDirectoryListingReview = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(createDirectoryListingReviewInput)
  .handler(async ({ data, context }) => {
    const session = await getAtprotoSessionForRequest(getRequest())
    if (!session) {
      throw new Error('Sign in to post a review.')
    }

    const table = context.schema.storeListings
    const [listing] = await context.db
      .select({
        id: table.id,
        atUri: table.atUri,
      })
      .from(table)
      .where(listingPublicWhere(table, eq(table.id, data.listingId)))
      .limit(1)

    if (!listing) {
      throw new Error('Listing not found.')
    }

    const atUri = listing.atUri?.trim()
    if (!atUri) {
      throw new Error(
        'This listing has no AT Protocol URI yet; reviews are unavailable until it is published to the network.',
      )
    }

    const rev = context.schema.storeListingReviews
    const [existing] = await context.db
      .select({ id: rev.id })
      .from(rev)
      .where(
        and(
          eq(rev.storeListingId, listing.id),
          eq(rev.authorDid, session.did),
        ),
      )
      .limit(1)

    if (existing) {
      throw new Error('You already reviewed this listing.')
    }

    const createdAt = new Date().toISOString()
    const { uri } = await createListingReviewRecord(session.client, session.did, {
      subject: atUri,
      rating: data.rating,
      createdAt,
      text: data.text,
    })

    return { uri }
  })

const getRelatedDirectoryListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getRelatedDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    if (!isUuid(data.id)) {
      return []
    }

    const table = context.schema.storeListings
    const listingSelect = getListingSelect(table)

    const [currentRow, candidateRows] = await Promise.all([
      context.db
        .select({
          id: table.id,
          appTags: table.appTags,
          categorySlugs: table.categorySlugs,
        })
        .from(table)
        .where(listingPublicWhere(table, eq(table.id, data.id)))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      context.db
        .select({
          ...listingSelect,
          appTags: table.appTags,
          updatedAt: table.updatedAt,
          createdAt: table.createdAt,
        })
        .from(table)
        .where(listingPublicWhere(table, ne(table.id, data.id)))
        .orderBy(desc(table.updatedAt), desc(table.createdAt))
        .limit(128),
    ])

    if (!currentRow) {
      return []
    }

    const currentTags = new Set(normalizeAppTags(currentRow.appTags ?? []))
    if (currentTags.size === 0) {
      return []
    }

    return candidateRows
      .map((row) => {
        const tags = normalizeAppTags(row.appTags ?? [])
        let overlapCount = 0

        for (const tag of tags) {
          if (currentTags.has(tag)) {
            overlapCount += 1
          }
        }

        if (overlapCount === 0) {
          return null
        }

        return {
          card: toListingCard(row),
          overlapCount,
          sameCategory: categorySlugsOverlap(
            row.categorySlugs,
            currentRow.categorySlugs,
          ),
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => {
        if (right.overlapCount !== left.overlapCount) {
          return right.overlapCount - left.overlapCount
        }

        if (left.sameCategory !== right.sameCategory) {
          return left.sameCategory ? -1 : 1
        }

        const updatedDelta = right.updatedAt.getTime() - left.updatedAt.getTime()
        if (updatedDelta !== 0) {
          return updatedDelta
        }

        const createdDelta = right.createdAt.getTime() - left.createdAt.getTime()
        if (createdDelta !== 0) {
          return createdDelta
        }

        return left.card.name.localeCompare(right.card.name)
      })
      .slice(0, data.limit)
      .map((item) => item.card)
  })

function getRelatedDirectoryListingsQueryOptions(
  input: z.input<typeof getRelatedDirectoryListingsInput>,
) {
  const normalizedInput = getRelatedDirectoryListingsInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'related', normalizedInput],
    queryFn: async () => getRelatedDirectoryListings({ data: normalizedInput }),
  })
}

const listDirectoryListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(listDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.storeListings
    const search = data.query?.trim()
    const listingSelect = getListingSelect(table)

    const rows = await context.db
      .select(listingSelect)
      .from(table)
      .where(
        listingPublicWhere(
          table,
          search
            ? or(
                ilike(table.name, `%${search}%`),
                ilike(table.tagline, `%${search}%`),
                ilike(table.fullDescription, `%${search}%`),
                ilike(
                  sql<string>`array_to_string(${table.categorySlugs}, ' ')`,
                  `%${search}%`,
                ),
                ilike(
                  sql<string>`array_to_string(${table.appTags}, ' ')`,
                  `%${search}%`,
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(table.updatedAt), desc(table.createdAt))
      .limit(data.limit)

    return rows.map(toListingCard)
  })

function getListDirectoryListingsQueryOptions(
  input: z.input<typeof listDirectoryListingsInput> = {},
) {
  const normalizedInput = listDirectoryListingsInput.parse(input)

  return queryOptions({
    queryKey: ['storeListings', 'list', normalizedInput],
    queryFn: async () => listDirectoryListings({ data: normalizedInput }),
  })
}

const getDirectoryListingCategoryAssignments = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly()

    const table = context.schema.storeListings
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        categorySlugs: table.categorySlugs,
        scope: sql<string | null>`null::text`.as('scope'),
        productType: sql<string | null>`null::text`.as('productType'),
        domain: sql<string | null>`null::text`.as('domain'),
        updatedAt: table.updatedAt,
      })
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return rows
      .map((row) => {
        const slugs = row.categorySlugs ?? []
        const primary = primaryCategorySlug(slugs)
        const assignedCategory = getDirectoryCategoryOption(primary)
        const legacyCategoryHint = [
          row.scope ? formatMetadataLabel(row.scope) : null,
          row.productType ? formatMetadataLabel(row.productType) : null,
          row.domain ? formatMetadataLabel(row.domain) : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' / ')

        return {
          id: row.id,
          name: row.name,
          iconUrl: row.iconUrl,
          tagline:
            sanitizeListingTagline(row.tagline) ||
            sanitizeListingTagline(row.fullDescription) ||
            'No tagline yet.',
          description:
            sanitizeListingDescription(row.fullDescription) ||
            sanitizeListingTagline(row.tagline) ||
            'No description yet.',
          externalUrl: row.externalUrl,
          categorySlugs: slugs,
          categorySlug: primary,
          categoryPathLabel: assignedCategory?.pathLabel || null,
          legacyCategoryHint: legacyCategoryHint || 'Unclassified',
        } satisfies DirectoryListingCategoryAssignment
      })
      .sort((left, right) => {
        if (left.categorySlug === null && right.categorySlug !== null) {
          return -1
        }

        if (left.categorySlug !== null && right.categorySlug === null) {
          return 1
        }

        return left.name.localeCompare(right.name)
      })
  })

const getDirectoryListingCategoryAssignmentsQueryOptions = queryOptions({
  queryKey: ['storeListings', 'categoryAssignments'],
  queryFn: async () => getDirectoryListingCategoryAssignments(),
})



const getDirectoryListingAppTagAssignments = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly()

    const table = context.schema.storeListings
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        appTags: table.appTags,
        categorySlugs: table.categorySlugs,
        scope: sql<string | null>`null::text`.as('scope'),
        productType: sql<string | null>`null::text`.as('productType'),
        domain: sql<string | null>`null::text`.as('domain'),
        vertical: sql<string | null>`null::text`.as('vertical'),
        rawCategoryHint: sql<string | null>`null::text`.as('rawCategoryHint'),
      })
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const popular = popularTagsFromAllAssignments(
      rows.map((row) => row.appTags ?? []),
      80,
    )

    const assignments: DirectoryListingAppTagAssignment[] = rows.map((row) => {
      const assigned = normalizeAppTags(row.appTags ?? [])
      const slugs = row.categorySlugs ?? []
      const primary = primaryCategorySlug(slugs)
      const metadataSuggestions = suggestAppTagsFromListing({
        scope: row.scope,
        productType: row.productType,
        domain: row.domain,
        vertical: row.vertical,
        rawCategoryHint: row.rawCategoryHint,
        categorySlug: primary,
      })

      return {
        id: row.id,
        name: row.name,
        iconUrl: row.iconUrl,
        tagline:
          sanitizeListingTagline(row.tagline) ||
          sanitizeListingTagline(row.fullDescription) ||
          'No tagline yet.',
        description:
          sanitizeListingDescription(row.fullDescription) ||
          sanitizeListingTagline(row.tagline) ||
          'No description yet.',
        externalUrl: row.externalUrl,
        appTags: assigned,
        suggestedTags: suggestedTagsForListing(assigned, metadataSuggestions, popular, 24),
        categorySlugs: slugs,
        categorySlug: primary,
        scope: row.scope,
        productType: row.productType,
        domain: row.domain,
        vertical: row.vertical,
        rawCategoryHint: row.rawCategoryHint,
      } satisfies DirectoryListingAppTagAssignment
    })

    return assignments.sort((left, right) => {
      if (left.appTags.length === 0 && right.appTags.length > 0) {
        return -1
      }

      if (left.appTags.length > 0 && right.appTags.length === 0) {
        return 1
      }

      return left.name.localeCompare(right.name)
    })
    .filter((listing) =>
      listing.categorySlugs.some(
        (cs) => cs.split('/').length === 2 && !cs.startsWith('protocol/'),
      ),
    )

  })

const getDirectoryListingAppTagAssignmentsQueryOptions = queryOptions({
  queryKey: ['storeListings', 'appTagAssignments'],
  queryFn: async () => getDirectoryListingAppTagAssignments(),
})

const updateDirectoryListingAppTags = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(updateDirectoryListingAppTagsInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const nextTags = normalizeAppTags(data.appTags)
    const full = await getFullDirectoryListing(context, data.id)
    const cs = primaryCategorySlug(full.categorySlugs)
    if (
      !cs ||
      cs.startsWith('protocol/') ||
      cs.split('/').length !== 2
    ) {
      throw new Error(
        'App tags can only be edited for listings in an allowed Apps sub-branch, not Protocol.',
      )
    }

    await publishDirectoryListingDetail(full, { appTags: nextTags })

    return {
      id: data.id,
      appTags: nextTags,
    }
  })

const updateDirectoryListingCategoryAssignment = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(updateDirectoryListingCategoryAssignmentInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const nextCategorySlug = data.categorySlug?.trim() || null
    const full = await getFullDirectoryListing(context, data.id)
    const effective = nextCategorySlug ?? 'misc'

    await publishDirectoryListingDetail(full, { categorySlugs: [effective] })

    return {
      id: data.id,
      categorySlug: nextCategorySlug,
    }
  })

const deleteDirectoryListing = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(deleteDirectoryListingInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const full = await getFullDirectoryListing(context, data.id)
    if (!full.rkey) {
      throw new Error(
        'Listing has no ATProto record (missing rkey). Nothing to delete on the PDS.',
      )
    }

    const { client, repoDid } = await createAtstorePublishClient()
    await deleteRecord(client, repoDid, COLLECTION.listingDetail, full.rkey)

    return {
      id: data.id,
    }
  })

const previewDirectoryListingHeroImage = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const listing = await getDirectoryListingGenerationCandidate(context, data.id)
    const pageUrl = getListingGenerationUrl(listing)

    if (!pageUrl) {
      throw new Error(`Missing URL for ${listing.name}`)
    }

    const screenshot =
      await captureListingPageScreenshotForGeneration(pageUrl)
    const generatedImage = await generateImageFromScreenshot({
      screenshot,
      prompt: buildMarketingPrompt(listing, pageUrl),
    })

    return {
      id: data.id,
      mimeType: generatedImage.mimeType,
      imageBase64: generatedImage.buffer.toString('base64'),
    }
  })

const commitDirectoryListingHeroImage = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(commitGeneratedListingImageInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const full = await getFullDirectoryListing(context, data.id)
    const raw = Buffer.from(data.imageBase64, 'base64')
    const { uri } = await publishDirectoryListingDetail(full, undefined, {
      heroImage: {
        bytes: Uint8Array.from(raw),
        mimeType: data.mimeType.trim(),
      },
    })

    return {
      id: data.id,
      listingDetailUri: uri,
    }
  })

const previewDirectoryListingIcon = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const listing = await getDirectoryListingGenerationCandidate(context, data.id)
    const pageUrl = getListingGenerationUrl(listing)

    if (!pageUrl) {
      throw new Error(`Missing URL for ${listing.name}`)
    }

    const discovered = await discoverSiteBrandIconAsset(pageUrl)
    if (discovered) {
      try {
        const pngIn = await rasterizeBrandIconForGeminiInput(
          discovered.bytes,
          discovered.contentType,
        )
        const polished = await geminiFlashGenerateImageFromPromptAndImage({
          prompt: buildIconPolishFromSiteAssetPrompt({
            name: listing.name,
            pageUrl,
            tagline: listing.tagline,
            productType: listing.productType,
            domain: listing.domain,
            scope: listing.scope,
          }),
          imageBytes: pngIn,
          imageMimeType: 'image/png',
        })
        return {
          id: data.id,
          mimeType: polished.mimeType,
          imageBase64: polished.buffer.toString('base64'),
          previewSource: 'site_asset' as const,
        }
      } catch {
        /* Raster or Gemini failed — fall back to full-page screenshot */
      }
    }

    const screenshot =
      await captureListingPageScreenshotForGeneration(pageUrl)
    const generatedImage = await generateImageFromScreenshot({
      screenshot,
      prompt: buildIconPrompt(listing, pageUrl),
    })

    return {
      id: data.id,
      mimeType: generatedImage.mimeType,
      imageBase64: generatedImage.buffer.toString('base64'),
      previewSource: 'model' as const,
    }
  })

const commitDirectoryListingIcon = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(commitGeneratedListingImageInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const full = await getFullDirectoryListing(context, data.id)
    const raw = Buffer.from(data.imageBase64, 'base64')
    const { uri } = await publishDirectoryListingDetail(full, undefined, {
      icon: {
        bytes: Uint8Array.from(raw),
        mimeType: data.mimeType.trim(),
      },
    })

    return {
      id: data.id,
      listingDetailUri: uri,
    }
  })

const regenerateDirectoryListingTagline = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const listing = await getDirectoryListingGenerationCandidate(context, data.id)
    const nextTagline = await generateListingTextField({
      field: 'tagline',
      listing,
    })
    const full = await getFullDirectoryListing(context, data.id)

    await publishDirectoryListingDetail(full, { tagline: nextTagline.value })

    return {
      id: data.id,
      tagline: nextTagline.value,
      source: nextTagline.source,
    }
  })

const regenerateDirectoryListingDescription = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(regenerateDirectoryListingContentInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const listing = await getDirectoryListingGenerationCandidate(context, data.id)
    const nextDescription = await generateListingTextField({
      field: 'description',
      listing,
    })
    const full = await getFullDirectoryListing(context, data.id)

    await publishDirectoryListingDetail(full, {
      fullDescription: nextDescription.value,
    })

    return {
      id: data.id,
      description: nextDescription.value,
      source: nextDescription.source,
    }
  })

export const directoryListingApi = {
  getHomePageData,
  getHomePageQueryOptions,
  getDirectoryCategories,
  getDirectoryCategoriesQueryOptions,
  getDirectoryCategoryTree,
  getDirectoryCategoryTreeQueryOptions,
  getDirectoryCategoryPage,
  getDirectoryCategoryPageQueryOptions,
  getAllApps,
  getAllAppsQueryOptions,
  getAppsByTag,
  getAppsByTagQueryOptions,
  getAppsByTagPage,
  getAppsByTagPageQueryOptions,
  getProtocolCategories,
  getProtocolCategoriesQueryOptions,
  getProtocolCategoryPage,
  getProtocolCategoryPageQueryOptions,
  getAllProtocolListings,
  getAllProtocolListingsQueryOptions,
  getDirectoryListingDetail,
  getDirectoryListingDetailQueryOptions,
  getDirectoryListingDetailBySlug,
  getDirectoryListingDetailBySlugQueryOptions,
  getDirectoryListingReviews,
  getDirectoryListingReviewsQueryOptions,
  createDirectoryListingReview,
  getRelatedDirectoryListings,
  getRelatedDirectoryListingsQueryOptions,
  listDirectoryListings,
  getListDirectoryListingsQueryOptions,
  getDirectoryListingCategoryAssignments,
  getDirectoryListingCategoryAssignmentsQueryOptions,
  getDirectoryListingAppTagAssignments,
  getDirectoryListingAppTagAssignmentsQueryOptions,
  updateDirectoryListingAppTags,
  updateDirectoryListingCategoryAssignment,
  deleteDirectoryListing,
  previewDirectoryListingHeroImage,
  commitDirectoryListingHeroImage,
  previewDirectoryListingIcon,
  commitDirectoryListingIcon,
  regenerateDirectoryListingTagline,
  regenerateDirectoryListingDescription,
}
