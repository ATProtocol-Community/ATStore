import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq, ilike, like, ne, or, sql } from 'drizzle-orm'
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
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from '../../lib/directory-categories'
import {
  sanitizeListingDescription,
  sanitizeListingTagline,
} from '../../lib/listing-copy'
import {
  buildDirectoryListingSlug,
  getDirectoryListingSlug,
} from '../../lib/directory-listing-slugs'
import { dbMiddleware } from './db-middleware'

type DirectoryListingRow = {
  id: string
  name: string
  slug: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  categorySlug: string | null
}

type CategoryAccent = DirectoryCategoryAccent

export interface DirectoryListingCard {
  id: string
  name: string
  slug?: string | null
  tagline: string
  description: string
  iconUrl: string | null
  imageUrl: string | null
  /** Canonical directory path; used for ecosystem/category UI. */
  categorySlug: string | null
  category: string
  accent: CategoryAccent
  rating: number
  priceLabel: string
}

export interface DirectoryListingDetail extends DirectoryListingCard {
  screenshots: string[]
  externalUrl: string | null
  sourceUrl: string | null
  rawCategoryHint: string | null
  scope: string | null
  productType: string | null
  domain: string | null
  vertical: string | null
  classificationReason: string | null
  categorySlug: string | null
  categoryPathLabel: string | null
  appTags: string[]
  createdAt: string | null
  updatedAt: string | null
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

export interface DirectoryListingCategoryAssignment {
  id: string
  name: string
  iconUrl: string | null
  tagline: string
  description: string
  externalUrl: string | null
  categorySlug: string | null
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

const updateDirectoryListingAppTagsInput = z.object({
  id: z.string().min(1),
  appTags: z.array(z.string()).max(64),
})

const getAppsByTagPageInput = z.object({
  tag: z.string().trim().min(1),
})

const getRelatedDirectoryListingsInput = z.object({
  id: z.string().trim().min(1),
  limit: z.number().int().min(1).max(8).default(4),
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

const fallbackHomePageData: DirectoryHomePageData = {
  featured: {
    id: 'fallback-featured',
    name: 'Bluesky Boost',
    tagline: 'Enhance your Bluesky desktop experience',
    description: 'Curated tools, polished interfaces, and everyday power-ups.',
    iconUrl: null,
    imageUrl: null,
    categorySlug: null,
    category: 'Apps',
    accent: 'blue',
    rating: 4.9,
    priceLabel: 'GET',
  },
  spotlights: [
    {
      id: 'fallback-spotlight-social',
      name: 'SkyLink Explorer',
      tagline: 'Visualize the social graph in 3D',
      description: 'See how communities connect and where trends begin.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Bluesky',
      accent: 'purple',
      rating: 4.8,
      priceLabel: 'GET',
    },
    {
      id: 'fallback-spotlight-utility',
      name: 'FeedMaster Pro',
      tagline: 'Custom feeds for every mood',
      description: 'Shape your home feed around signals that matter.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Clients',
      accent: 'green',
      rating: 4.8,
      priceLabel: 'GET',
    },
  ],
  popular: [
    {
      id: 'fallback-popular-1',
      name: 'Bluesky Boost',
      tagline: 'Enhance your Bluesky desktop experience',
      description: 'A lightweight toolkit for power users.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Apps',
      accent: 'blue',
      rating: 4.9,
      priceLabel: 'GET',
    },
    {
      id: 'fallback-popular-2',
      name: 'SkyLink Explorer',
      tagline: 'Visualize the social graph in 3D',
      description: 'Turn follows and lists into an explorable map.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Protocol',
      accent: 'purple',
      rating: 4.8,
      priceLabel: 'GET',
    },
    {
      id: 'fallback-popular-3',
      name: 'FeedMaster Pro',
      tagline: 'Custom feeds for every mood',
      description: 'Tunable ranking for news, memes, and friends.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Tools',
      accent: 'pink',
      rating: 4.8,
      priceLabel: 'GET',
    },
  ],
  fresh: [
    {
      id: 'fallback-new-1',
      name: 'Palette Studio',
      tagline: 'Design beautiful post cards',
      description: 'Make shareable graphics without leaving your flow.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Analytics',
      accent: 'pink',
      rating: 4.8,
      priceLabel: 'GET',
    },
    {
      id: 'fallback-new-2',
      name: 'SkyGuard',
      tagline: 'Privacy-first moderation at scale',
      description: 'Block, mute, and review with better safety controls.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'PDS',
      accent: 'blue',
      rating: 4.7,
      priceLabel: 'GET',
    },
    {
      id: 'fallback-new-3',
      name: 'Listsmith',
      tagline: 'Organize communities into smart lists',
      description: 'Keep your circles tidy as the network grows.',
      iconUrl: null,
      imageUrl: null,
      categorySlug: null,
      category: 'Bluesky',
      accent: 'green',
      rating: 4.7,
      priceLabel: 'GET',
    },
  ],
  tags: [
    { tag: 'social', count: 0 },
    { tag: 'developer tool', count: 0 },
    { tag: 'automation', count: 0 },
    { tag: 'community', count: 0 },
  ],
}

const fallbackDetailListings: DirectoryListingDetail[] = [
  fallbackHomePageData.featured,
  ...fallbackHomePageData.spotlights,
  ...fallbackHomePageData.popular,
  ...fallbackHomePageData.fresh,
].map((listing) => ({
  ...listing,
  screenshots: listing.imageUrl ? [listing.imageUrl] : [],
  externalUrl: null,
  sourceUrl: null,
  rawCategoryHint: null,
  scope: null,
  productType: listing.category,
  domain: null,
  vertical: null,
  classificationReason: null,
  categorySlug: null,
  categoryPathLabel: null,
  appTags: [],
  createdAt: null,
  updatedAt: null,
}))

function getListingCategory(row: Pick<DirectoryListingRow, 'categorySlug'>) {
  return getDirectoryCategoryOption(row.categorySlug)
}

function getCategoryLabel(
  row: Pick<DirectoryListingRow, 'scope' | 'productType' | 'domain' | 'categorySlug'>,
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

function getListingAccent(row: Pick<DirectoryListingRow, 'name' | 'categorySlug' | 'scope' | 'productType' | 'domain'>) {
  const assignedCategory = getListingCategory(row)
  if (assignedCategory) {
    return assignedCategory.accent
  }

  return getCardAccent(`${row.name}-${getCategoryLabel(row)}`)
}

function getPseudoRating(input: string) {
  const offset =
    Array.from(input).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4

  return Number((4.6 + offset * 0.1).toFixed(1))
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

  return {
    id: row.id,
    name: row.name,
    slug: row.slug || buildDirectoryListingSlug({ name: row.name }),
    tagline,
    description: getListingDescription(row),
    iconUrl: row.iconUrl,
    imageUrl: row.screenshotUrls[0] || null,
    categorySlug: row.categorySlug,
    category,
    accent: getListingAccent(row),
    rating: getPseudoRating(row.name),
    priceLabel: 'GET',
  }
}

type DirectoryListingDetailRow = DirectoryListingRow & {
  sourceUrl: string
  externalUrl: string | null
  rawCategoryHint: string | null
  vertical: string | null
  classificationReason: string | null
  appTags: string[]
  createdAt: Date
  updatedAt: Date
}

function toListingDetail(row: DirectoryListingDetailRow): DirectoryListingDetail {
  const assignedCategory = getDirectoryCategoryOption(row.categorySlug)

  return {
    ...toListingCard(row),
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
    categorySlug: row.categorySlug,
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

function ensureCards(
  cards: DirectoryListingCard[],
  fallbackCards: DirectoryListingCard[],
  desiredCount: number,
) {
  const merged = [...cards]

  for (const fallbackCard of fallbackCards) {
    if (merged.length >= desiredCount) {
      break
    }

    if (merged.some((card) => card.id === fallbackCard.id)) {
      continue
    }

    merged.push(fallbackCard)
  }

  return merged.slice(0, desiredCount)
}

function buildCategories(rows: DirectoryListingRow[], limit = 4) {
  const tree = buildDirectoryCategoryTree(rows.map((row) => row.categorySlug))
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

function isBrowseableAppRow(row: Pick<DirectoryListingRow, 'categorySlug'>) {
  return Boolean(
    row.categorySlug &&
      row.categorySlug.startsWith('apps/') &&
      row.categorySlug.split('/').length === 2,
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

  return fallbackHomePageData.tags.slice(0, limit)
}

function getListingSelect(table: any) {
  return {
    id: table.id,
    name: table.name,
    slug: table.slug,
    iconUrl: table.iconUrl,
    screenshotUrls: table.screenshotUrls,
    tagline: table.tagline,
    fullDescription: table.fullDescription,
    scope: table.scope,
    productType: table.productType,
    domain: table.domain,
    categorySlug: table.categorySlug,
  }
}

function assertDevelopmentOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This action is only available in development.')
  }
}

const getHomePageData = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.directoryListings
    const listingSelect = getListingSelect(table)

    const [recentRows, newestRows, tagRows] = await Promise.all([
      context.db
        .select(listingSelect)
        .from(table)
        .orderBy(desc(table.updatedAt), desc(table.createdAt))
        .limit(12),
      context.db.select(listingSelect).from(table).orderBy(desc(table.createdAt)).limit(6),
      context.db
        .select({
          ...listingSelect,
          appTags: table.appTags,
        })
        .from(table)
        .orderBy(desc(table.updatedAt), desc(table.createdAt))
        .limit(96),
    ])

    if (recentRows.length === 0) {
      return fallbackHomePageData
    }

    const dedupedRecentRows = dedupeListings(recentRows)
    const featuredSource =
      dedupedRecentRows.find((row) => row.screenshotUrls.length > 0 || row.iconUrl) ||
      dedupedRecentRows[0]

    if (!featuredSource) {
      return fallbackHomePageData
    }

    const featured = toListingCard(featuredSource)
    const remainingRows = dedupedRecentRows.filter((row) => row.id !== featuredSource.id)

    const spotlights = ensureCards(
      remainingRows.slice(0, 2).map(toListingCard),
      fallbackHomePageData.spotlights,
      2,
    )

    const popular = ensureCards(
      remainingRows.slice(0, 3).map(toListingCard),
      fallbackHomePageData.popular,
      3,
    )

    const fresh = ensureCards(
      dedupeListings(newestRows)
        .filter((row) => row.id !== featuredSource.id)
        .slice(0, 3)
        .map(toListingCard),
      fallbackHomePageData.fresh,
      3,
    )

    const tags = buildHomePageTagSummaries(tagRows, 4)

    return {
      featured,
      spotlights,
      popular,
      fresh,
      tags,
    } satisfies DirectoryHomePageData
  })

const getHomePageQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'home'],
  queryFn: async () => getHomePageData(),
})

const getDirectoryCategories = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))
      .limit(500)

    return buildCategories(rows, 12)
  })

const getDirectoryCategoriesQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'categories'],
  queryFn: async () => getDirectoryCategories(),
})

const getDirectoryCategoryTree = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select({
        categorySlug: table.categorySlug,
      })
      .from(table)

    return buildDirectoryCategoryTree(rows.map((row) => row.categorySlug))
  })

const getDirectoryCategoryTreeQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'categoryTree'],
  queryFn: async () => getDirectoryCategoryTree(),
})

const getDirectoryCategoryPage = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getDirectoryCategoryPageInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const tree = buildDirectoryCategoryTree(rows.map((row) => row.categorySlug))
    const category = findDirectoryCategoryNode(tree, data.categoryId)

    if (!category) {
      return null
    }

    const descendantIds = new Set(getDirectoryCategoryDescendantIds(tree, category.id))
    const listings = rows
      .filter(
        (row) => row.categorySlug !== null && descendantIds.has(row.categorySlug),
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
    queryKey: ['directoryListings', 'categoryPage', normalizedInput],
    queryFn: async () => getDirectoryCategoryPage({ data: normalizedInput }),
  })
}

const getAppsByTag = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select({
        ...getListingSelect(table),
        appTags: table.appTags,
      })
      .from(table)
      .where(like(table.categorySlug, 'apps/%'))
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return buildAppTagGroups(rows)
  })

const getAppsByTagQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'appsByTag'],
  queryFn: async () => getAppsByTag(),
})

const getAllApps = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select(getListingSelect(table))
      .from(table)
      .where(like(table.categorySlug, 'apps/%'))
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return buildAllApps(rows)
  })

const getAllAppsQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'allApps'],
  queryFn: async () => getAllApps(),
})

const getAppsByTagPage = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getAppsByTagPageInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.directoryListings
    const rows = await context.db
      .select({
        ...getListingSelect(table),
        appTags: table.appTags,
      })
      .from(table)
      .where(like(table.categorySlug, 'apps/%'))
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
    queryKey: ['directoryListings', 'appsByTagPage', normalizedInput],
    queryFn: async () => getAppsByTagPage({ data: normalizedInput }),
  })
}

const getDirectoryListingDetail = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const fallbackListing = fallbackDetailListings.find(
      (listing) => listing.id === data.id,
    )
    if (fallbackListing) {
      return fallbackListing
    }

    const table = context.schema.directoryListings
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        rawCategoryHint: table.rawCategoryHint,
        scope: table.scope,
        productType: table.productType,
        domain: table.domain,
        categorySlug: table.categorySlug,
        vertical: table.vertical,
        classificationReason: table.classificationReason,
        appTags: table.appTags,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(eq(table.id, data.id))
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
    const fallbackListing = fallbackDetailListings.find(
      (listing) => getDirectoryListingSlug(listing) === data.slug,
    )
    if (fallbackListing) {
      return fallbackListing
    }

    const table = context.schema.directoryListings
    const [row] = await context.db
      .select({
        id: table.id,
        sourceUrl: table.sourceUrl,
        name: table.name,
        slug: table.slug,
        externalUrl: table.externalUrl,
        iconUrl: table.iconUrl,
        screenshotUrls: table.screenshotUrls,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        rawCategoryHint: table.rawCategoryHint,
        scope: table.scope,
        productType: table.productType,
        domain: table.domain,
        categorySlug: table.categorySlug,
        vertical: table.vertical,
        classificationReason: table.classificationReason,
        appTags: table.appTags,
        createdAt: table.createdAt,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .where(eq(table.slug, data.slug))
      .limit(1)

    if (!row) {
      return null
    }

    return toListingDetail(row)
  })

function getDirectoryListingDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['directoryListings', 'detail', id],
    queryFn: async () => getDirectoryListingDetail({ data: { id } }),
  })
}

function getDirectoryListingDetailBySlugQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ['directoryListings', 'detailBySlug', slug],
    queryFn: async () => getDirectoryListingDetailBySlug({ data: { slug } }),
  })
}

const getRelatedDirectoryListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(getRelatedDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.directoryListings
    const listingSelect = getListingSelect(table)

    const [currentRow, candidateRows] = await Promise.all([
      context.db
        .select({
          id: table.id,
          appTags: table.appTags,
          categorySlug: table.categorySlug,
        })
        .from(table)
        .where(eq(table.id, data.id))
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
        .where(ne(table.id, data.id))
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
          sameCategory: row.categorySlug === currentRow.categorySlug,
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
    queryKey: ['directoryListings', 'related', normalizedInput],
    queryFn: async () => getRelatedDirectoryListings({ data: normalizedInput }),
  })
}

const listDirectoryListings = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .inputValidator(listDirectoryListingsInput)
  .handler(async ({ data, context }) => {
    const table = context.schema.directoryListings
    const search = data.query?.trim()
    const listingSelect = getListingSelect(table)

    const rows = await context.db
      .select(listingSelect)
      .from(table)
      .where(
        search
          ? or(
              ilike(table.name, `%${search}%`),
              ilike(table.tagline, `%${search}%`),
              ilike(table.productType, `%${search}%`),
              ilike(table.domain, `%${search}%`),
              ilike(table.categorySlug, `%${search}%`),
            )
          : sql`true`,
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
    queryKey: ['directoryListings', 'list', normalizedInput],
    queryFn: async () => listDirectoryListings({ data: normalizedInput }),
  })
}

