import * as cheerio from "cheerio"
import { chromium, type Page } from "playwright"

export const BASE_ORIGIN = "https://blueskydirectory.com"

export const FETCH_USER_AGENT =
  "at-store-bluesky-directory-scraper/1.0 (+https://github.com/)"

/** Path prefixes that host product detail pages (exclude profiles, press, etc.). */
export const PRODUCT_PATH_PREFIXES = [
  "clients",
  "utilities",
  "schedulers",
  "feeds",
  "metrics",
  "migrations",
  "labelers",
  "lists",
  "starter-packs",
  "other",
  "bridge",
] as const

const NON_PRODUCT_PATH_PREFIXES = new Set<string>([
  "about",
  "advertise",
  "coming-soon",
  "glossary",
  "livewire",
  "moved-to-bluesky",
  "press",
  "profiles",
  "random",
  "storage",
  "submit",
])

export type ScrapedProduct = {
  name: string
  sourceUrl: string
  /** Directory "Visit" button target, e.g. …/product-slug/out (HTTP redirect to the real site). */
  visitOutUrl: string
  /** Final URL after following redirects from visitOutUrl (off-site). */
  externalUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": FETCH_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return res.text()
}

export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

function isProductDetailPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length < 2) return false
  const [prefix, ...rest] = parts
  if (NON_PRODUCT_PATH_PREFIXES.has(prefix)) {
    return false
  }
  if (rest.some((segment) => segment === "out")) return false
  return true
}

function normalizeDiscoveredProductUrl(rawUrl: string, baseUrl: string): string | null {
  const abs = resolveUrl(rawUrl, baseUrl)
  let u: URL
  try {
    u = new URL(abs)
  } catch {
    return null
  }
  if (u.origin !== new URL(BASE_ORIGIN).origin) return null
  if (!isProductDetailPath(u.pathname)) return null
  u.hash = ""
  u.search = ""
  if (u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "")
  }
  return u.href
}

function collectProductUrlsFromHrefs(hrefs: Iterable<string>, baseUrl: string): string[] {
  const found = new Set<string>()
  for (const href of hrefs) {
    const normalized = normalizeDiscoveredProductUrl(href, baseUrl)
    if (normalized) found.add(normalized)
  }
  return [...found]
}

export function extractProductUrlsFromHtml(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html)
  const hrefs: string[] = []
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (href) hrefs.push(href)
  })
  return collectProductUrlsFromHrefs(hrefs, pageUrl)
}

