/**
 * Match Bluesky post text + URLs + facet handles to directory listings.
 * Does not match on product display name (too many false positives).
 */

import { shouldOmitUrlMentionsForBlueskyPlatformListing } from '#/lib/directory-categories'

export type MatchType = 'handle' | 'url' | 'standard_site_doc'

export type ListingMentionIndexRow = {
  id: string
  name: string
  slug: string
  sourceUrl: string
  externalUrl: string | null
  productAccountHandle: string | null
  /** When set, used to drop noisy URL matches for specific listings (e.g. Bluesky platform). */
  categorySlugs?: string[]
}

export type ListingMentionIndex = {
  byHandle: Map<string, Set<string>>
  byDomain: Map<string, Set<string>>
  byExactUrl: Map<string, Set<string>>
  listings: ListingMentionIndexRow[]
}

const SHARED_HOSTS_REQUIRING_EXACT_URL_MATCH = new Set([
  'github.com',
  'apps.apple.com',
])

const HOSTS_WITH_ROOT_LISTING_AND_PATH_LISTINGS = new Set(['tangled.org'])

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

function looksLikeDomainHandle(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 3 || !t.includes('.')) return false
  if (t.startsWith('.') || t.endsWith('.')) return false
  return /^[a-z0-9][a-z0-9._-]*(?:\.[a-z0-9][a-z0-9._-]*)+$/i.test(t)
}

/**
 * Handles written as @name.host.tld in post text when facets are missing or incomplete.
 * Requires dot-separated segments (avoids @everyone, @here).
 */
export function extractAtHandleMentionsFromText(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /@([^\s@]{1,253})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]!.replace(/[),.;:]+$/g, '').trim()
    if (!looksLikeDomainHandle(raw)) continue
    const h = normalizeHandle(raw)
    if (seen.has(h)) continue
    seen.add(h)
    out.push(h)
  }
  return out
}

/**
 * `https://bsky.app/profile/handle.bsky.social/post/...` → handle (not `did:` — those need a DID index).
 */
export function extractBskyAppProfileHandlesFromUrls(urls: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    let u: URL
    try {
      u = new URL(raw.trim())
    } catch {
      continue
    }
    if (!u.hostname.toLowerCase().endsWith('bsky.app')) continue
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] !== 'profile' || !parts[1]) continue
    const id = parts[1]
    if (id.startsWith('did:')) continue
    const h = normalizeHandle(id)
    if (h.length < 3 || seen.has(h)) continue
    seen.add(h)
    out.push(h)
  }
  return out
}

export function urlPathContainsSlug(url: string, slug: string): boolean {
  const s = slug.trim().toLowerCase()
  if (s.length < 2) return false
  try {
    const u = new URL(url.trim().includes('://') ? url.trim() : `https://${url.trim()}`)
    const path = u.pathname.toLowerCase()
    return (
      path === `/${s}` ||
      path.endsWith(`/${s}`) ||
      path.includes(`/${s}/`) ||
      path.includes(`/${s}?`)
    )
  } catch {
    return false
  }
}

function textContainsSlugToken(text: string, slug: string): boolean {
  const haystack = text.toLowerCase()
  const needle = slug.trim().toLowerCase()
  if (needle.length < 2) return false
  let from = 0
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return false
    const prev = at === 0 ? '' : haystack[at - 1]
    const next =
      at + needle.length >= haystack.length ? '' : haystack[at + needle.length]
    const prevIsBoundary = prev === '' || !/[a-z0-9-]/.test(prev)
    const nextIsBoundary = next === '' || !/[a-z0-9-]/.test(next)
    if (prevIsBoundary && nextIsBoundary) return true
    from = at + 1
  }
  return false
}

function addToMap(map: Map<string, Set<string>>, key: string, id: string) {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  set.add(id)
}

function shouldUseExactUrlMatchOnly(host: string): boolean {
  return SHARED_HOSTS_REQUIRING_EXACT_URL_MATCH.has(host)
}

function normalizedPathFromUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return u.pathname.replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
}

function shouldUseExactUrlMatchOnlyForListingUrl(rawUrl: string, host: string): boolean {
  if (shouldUseExactUrlMatchOnly(host)) return true
  if (HOSTS_WITH_ROOT_LISTING_AND_PATH_LISTINGS.has(host)) {
    const path = normalizedPathFromUrl(rawUrl)
    return path !== '/' && path != null
  }
  return false
}