const getDirectoryListingCategoryAssignments = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly()

    const table = context.schema.directoryListings
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        categorySlug: table.categorySlug,
        scope: table.scope,
        productType: table.productType,
        domain: table.domain,
        updatedAt: table.updatedAt,
      })
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    return rows
      .map((row) => {
        const assignedCategory = getDirectoryCategoryOption(row.categorySlug)
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
          categorySlug: row.categorySlug,
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
  queryKey: ['directoryListings', 'categoryAssignments'],
  queryFn: async () => getDirectoryListingCategoryAssignments(),
})



const getDirectoryListingAppTagAssignments = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    assertDevelopmentOnly()

    const table = context.schema.directoryListings
    const rows = await context.db
      .select({
        id: table.id,
        name: table.name,
        iconUrl: table.iconUrl,
        tagline: table.tagline,
        fullDescription: table.fullDescription,
        externalUrl: table.externalUrl,
        appTags: table.appTags,
        categorySlug: table.categorySlug,
        scope: table.scope,
        productType: table.productType,
        domain: table.domain,
        vertical: table.vertical,
        rawCategoryHint: table.rawCategoryHint,
      })
      .from(table)
      .orderBy(desc(table.updatedAt), desc(table.createdAt))

    const popular = popularTagsFromAllAssignments(
      rows.map((row) => row.appTags ?? []),
      80,
    )

    const assignments: DirectoryListingAppTagAssignment[] = rows.map((row) => {
      const assigned = normalizeAppTags(row.appTags ?? [])
      const metadataSuggestions = suggestAppTagsFromListing({
        scope: row.scope,
        productType: row.productType,
        domain: row.domain,
        vertical: row.vertical,
        rawCategoryHint: row.rawCategoryHint,
        categorySlug: row.categorySlug,
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
        categorySlug: row.categorySlug,
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
    .filter((listing) => listing.categorySlug?.split("/").length === 2 && !listing.categorySlug?.startsWith("protocol/"));

  })

const getDirectoryListingAppTagAssignmentsQueryOptions = queryOptions({
  queryKey: ['directoryListings', 'appTagAssignments'],
  queryFn: async () => getDirectoryListingAppTagAssignments(),
})

const updateDirectoryListingAppTags = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .inputValidator(updateDirectoryListingAppTagsInput)
  .handler(async ({ data, context }) => {
    assertDevelopmentOnly()

    const nextTags = normalizeAppTags(data.appTags)
    const table = context.schema.directoryListings

    const [row] = await context.db
      .select({ categorySlug: table.categorySlug })
      .from(table)
      .where(eq(table.id, data.id))
      .limit(1)

    if (!row ) {
      throw new Error(
        `App tags can only be edited for listings in an allowed Apps sub-branch, not Protocol.`,
      )
    }

    await context.db
      .update(table)
      .set({
        appTags: nextTags,
        updatedAt: new Date(),
      })
      .where(eq(table.id, data.id))

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
    const table = context.schema.directoryListings

    await context.db
      .update(table)
      .set({
        categorySlug: nextCategorySlug,
        updatedAt: new Date(),
      })
      .where(eq(table.id, data.id))

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

    const table = context.schema.directoryListings

    await context.db.delete(table).where(eq(table.id, data.id))

    return {
      id: data.id,
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
  getDirectoryListingDetail,
  getDirectoryListingDetailQueryOptions,
  getDirectoryListingDetailBySlug,
  getDirectoryListingDetailBySlugQueryOptions,
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
}
