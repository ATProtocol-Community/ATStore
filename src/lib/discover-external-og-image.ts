import * as cheerio from 'cheerio'

const FETCH_TIMEOUT_MS = 25_000

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function resolveUrlAgainstBase(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/**
 * Parse the listing's product page HTML and return the first usable Open Graph / Twitter image URL.
 */
export async function discoverOgImageUrlFromPage(
  pageUrl: string,
): Promise<string | null> {
  let html: string
  try {
    const response = await fetch(pageUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': BROWSER_USER_AGENT,
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return null
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (
      contentType &&
      !/text\/html|application\/xhtml/i.test(contentType)
    ) {
      return null
    }
    html = await response.text()
  } catch {
    return null
  }

  const $ = cheerio.load(html)
  const candidates: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | undefined) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed) return
    const absolute = resolveUrlAgainstBase(trimmed, pageUrl)
    if (!absolute) return
    if (seen.has(absolute)) return
    seen.add(absolute)
    candidates.push(absolute)
  }

  $('meta[property="og:image:secure_url"]').each((_, el) =>
    push($(el).attr('content')),
  )
  $('meta[property="og:image"]').each((_, el) => push($(el).attr('content')))
  $('meta[property="og:image:url"]').each((_, el) =>
    push($(el).attr('content')),
  )
  $('meta[name="og:image"]').each((_, el) => push($(el).attr('content')))
  $('meta[name="twitter:image"]').each((_, el) =>
    push($(el).attr('content')),
  )
  $('meta[name="twitter:image:src"]').each((_, el) =>
    push($(el).attr('content')),
  )

  return candidates[0] ?? null
}

export function getListingExternalPageUrl(row: {
  externalUrl: string | null
  sourceUrl: string
}): string | null {
  const ext = row.externalUrl?.trim()
  if (ext) return ext
  const src = row.sourceUrl?.trim()
  return src || null
}
