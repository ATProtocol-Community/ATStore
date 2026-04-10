/**
 * Discover a site logo (common /logo paths, manifest, link icons, meta) or favicon,
 * then normalize to a square PNG suitable for directory icons (upscale small assets).
 */
import * as cheerio from 'cheerio'
import sharp from 'sharp'

/** Many hosts only serve /favicon.ico to browser-like clients. */
const BROWSER_LIKE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TANGLED_HOST = 'tangled.org'

function tangledHostnameNormalized(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

/** e.g. https://tangled.org/owner/repo — not the marketing homepage only. */
export function isTangledRepositoryPageUrl(pageUrl: string): boolean {
  try {
    const u = new URL(pageUrl.trim())
    if (tangledHostnameNormalized(u.hostname) !== TANGLED_HOST) {
      return false
    }
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length >= 2
  } catch {
    return false
  }
}

/**
 * Tangled site-wide favicon / static branding — not the repo project's own art.
 * When the listing URL is a repo on Tangled, skip these so we fall back to Gemini + screenshot.
 */
function isTangledSiteWideBrandingIconAsset(assetUrl: string): boolean {
  try {
    const u = new URL(assetUrl)
    if (tangledHostnameNormalized(u.hostname) !== TANGLED_HOST) {
      return false
    }
    const p = u.pathname.toLowerCase()
    if (p === '/favicon.ico' || p.startsWith('/favicon')) {
      return true
    }
    if (p.includes('apple-touch-icon')) {
      return true
    }
    if (p.includes('android-chrome') || p.includes('mstile')) {
      return true
    }
    if (p.startsWith('/static/logos/') || p.startsWith('/static/favicon')) {
      return true
    }
    // Root marketing logos on the Tangled host (not repo-specific assets).
    if (
      p === '/logo.svg' ||
      p === '/logo.png' ||
      p === '/logo.webp' ||
      p === '/logo@2x.png' ||
      p === '/images/logo.png' ||
      p === '/images/logo.svg' ||
      p === '/assets/logo.png' ||
      p === '/assets/logo.svg' ||
      p === '/static/logo.png' ||
      p === '/static/logo.svg' ||
      p === '/brand/logo.png' ||
      p === '/brand/logo.svg' ||
      p === '/img/logo.png' ||
      p === '/img/logo.svg'
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}
const PAGE_TIMEOUT_MS = 20_000
const ICON_TIMEOUT_MS = 15_000
const MANIFEST_TIMEOUT_MS = 10_000
const OUTPUT_SIZE = 512

type IconSource =
  | 'site-logo-path'
  | 'manifest'
  | 'apple-touch-icon'
  | 'icon-link'
  | 'meta-image'
  | 'favicon'

type IconCandidate = {
  url: string
  source: IconSource
  rel: string | null
  sizes: string | null
  purpose: string | null
  score: number
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

function normalizeSpace(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

function looksLikeImageUrl(url: string): boolean {
  try {
    if (url.startsWith('data:image/')) return true
    const pathname = new URL(url).pathname.toLowerCase()
    return /\.(avif|gif|ico|jpe?g|png|svg|webp)$/.test(pathname)
  } catch {
    return false
  }
}

function getUrlHintScore(url: string): number {
  const haystack = url.toLowerCase()
  let score = 0
  if (
    /(icon|icons|app-icon|appicon|favicon|apple-touch|tileimage|maskable)/.test(
      haystack,
    )
  ) {
    score += 55
  }
  if (/(logo|avatar|brandmark|mark)\b/.test(haystack)) {
    score += 35
  }
  if (/(banner|card|cover|hero|social|share|screenshot)/.test(haystack)) {
    score -= 90
  }
  if (haystack.endsWith('.svg')) {
    score += 40
  }
  if (haystack.includes('favicon.ico')) {
    score += 90
  }
  return score
}

function parseLargestIconSize(sizes: string | null): {
  largest: number | null
  hasAny: boolean
  hasNonSquare: boolean
} {
  if (!sizes) {
    return { largest: null, hasAny: false, hasNonSquare: false }
  }
  const normalized = sizes.toLowerCase().trim()
  if (normalized.includes('any')) {
    return { largest: null, hasAny: true, hasNonSquare: false }
  }
  let largest: number | null = null
  let hasNonSquare = false
  for (const token of normalized.split(/\s+/)) {
    const match = token.match(/^(\d+)x(\d+)$/)
    if (!match) continue
    const width = Number.parseInt(match[1] ?? '0', 10)
    const height = Number.parseInt(match[2] ?? '0', 10)
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    if (width !== height) hasNonSquare = true
    const candidateSize = Math.max(width, height)
    if (largest === null || candidateSize > largest) {
      largest = candidateSize
    }
  }
  return { largest, hasAny: false, hasNonSquare }
}

function scoreCandidate(candidate: Omit<IconCandidate, 'score'>): number {
  let score =
    candidate.source === 'site-logo-path'
      ? 520
      : candidate.source === 'manifest'
        ? 500
        : candidate.source === 'apple-touch-icon'
          ? 430
          : candidate.source === 'icon-link'
            ? 360
            : candidate.source === 'meta-image'
              ? 220
              : 160

  const rel = candidate.rel?.toLowerCase() ?? ''
  const purpose = candidate.purpose?.toLowerCase() ?? ''
  const sizeInfo = parseLargestIconSize(candidate.sizes)

  if (rel.includes('apple-touch-icon')) score += 40
  if (rel.includes('shortcut')) score += 10
  if (rel.includes('mask-icon')) score -= 180
  if (purpose.includes('maskable')) score += 35
  if (purpose.includes('monochrome')) score -= 40

  if (sizeInfo.hasAny) {
    score += 60
  } else if (sizeInfo.largest !== null) {
    if (sizeInfo.largest >= 512) score += 120
    else if (sizeInfo.largest >= 256) score += 90
    else if (sizeInfo.largest >= 192) score += 70
    else if (sizeInfo.largest >= 96) score += 40
    else if (sizeInfo.largest >= 32) score += 20
  }

  if (sizeInfo.hasNonSquare) score -= 70
  score += getUrlHintScore(candidate.url)

  return score
}

function makeCandidate(
  input: Omit<IconCandidate, 'score'>,
): IconCandidate {
  return {
    ...input,
    score: scoreCandidate(input),
  }
}

function collectSiteLogoPathCandidates(baseUrl: string): IconCandidate[] {
  const paths = [
    '/logo.svg',
    '/logo.png',
    '/logo.webp',
    '/logo@2x.png',
    '/images/logo.png',
    '/images/logo.svg',
    '/assets/logo.png',
    '/assets/logo.svg',
    '/static/logo.png',
    '/static/logo.svg',
    '/brand/logo.png',
    '/brand/logo.svg',
    '/img/logo.png',
    '/img/logo.svg',
    '/android-chrome-512x512.png',
    '/favicons/android-chrome-512x512.png',
  ]

  return paths.map((href) =>
    makeCandidate({
      url: resolveUrl(href, baseUrl),
      source: 'site-logo-path',
      rel: 'site-logo',
      sizes: href.includes('512') ? '512x512' : null,
      purpose: null,
    }),
  )
}

function collectLinkedIconCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): IconCandidate[] {
  const candidates: IconCandidate[] = []
  $('link[rel][href]').each((_, element) => {
    const rel = normalizeSpace($(element).attr('rel'))
    const href = normalizeSpace($(element).attr('href'))
    if (!rel || !href) return
    const relLower = rel.toLowerCase()
    if (relLower.includes('manifest')) return
    if (!/\b(icon|apple-touch-icon|mask-icon|fluid-icon)\b/.test(relLower)) return

    const source: IconSource = relLower.includes('apple-touch-icon')
      ? 'apple-touch-icon'
      : relLower.includes('icon')
        ? 'icon-link'
        : 'favicon'

    candidates.push(
      makeCandidate({
        url: resolveUrl(href, baseUrl),
        source,
        rel,
        sizes: normalizeSpace($(element).attr('sizes')),
        purpose: null,
      }),
    )
  })
  return candidates
}

function collectMetaImageCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): IconCandidate[] {
  const candidates: IconCandidate[] = []
  $('meta[content]').each((_, element) => {
    const rawContent = normalizeSpace($(element).attr('content'))
    if (!rawContent) return
    const prop =
      normalizeSpace($(element).attr('property')) ||
      normalizeSpace($(element).attr('name')) ||
      normalizeSpace($(element).attr('itemprop'))
    if (!prop) return
    const propLower = prop.toLowerCase()
    if (
      ![
        'msapplication-tileimage',
        'og:image',
        'og:image:url',
        'twitter:image',
        'twitter:image:src',
        'image',
      ].includes(propLower)
    ) {
      return
    }
    const resolvedUrl = resolveUrl(rawContent, baseUrl)
    const iconLike =
      propLower === 'msapplication-tileimage' ||
      /(icon|logo|avatar|favicon|apple-touch|tileimage|app-icon|appicon)/.test(
        `${propLower} ${resolvedUrl}`.toLowerCase(),
      )
    if (!iconLike) return
    candidates.push(
      makeCandidate({
        url: resolvedUrl,
        source: 'meta-image',
        rel: prop,
        sizes: null,
        purpose: null,
      }),
    )
  })
  return candidates
}

async function collectManifestCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): Promise<IconCandidate[]> {
  const manifestUrls = new Set<string>()
  $('link[rel][href]').each((_, element) => {
    const rel = normalizeSpace($(element).attr('rel'))?.toLowerCase()
    const href = normalizeSpace($(element).attr('href'))
    if (!rel || !href) return
    if (!rel.split(/\s+/).includes('manifest')) return
    manifestUrls.add(resolveUrl(href, baseUrl))
  })

  const candidates: IconCandidate[] = []
  for (const manifestUrl of manifestUrls) {
    try {
      const response = await fetch(manifestUrl, {
        redirect: 'follow',
        headers: {
          'user-agent': BROWSER_LIKE_USER_AGENT,
          accept: 'application/manifest+json,application/json,text/plain,*/*',
        },
        signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
      })
      if (!response.ok) continue
      const manifest = (await response.json()) as {
        icons?: Array<{
          src?: string
          sizes?: string
          purpose?: string
        }>
      }
      for (const icon of manifest.icons ?? []) {
        const src = normalizeSpace(icon?.src)
        if (!src) continue
        candidates.push(
          makeCandidate({
            url: resolveUrl(src, response.url || manifestUrl),
            source: 'manifest',
            rel: 'manifest',
            sizes: normalizeSpace(icon?.sizes),
            purpose: normalizeSpace(icon?.purpose),
          }),
        )
      }
    } catch {
      /* ignore */
    }
  }
  return candidates
}

function collectConventionalFallbackCandidates(baseUrl: string): IconCandidate[] {
  const fallbackSpecs: Array<{
    href: string
    source: IconSource
    rel: string
    sizes: string | null
  }> = [
    {
      href: '/apple-touch-icon.png',
      source: 'apple-touch-icon',
      rel: 'apple-touch-icon',
      sizes: '180x180',
    },
    {
      href: '/apple-touch-icon-precomposed.png',
      source: 'apple-touch-icon',
      rel: 'apple-touch-icon-precomposed',
      sizes: '180x180',
    },
    {
      href: '/favicon-32x32.png',
      source: 'favicon',
      rel: 'favicon',
      sizes: '32x32',
    },
    {
      href: '/favicon-16x16.png',
      source: 'favicon',
      rel: 'favicon',
      sizes: '16x16',
    },
    {
      href: '/favicon.png',
      source: 'favicon',
      rel: 'favicon',
      sizes: null,
    },
    {
      href: '/favicon.ico',
      source: 'favicon',
      rel: 'favicon',
      sizes: null,
    },
  ]

  return fallbackSpecs.map((spec) =>
    makeCandidate({
      url: resolveUrl(spec.href, baseUrl),
      source: spec.source,
      rel: spec.rel,
      sizes: spec.sizes,
      purpose: null,
    }),
  )
}

function dedupeCandidates(candidates: IconCandidate[]): IconCandidate[] {
  const bestByUrl = new Map<string, IconCandidate>()
  for (const candidate of candidates) {
    const existing = bestByUrl.get(candidate.url)
    if (!existing || candidate.score > existing.score) {
      bestByUrl.set(candidate.url, candidate)
    }
  }
  return [...bestByUrl.values()].sort(
    (left, right) =>
      right.score - left.score || left.url.localeCompare(right.url),
  )
}

function bufferLooksLikeHtml(buffer: Buffer): boolean {
  const prefix = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).trimStart()
  return /^(<!doctype html\b|<html\b|<head\b|<body\b)/i.test(prefix)
}

/** Windows ICO: reserved 0, type 1 */
function bufferLooksLikeIco(buffer: Buffer): boolean {
  return buffer.length >= 6 && buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1
}

function bufferLooksLikePng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
}