export async function collectListingUrls(options: {
  listingBases: string[]
  maxPagesPerListing: number
  delayMs: number
}): Promise<string[]> {
  try {
    return await collectListingUrlsWithPlaywright(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Playwright discovery failed, falling back to HTML: ${message}`)
  }

  const all = new Set<string>()

  for (const base of options.listingBases) {
    const normalizedBase = base.startsWith("http") ? base : `${BASE_ORIGIN}${base.startsWith("/") ? "" : "/"}${base}`

    for (let page = 1; page <= options.maxPagesPerListing; page++) {
      const url =
        page === 1
          ? normalizedBase
          : `${normalizedBase}${normalizedBase.includes("?") ? "&" : "?"}page=${page}`
      const html = await fetchHtml(url)
      const batch = extractProductUrlsFromHtml(html, url)
      if (batch.length === 0 && page > 1) break
      for (const u of batch) all.add(u)
      if (options.delayMs > 0) {
        await sleep(options.delayMs)
      }
    }
  }

  return [...all]
}

async function collectListingUrlsWithPlaywright(options: {
  listingBases: string[]
  maxPagesPerListing: number
  delayMs: number
}): Promise<string[]> {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      userAgent: FETCH_USER_AGENT,
    })
    const all = new Set<string>()
    const homepageBase = normalizeListingBaseUrl(BASE_ORIGIN)
    const normalizedBases = options.listingBases.map((base) =>
      normalizeListingBaseUrl(
        base.startsWith("http")
          ? base
          : `${BASE_ORIGIN}${base.startsWith("/") ? "" : "/"}${base}`,
      ),
    )

    if (normalizedBases.includes(homepageBase)) {
      for (const url of await collectHomepageFilterUrls(page, options)) {
        all.add(url)
      }
    }

    for (const base of normalizedBases) {
      if (base === homepageBase) continue
      for (const url of await collectPaginatedListingUrls(page, base, options)) {
        all.add(url)
      }
    }

    return [...all]
  } finally {
    await browser.close()
  }
}

function normalizeListingBaseUrl(url: string): string {
  try {
    const normalized = new URL(url)
    normalized.hash = ""
    normalized.search = ""
    if (normalized.pathname !== "/") {
      normalized.pathname = normalized.pathname.replace(/\/+$/, "")
    }
    return normalized.href.replace(/\/$/, normalized.pathname === "/" ? "/" : "")
  } catch {
    return url
  }
}

async function collectHomepageFilterUrls(
  page: Page,
  options: {
    maxPagesPerListing: number
    delayMs: number
  },
): Promise<string[]> {
  await page.goto(BASE_ORIGIN, { waitUntil: "domcontentloaded" })
  await waitForRenderedListingUpdate(page, options.delayMs)

  const filterOptions = await page.locator('select[name="type"]').evaluate((select) => {
    const typeSelect = select as HTMLSelectElement
    return Array.from(typeSelect.options)
      .map((option) => ({
        value: option.value.trim(),
        label: option.textContent?.trim() ?? "",
      }))
      .filter((option) => option.value.length > 0)
  })

  const all = new Set<string>()
  for (const option of filterOptions) {
    await page.goto(BASE_ORIGIN, { waitUntil: "domcontentloaded" })
    await waitForRenderedListingUpdate(page, options.delayMs)
    await page.locator('select[name="type"]').selectOption(option.value)
    await waitForRenderedListingUpdate(page, options.delayMs)

    for (const url of await collectPaginatedListingUrlsOnCurrentPage(page, options)) {
      all.add(url)
    }
  }

  return [...all]
}

async function collectPaginatedListingUrls(
  page: Page,
  url: string,
  options: {
    maxPagesPerListing: number
    delayMs: number
  },
): Promise<string[]> {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await waitForRenderedListingUpdate(page, options.delayMs)
  return collectPaginatedListingUrlsOnCurrentPage(page, options)
}

async function collectPaginatedListingUrlsOnCurrentPage(
  page: Page,
  options: {
    maxPagesPerListing: number
    delayMs: number
  },
): Promise<string[]> {
  const all = new Set<string>()
  const maxPages =
    options.maxPagesPerListing > 0
      ? options.maxPagesPerListing
      : Number.POSITIVE_INFINITY

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    for (const url of await extractProductUrlsFromPage(page)) {
      all.add(url)
    }

    if (pageNumber >= maxPages) break

    const nextButton = page.getByRole("button", { name: "Next »", exact: true })
    if ((await nextButton.count()) === 0) break
    if (!(await nextButton.first().isVisible())) break
    if (!(await nextButton.first().isEnabled())) break

    await nextButton.first().click()
    await waitForRenderedListingUpdate(page, options.delayMs)
  }

  return [...all]
}

async function extractProductUrlsFromPage(page: Page): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => typeof href === "string" && href.length > 0),
  )
  return collectProductUrlsFromHrefs(hrefs, page.url() || BASE_ORIGIN)
}

async function waitForRenderedListingUpdate(page: Page, delayMs: number): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => {})
  await page.waitForTimeout(Math.max(750, delayMs))
}

function findMainColumn($: cheerio.CheerioAPI) {
  const candidates = $("div.grid.grid-cols-1.items-start")
    .find("div")
    .filter((_, el) => {
      const cls = $(el).attr("class") ?? ""
      return cls.split(/\s+/).includes("md:col-span-2")
    })
  if (candidates.length > 0) return candidates.first()
  return $("body")
}

/** Bluesky Directory uses …/{slug}/out which 302s to the real product URL. */
export function deriveVisitOutUrl(sourceUrl: string): string {
  const u = new URL(sourceUrl)
  const path = u.pathname.replace(/\/$/, "")
  u.pathname = `${path}/out`
  u.hash = ""
  u.search = ""
  return u.href
}

export function extractVisitOutUrlFromHtml(
  html: string,
  sourceUrl: string,
): string | null {
  const $ = cheerio.load(html)
  const mainCol = findMainColumn($)
  let found: string | null = null
  mainCol.find("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    const abs = resolveUrl(href, sourceUrl)
    try {
      const u = new URL(abs)
      if (u.origin !== new URL(BASE_ORIGIN).origin) return
      if (!u.pathname.endsWith("/out")) return
      found = `${u.origin}${u.pathname}`
      return false
    } catch {
      // keep scanning
    }
  })
  return found
}

/**
 * Follow the directory /out redirect chain and return the final URL (usually off-site).
 */
export async function resolveExternalUrl(
  visitOutUrl: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  const signal =
    options?.timeoutMs !== undefined
      ? AbortSignal.timeout(options.timeoutMs)
      : undefined

  let res = await fetch(visitOutUrl, {
    method: "HEAD",
    redirect: "follow",
    headers: { "user-agent": FETCH_USER_AGENT },
    signal,
  })

  if (res.status === 405 || res.status === 501) {
    const signalGet =
      options?.timeoutMs !== undefined
        ? AbortSignal.timeout(options.timeoutMs)
        : undefined
    res = await fetch(visitOutUrl, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": FETCH_USER_AGENT },
      signal: signalGet,
    })
    await res.arrayBuffer().catch(() => {})
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} resolving ${visitOutUrl}`)
  }

  return res.url
}

