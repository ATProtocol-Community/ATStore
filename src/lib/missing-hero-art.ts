import {
  getAppTagHeroArtPrompt,
  getAppTagHeroArtSpec,
  getAppTagHeroArtSpecForTag,
  type AppTagHeroArtSpec,
} from './app-tag-hero-art'
import { getDirectoryCategoryOption } from './directory-categories'
import {
  getEcosystemHeroArtPrompt,
  getEcosystemHeroArtSpec,
  type EcosystemHeroArtPromptContext,
  type EcosystemHeroArtSpec,
} from './ecosystem-hero-art'
import { GENERATED_BANNER_RECORD_URLS } from './generated-banner-record-urls'
import {
  getProtocolCategoryCoverArtPrompt,
  getProtocolCategoryCoverArtSpecForSegment,
  PROTOCOL_CATEGORY_COVER_SPECS,
  type ProtocolCategoryCoverArtSpec,
} from './protocol-category-hero-art'

export const HERO_ART_KINDS = ['app-tag', 'ecosystem', 'protocol-category'] as const
export type HeroArtKind = (typeof HERO_ART_KINDS)[number]

/** Static app-tag slugs that should always have hero art, independent of DB. */
const STATIC_APP_TAG_HERO_SLUGS = ['all', 'all-apps'] as const

export interface HeroArtItem {
  kind: HeroArtKind
  /** Stable identifier: tag string for app-tag, `apps/…` categoryId, or protocol segment. */
  id: string
  label: string
  assetPath: string
  hasAsset: boolean
  mappedUrl: string | null
  /** Number of published listings backing this item (when known). */
  listingCount?: number
}

export interface HeroArtInventory {
  appTags: HeroArtItem[]
  ecosystem: HeroArtItem[]
  protocolCategory: HeroArtItem[]
}

export interface HeroArtSpecInput {
  /** Flat list of category slugs (one entry per listing×slug pair) from published listings. */
  categorySlugs: readonly string[]
  /** Flat list of app tags (one entry per listing×tag pair) from published listings. */
  appTags: readonly string[]
  /**
   * All category-slug arrays, one per published listing. Used to count how many
   * listings are in each ecosystem branch (exact or prefix match).
   */
  categorySlugsByListing?: ReadonlyArray<readonly string[]>
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function hasMappedUrl(assetPath: string) {
  return Boolean(GENERATED_BANNER_RECORD_URLS[assetPath])
}

function mappedUrlFor(assetPath: string) {
  return GENERATED_BANNER_RECORD_URLS[assetPath] ?? null
}

function toItem(
  kind: HeroArtKind,
  id: string,
  label: string,
  assetPath: string,
  listingCount?: number,
): HeroArtItem {
  return {
    kind,
    id,
    label,
    assetPath,
    hasAsset: hasMappedUrl(assetPath),
    mappedUrl: mappedUrlFor(assetPath),
    ...(typeof listingCount === 'number' ? { listingCount } : {}),
  }
}

/** Count listings whose `categorySlugs` contain `categoryId` exactly or as a parent prefix. */
function countListingsInEcosystemBranch(
  categoryId: string,
  categorySlugsByListing: ReadonlyArray<readonly string[]>,
) {
  const prefix = `${categoryId}/`
  let total = 0
  for (const slugs of categorySlugsByListing) {
    const match = slugs.some(
      (slug) => slug === categoryId || slug.startsWith(prefix),
    )
    if (match) {
      total += 1
    }
  }
  return total
}

export function buildAppTagSpecsFromDatabase(appTags: Iterable<string>) {
  const specs = new Map<string, AppTagHeroArtSpec>()

  for (const slug of STATIC_APP_TAG_HERO_SLUGS) {
    const spec = getAppTagHeroArtSpec(slug)
    specs.set(spec.slug, spec)
  }

  for (const tag of appTags) {
    const trimmed = tag?.trim()
    if (!trimmed) continue
    const spec = getAppTagHeroArtSpecForTag(trimmed)
    specs.set(spec.slug, spec)
  }

  return [...specs.values()].sort((left, right) => left.slug.localeCompare(right.slug))
}

/**
 * Ecosystem entries include:
 * - `apps/<name>` roots — only if at least one listing has a slug underneath them
 *   (e.g. `apps/semble` shows because `apps/semble/client` exists; `apps/2n` is hidden).
 * - `apps/<name>/<sub>` sub-branches — always included when a listing has that slug,
 *   so admins can generate art for e.g. `apps/semble/client` too.
 */
export function buildEcosystemSpecsFromDatabase(categorySlugs: Iterable<string>) {
  const rootsWithChildren = new Set<string>()
  const subBranches = new Set<string>()

  for (const slug of categorySlugs) {
    const normalized = slug?.trim().toLowerCase()
    if (!normalized) continue
    const parts = normalized.split('/').filter(Boolean)
    if (parts[0] !== 'apps') continue
    if (parts.length < 3) continue
    rootsWithChildren.add(`apps/${parts[1]}`)
    subBranches.add(parts.slice(0, 3).join('/'))
  }

  const categoryIds = new Set<string>([...rootsWithChildren, ...subBranches])

  const specs: EcosystemHeroArtSpec[] = []
  for (const categoryId of [...categoryIds].sort((a, b) => a.localeCompare(b))) {
    const option = getDirectoryCategoryOption(categoryId)
    const spec = getEcosystemHeroArtSpec(option?.id ?? categoryId)
    if (spec) {
      specs.push(spec)
    }
  }
  return specs
}

export function buildProtocolCategorySpecsFromDatabase(
  categorySlugs: Iterable<string>,
) {
  const segments = new Set<string>()

  for (const slug of categorySlugs) {
    const normalized = slug?.trim().toLowerCase()
    if (!normalized) continue
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length !== 2 || parts[0] !== 'protocol') continue
    const segment = parts[1]
    if (segment) {
      segments.add(segment)
    }
  }