function canonicalUrlForExactMatch(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.hostname.toLowerCase()}${path.toLowerCase()}`
  } catch {
    return null
  }
}

function listingRequiresExactUrlOnlyForHost(
  row: ListingMentionIndexRow,
  host: string,
): boolean {
  const urls = [row.sourceUrl, row.externalUrl].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0,
  )
  const hostUrls = urls.filter((u) => hostnameFromUrl(u) === host)
  if (hostUrls.length === 0) return false
  return hostUrls.every((u) => shouldUseExactUrlMatchOnlyForListingUrl(u, host))
}

function listingHosts(row: ListingMentionIndexRow): Set<string> {
  const hosts = new Set<string>()
  const sourceHost = hostnameFromUrl(row.sourceUrl)
  if (sourceHost) hosts.add(sourceHost)
  if (row.externalUrl) {
    const externalHost = hostnameFromUrl(row.externalUrl)
    if (externalHost) hosts.add(externalHost)
  }
  return hosts
}

export function buildListingMentionIndex(
  rows: ListingMentionIndexRow[],
): ListingMentionIndex {
  const byHandle = new Map<string, Set<string>>()
  const byDomain = new Map<string, Set<string>>()
  const byExactUrl = new Map<string, Set<string>>()

  for (const row of rows) {
    const h = row.productAccountHandle
    if (h) {
      addToMap(byHandle, normalizeHandle(h), row.id)
    }

    const su = hostnameFromUrl(row.sourceUrl)
    if (su) {
      if (shouldUseExactUrlMatchOnlyForListingUrl(row.sourceUrl, su)) {
        const key = canonicalUrlForExactMatch(row.sourceUrl)
        if (key) addToMap(byExactUrl, key, row.id)
      } else {
        addToMap(byDomain, su, row.id)
      }
    }

    const eu = row.externalUrl ? hostnameFromUrl(row.externalUrl) : null
    if (eu && row.externalUrl) {
      if (shouldUseExactUrlMatchOnlyForListingUrl(row.externalUrl, eu)) {
        const key = canonicalUrlForExactMatch(row.externalUrl)
        if (key) addToMap(byExactUrl, key, row.id)
      } else {
        addToMap(byDomain, eu, row.id)
      }
    }
  }

  return { byHandle, byDomain, byExactUrl, listings: rows }
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
  const firstUrlByHost = new Map<string, string>()
  const exactUrlCandidates = new Set<string>()
  const allUrls = [...input.urls]
  for (const u of allUrls) {
    const h = hostnameFromUrl(u)
    if (h) {
      urlHosts.add(h)
      if (!firstUrlByHost.has(h)) firstUrlByHost.set(h, u)
    }
    const exact = canonicalUrlForExactMatch(u)
    if (exact) exactUrlCandidates.add(exact)
  }

  const handleCandidates = new Set<string>()
  for (const h of input.facetHandles) {
    handleCandidates.add(normalizeHandle(h))
  }
  for (const h of extractAtHandleMentionsFromText(input.text)) {
    handleCandidates.add(h)
  }
  for (const h of extractBskyAppProfileHandlesFromUrls(allUrls)) {
    handleCandidates.add(h)
  }

  const byId = new Map<string, MentionHit>()

  for (const handle of handleCandidates) {
    if (!handle) continue
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
    const matchedUrl = firstUrlByHost.get(host)
    for (const id of ids) {
      mergeHit(byId, {
        storeListingId: id,
        matchType: 'url',
        confidence: 0.9,
        evidence: matchedUrl ? { host, url: matchedUrl } : { host },
      })
    }
  }

  for (const exactUrl of exactUrlCandidates) {
    const ids = input.index.byExactUrl.get(exactUrl)
    if (!ids) continue
    for (const id of ids) {
      mergeHit(byId, {
        storeListingId: id,
        matchType: 'url',
        confidence: 0.92,
        evidence: { exactUrl },
      })
    }
  }

  for (const u of allUrls) {
    const host = hostnameFromUrl(u)
    if (!host) continue
    for (const row of input.index.listings) {
      const slug = row.slug?.trim() ?? ''
      if (!slug || !urlPathContainsSlug(u, slug)) continue
      if (!listingHosts(row).has(host)) continue
      if (listingRequiresExactUrlOnlyForHost(row, host)) continue
      mergeHit(byId, {
        storeListingId: row.id,
        matchType: 'url',
        confidence: 0.82,
        evidence: { slugInUrlPath: slug, url: u },
      })
    }
  }

  const hasStandardSite =
    textLower.includes('standard.site') ||
    allUrls.some((u) => u.includes('standard.site'))

  if (hasStandardSite) {
    for (const row of input.index.listings) {
      const ext = row.externalUrl ?? row.sourceUrl
      const host = hostnameFromUrl(ext)
      const slug = row.slug?.trim() ?? ''
      let hit = false
      if (host && (textLower.includes(host) || allUrls.some((u) => u.includes(host)))) {
        hit = true
      }
      if (slug && textContainsSlugToken(textLower, slug)) {
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

  const listingById = new Map(input.index.listings.map((r) => [r.id, r]))

  return [...byId.values()].filter((hit) => {
    if (hit.matchType !== 'url') return true
    const row = listingById.get(hit.storeListingId)
    if (!row) return true
    return !shouldOmitUrlMentionsForBlueskyPlatformListing(row.categorySlugs)
  })
}

export function excerptText(text: string, max = 380): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}