export async function enrichWithExternalUrl(
  product: ScrapedProduct,
): Promise<ScrapedProduct> {
  try {
    const externalUrl = await resolveExternalUrl(product.visitOutUrl)
    return { ...product, externalUrl }
  } catch {
    return { ...product, externalUrl: null }
  }
}

export function parseProductDetail(html: string, sourceUrl: string): ScrapedProduct {
  const $ = cheerio.load(html)

  const mainCol = findMainColumn($)
  const name = mainCol.find("h1").first().text().trim() || $("h1").first().text().trim()

  const iconSrc =
    mainCol.find('img[alt^="Logo of"]').first().attr("src") ||
    $('img[alt^="Logo of"]').first().attr("src") ||
    null
  const iconUrl = iconSrc ? resolveUrl(iconSrc, sourceUrl) : null

  const tagline =
    mainCol.find("div.prose").first().find("h2").first().text().trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null

  const screenshotUrls = new Set<string>()
  mainCol
    .find('img[alt*="featured image" i]')
    .each((_, el) => {
      const src = $(el).attr("src")
      if (src) screenshotUrls.add(resolveUrl(src, sourceUrl))
    })

  const proseBlocks = mainCol.find("div.prose").toArray()
  let descriptionText = ""
  if (proseBlocks.length >= 2) {
    descriptionText = $(proseBlocks[1]).text().trim()
  } else if (proseBlocks.length === 1) {
    const first = $(proseBlocks[0])
    if (first.find("h2").length > 1 || first.find("p").length > 0) {
      descriptionText = first.text().trim()
    }
  }
  if (!descriptionText) {
    mainCol
      .find("div.prose")
      .last()
      .each((_, el) => {
        descriptionText = $(el).text().trim()
      })
  }

  const fullDescription = descriptionText || null

  const rawCategoryHint =
    parseTypeFromMetaImage($) || extractBadgeNearTitle(mainCol) || null

  const visitOutUrl =
    extractVisitOutUrlFromHtml(html, sourceUrl) ?? deriveVisitOutUrl(sourceUrl)

  return {
    name: name || "Unknown",
    sourceUrl,
    visitOutUrl,
    externalUrl: null,
    iconUrl,
    screenshotUrls: [...screenshotUrls],
    tagline,
    fullDescription,
    rawCategoryHint,
  }
}

function parseTypeFromMetaImage($: cheerio.CheerioAPI): string | null {
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    try {
      const u = new URL(c)
      const type = u.searchParams.get("type")
      if (type) return type
    } catch {
      // ignore
    }
  }
  return null
}

function extractBadgeNearTitle(
  mainCol: ReturnType<typeof findMainColumn>,
): string | null {
  const badge = mainCol.find('[data-flux-badge="data-flux-badge"]').first().text().trim()
  return badge || null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