  for (const spec of PROTOCOL_CATEGORY_COVER_SPECS) {
    segments.add(spec.segment)
  }

  const specs: ProtocolCategoryCoverArtSpec[] = []
  for (const segment of [...segments].sort((a, b) => a.localeCompare(b))) {
    const option = getDirectoryCategoryOption(`protocol/${segment}`)
    specs.push(getProtocolCategoryCoverArtSpecForSegment(segment, option?.label))
  }
  return specs
}

export function buildHeroArtInventory(input: HeroArtSpecInput): HeroArtInventory {
  const categorySlugsByListing = input.categorySlugsByListing ?? []

  const ecosystem = buildEcosystemSpecsFromDatabase(input.categorySlugs)
    .map((spec) => {
      const listingCount = countListingsInEcosystemBranch(
        spec.categoryId,
        categorySlugsByListing,
      )
      return toItem(
        'ecosystem',
        spec.categoryId,
        spec.label,
        spec.assetPath,
        listingCount,
      )
    })
    .filter((item) => (item.listingCount ?? 0) > 0)

  return {
    appTags: buildAppTagSpecsFromDatabase(input.appTags).map((spec) =>
      toItem('app-tag', spec.slug, spec.label, spec.assetPath),
    ),
    ecosystem,
    protocolCategory: buildProtocolCategorySpecsFromDatabase(input.categorySlugs).map(
      (spec) => toItem('protocol-category', spec.segment, spec.label, spec.assetPath),
    ),
  }
}

export function splitMissing(items: readonly HeroArtItem[]) {
  const missing: HeroArtItem[] = []
  const present: HeroArtItem[] = []
  for (const item of items) {
    ;(item.hasAsset ? present : missing).push(item)
  }
  return { missing, present }
}

export interface ResolveHeroArtGenerationOptions {
  /** Optional runtime context for `kind === 'ecosystem'` that personalizes the prompt. */
  ecosystemContext?: EcosystemHeroArtPromptContext
}

/** Used by the server generator — returns spec + prompt + asset path for a single item. */
export function resolveHeroArtGenerationTarget(
  kind: HeroArtKind,
  id: string,
  options?: ResolveHeroArtGenerationOptions,
) {
  const normalized = id.trim()
  if (!normalized) {
    throw new Error('Missing hero art id')
  }

  if (kind === 'app-tag') {
    const spec = getAppTagHeroArtSpec(normalized)
    return {
      kind,
      label: spec.label,
      assetPath: spec.assetPath,
      prompt: getAppTagHeroArtPrompt(spec),
    }
  }

  if (kind === 'ecosystem') {
    const spec = getEcosystemHeroArtSpec(normalized)
    if (!spec) {
      throw new Error(`No ecosystem hero art spec for "${id}"`)
    }
    return {
      kind,
      label: spec.label,
      assetPath: spec.assetPath,
      prompt: getEcosystemHeroArtPrompt(spec, options?.ecosystemContext),
    }
  }

  if (kind === 'protocol-category') {
    const option = getDirectoryCategoryOption(`protocol/${normalized}`)
    const spec = getProtocolCategoryCoverArtSpecForSegment(normalized, option?.label)
    return {
      kind,
      label: spec.label,
      assetPath: spec.assetPath,
      prompt: getProtocolCategoryCoverArtPrompt(spec),
    }
  }

  throw new Error(`Unknown hero art kind: ${String(kind)}`)
}

export { uniqueSorted as _uniqueSorted }
