/**
 * Match Bluesky post text + URLs + facet handles to directory listings.
 */

export type MatchType = 'handle' | 'url' | 'name' | 'standard_site_doc'

export type ListingMentionIndexRow = {
  id: string
  name: string
  slug: string
  sourceUrl: string
  externalUrl: string | null
  productAccountHandle: string | null
}

export type ListingMentionIndex = {
  byHandle: Map<string, Set<string>>
  byDomain: Map<string, Set<string>>
  listings: ListingMentionIndexRow[]
}

function normalizeHandle(h: string): string {
  return h.trim().replace(/^@/, '').toLowerCase()
}

export function hostnameFromUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export function extractUrlsFromText(text: string): string[] {
  const out: string[] = []
  const re = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const u = m[0].replace(/[),.;:]+$/g, '')
    out.push(u)
  }
  return out
}

function addToMap(map: Map<string, Set<string>>, key: string, id: string) {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  set.add(id)
}

export function buildListingMentionIndex(
  rows: ListingMentionIndexRow[],
): ListingMentionIndex {
  const byHandle = new Map<string, Set<string>>()
  const byDomain = new Map<string, Set<string>>()

  for (const row of rows) {
    const h = row.productAccountHandle
    if (h) {
      addToMap(byHandle, normalizeHandle(h), row.id)
    }

    const su = hostnameFromUrl(row.sourceUrl)
    if (su) addToMap(byDomain, su, row.id)

    const eu = row.externalUrl ? hostnameFromUrl(row.externalUrl) : null
    if (eu) addToMap(byDomain, eu, row.id)
  }

  return { byHandle, byDomain, listings: rows }
}

export type FacetFeature =
  | { $type: string; uri?: string; did?: string }
  | Record<string, unknown>

export type FacetSlice = {
  index: { byteStart: number; byteEnd: number }
  features: FacetFeature[]
}

/** Extract @handle strings from text using facet mention features when present. */
export function facetMentionHandles(
  text: string,
  facets: FacetSlice[] | undefined,
): string[] {
  if (!facets?.length) return []
  const out: string[] = []
  for (const facet of facets) {
    const mention = facet.features?.find((f) =>
      String(f?.$type ?? '').includes('mention'),
    ) as { did?: string } | undefined
    if (!mention?.did) continue
    const start = facet.index?.byteStart ?? 0
    const end = facet.index?.byteEnd ?? start
    const bytes = new TextEncoder().encode(text)
    const slice = bytes.slice(start, end)
    const label = new TextDecoder().decode(slice).trim()
    if (label.startsWith('@')) {
      out.push(normalizeHandle(label.slice(1)))
    }
  }
  return out
}

export function facetLinkUris(facets: FacetSlice[] | undefined): string[] {
  if (!facets?.length) return []
  const out: string[] = []
  for (const facet of facets) {
    for (const f of facet.features ?? []) {
      const t = String(f?.$type ?? '')
      if (t.includes('link') && typeof (f as { uri?: string }).uri === 'string') {
        out.push((f as { uri: string }).uri)
      }
    }
  }
  return out
}

function hasWordBoundaryName(haystackLower: string, name: string): boolean {
  const n = name.trim().toLowerCase()
  if (n.length < 4) return false
  let i = 0
  while ((i = haystackLower.indexOf(n, i)) !== -1) {
    const before = i === 0 || !/[a-z0-9]/i.test(haystackLower[i - 1]!)
    const after =
      i + n.length >= haystackLower.length ||
      !/[a-z0-9]/i.test(haystackLower[i + n.length]!)
    if (before && after) return true
    i += 1
  }
  return false
}

export type MentionHit = {
  storeListingId: string
  matchType: MatchType
  confidence: number
  evidence: Record<string, unknown>
}

function mergeHit(map: Map<string, MentionHit>, hit: MentionHit) {
  const prev = map.get(hit.storeListingId)
  if (!prev || hit.confidence > prev.confidence) {
    map.set(hit.storeListingId, hit)
  }
}

/**
 * Collect listing IDs mentioned in a single post's text + URLs + handles.
 */
export function matchPostToListings(input: {
  index: ListingMentionIndex
  text: string
  urls: string[]
  facetHandles: string[]
}): MentionHit[] {
  const textLower = input.text.toLowerCase()
  const urlHosts = new Set<string>()
  const allUrls = [...input.urls]
  for (const u of allUrls) {
    const h = hostnameFromUrl(u)
    if (h) urlHosts.add(h)
  }

  const byId = new Map<string, MentionHit>()

  for (const handle of input.facetHandles) {
    const ids = input.index.byHandle.get(handle)
    if (!ids) continue
    for (const id of ids) {
      mergeHit(byId, {
        storeListingId: id,
        matchType: 'handle',
        confidence: 0.95,
        evidence: { handle },
      })
    }
  }

  for (const host of urlHosts) {
    const ids = input.index.byDomain.get(host)
    if (!ids) continue
    for (const id of ids) {
      mergeHit(byId, {
        storeListingId: id,
        matchType: 'url',
        confidence: 0.9,
        evidence: { host },
      })
    }
  }

  const hasStandardSite =
    textLower.includes('standard.site') ||
    allUrls.some((u) => u.includes('standard.site'))

  for (const row of input.index.listings) {
    const name = row.name?.trim() ?? ''
    if (name.length >= 4 && hasWordBoundaryName(textLower, name)) {
      mergeHit(byId, {
        storeListingId: row.id,
        matchType: 'name',
        confidence: 0.55,
        evidence: { name },
      })
    }
  }

  if (hasStandardSite) {
    for (const row of input.index.listings) {
      const ext = row.externalUrl ?? row.sourceUrl
      const host = hostnameFromUrl(ext)
      const slug = row.slug?.trim() ?? ''
      let hit = false
      if (host && (textLower.includes(host) || allUrls.some((u) => u.includes(host)))) {
        hit = true
      }
      if (slug && (textLower.includes(slug) || allUrls.some((u) => u.includes(slug)))) {
        hit = true
      }
      if (hit) {
        mergeHit(byId, {
          storeListingId: row.id,
          matchType: 'standard_site_doc',
          confidence: 0.65,
          evidence: { standardSite: true, slug: row.slug },
        })
      }
    }
  }

  return [...byId.values()]
}

export function excerptText(text: string, max = 380): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}