async function probeImageUrl(
  url: string,
): Promise<{ contentType: string; bytes: Buffer; finalUrl: string } | null> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': BROWSER_LIKE_USER_AGENT,
        accept:
          'image/avif,image/webp,image/apng,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
    })
    if (!response.ok) {
      return null
    }
    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    const finalUrl = response.url || url
    const body = Buffer.from(await response.arrayBuffer())
    const isImageByType = contentType.startsWith('image/')
    const pathLooksLikeIco =
      (() => {
        try {
          return new URL(finalUrl).pathname.toLowerCase().endsWith('.ico')
        } catch {
          return false
        }
      })()
    const looksLikeJpeg = body.length >= 2 && body[0] === 0xff && body[1] === 0xd8
    const sniffBinaryImage =
      bufferLooksLikeIco(body) || bufferLooksLikePng(body) || looksLikeJpeg
    const isPotentialImageByUrl =
      looksLikeImageUrl(finalUrl) &&
      (contentType === '' ||
        contentType === 'application/octet-stream' ||
        contentType === 'binary/octet-stream' ||
        contentType === 'text/plain')
    const isImage =
      isImageByType ||
      (isPotentialImageByUrl && !bufferLooksLikeHtml(body) && (sniffBinaryImage || pathLooksLikeIco)) ||
      (pathLooksLikeIco && sniffBinaryImage && !bufferLooksLikeHtml(body))
    if (!isImage) {
      return null
    }

    let effectiveType = contentType || 'application/octet-stream'
    if (bufferLooksLikeIco(body) && !effectiveType.includes('icon')) {
      effectiveType = 'image/vnd.microsoft.icon'
    }
    if (bufferLooksLikePng(body) && !effectiveType.startsWith('image/')) {
      effectiveType = 'image/png'
    }

    return {
      contentType: effectiveType,
      bytes: body,
      finalUrl,
    }
  } catch {
    return null
  }
}

async function fetchHtmlDocument(
  pageUrl: string,
): Promise<{ finalUrl: string; html: string }> {
  const response = await fetch(pageUrl, {
    redirect: 'follow',
    headers: {
      'user-agent': BROWSER_LIKE_USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${pageUrl}`)
  }
  return {
    finalUrl: response.url || pageUrl,
    html: await response.text(),
  }
}

/**
 * First discovered raw icon bytes (favicon, manifest, /logo, etc.), or `null`.
 */
export async function discoverSiteBrandIconAsset(
  pageUrl: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  let document: { finalUrl: string; html: string }
  try {
    document = await fetchHtmlDocument(pageUrl)
  } catch {
    return null
  }

  const $ = cheerio.load(document.html)
  const baseUrl = document.finalUrl

  const rankedCandidates = dedupeCandidates([
    ...collectSiteLogoPathCandidates(baseUrl),
    ...(await collectManifestCandidates($, baseUrl)),
    ...collectLinkedIconCandidates($, baseUrl),
    ...collectMetaImageCandidates($, baseUrl),
    ...collectConventionalFallbackCandidates(baseUrl),
  ])

  const skipTangledPlatformIcons = isTangledRepositoryPageUrl(baseUrl)

  for (const candidate of rankedCandidates) {
    const probed = await probeImageUrl(candidate.url)
    if (!probed) continue
    if (
      skipTangledPlatformIcons &&
      isTangledSiteWideBrandingIconAsset(probed.finalUrl)
    ) {
      continue
    }
    return {
      bytes: probed.bytes,
      contentType: probed.contentType,
    }
  }

  return null
}

/**
 * Decode ICO/SVG/GIF and normalize to PNG for Gemini inline input (edge ≤ 1024px).
 */
export async function rasterizeBrandIconForGeminiInput(
  bytes: Buffer,
  contentType: string,
): Promise<Buffer> {
  const ct = contentType.toLowerCase().split(';')[0].trim()

  if (ct === 'image/png' || ct === 'image/jpeg' || ct === 'image/webp') {
    const meta = await sharp(bytes, { failOn: 'none' }).metadata()
    const maxDim = Math.max(meta.width ?? 0, meta.height ?? 0)
    if (maxDim > 1024) {
      return sharp(bytes, { failOn: 'none' })
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
    }
    if (ct === 'image/png') {
      return bytes
    }
    return sharp(bytes, { failOn: 'none' }).png().toBuffer()
  }

  return sharp(bytes, { density: 400, failOn: 'none' })
    .resize(1024, 1024, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

/**
 * Rasterize / resize to a square PNG (transparent letterbox) for small favicons and logos.
 */
export async function upscaleBrandIconToSquarePng(
  input: Buffer,
): Promise<Buffer> {
  return sharp(input, {
    density: 400,
    failOn: 'none',
  })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, effort: 7 })
    .toBuffer()
}

/**
 * Sharp-only 512×512 PNG when a usable site asset is found (no Gemini). Prefer
 * `discoverSiteBrandIconAsset` + Gemini for directory flows.
 */
export async function tryGetSiteBrandIconPng(
  pageUrl: string,
): Promise<{ buffer: Buffer; mimeType: 'image/png' } | null> {
  const raw = await discoverSiteBrandIconAsset(pageUrl)
  if (!raw) return null
  try {
    const png = await upscaleBrandIconToSquarePng(raw.bytes)
    if (png.length > 0) {
      return { buffer: png, mimeType: 'image/png' }
    }
  } catch {
    /* ignore */
  }
  return null
}
