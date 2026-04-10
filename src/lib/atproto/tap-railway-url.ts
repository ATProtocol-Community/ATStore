function isRailwayAppHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'railway.app' || h.endsWith('.railway.app')
}

/**
 * Railway-hosted Tap: the public URL is HTTPS/WSS. If `TAP_URL` uses `http://`, the Tap
 * client builds `ws://…/channel` and the edge responds with **301** to WSS — `ws` does not
 * follow that redirect (`Unexpected server response: 301`). Force `https:` for
 * `*.railway.app` and strip dev port `:2480` (mirrors kitchen tap-sync).
 */
export function normalizeTapUrlForRailway(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  try {
    const u = new URL(trimmed)
    if (!isRailwayAppHost(u.hostname)) {
      return trimmed
    }
    if (u.port === '2480') {
      u.port = ''
      console.log(
        `[tap] normalized Railway Tap URL (removed :2480): ${u.origin}`,
      )
    }
    if (u.protocol === 'http:') {
      u.protocol = 'https:'
      console.log(`[tap] normalized Railway Tap URL (HTTPS): ${u.origin}`)
    }
    return u.toString().replace(/\/+$/, '')
  } catch {
    let s = trimmed
    if (/\.railway\.app/i.test(s) && s.includes(':2480')) {
      s = s.replace(':2480', '')
      console.log(`[tap] normalized Railway Tap URL (removed :2480, fallback): ${s}`)
    }
    if (/^https?:\/\//i.test(s) && /\.railway\.app/i.test(s)) {
      s = s.replace(/^http:\/\//i, 'https://')
      console.log(`[tap] normalized Railway Tap URL (HTTPS, fallback): ${s}`)
    }
    return s.replace(/\/+$/, '')
  }
}

/** Optional startup probe; failures are logged but do not exit (WebSocket may still work). */
export async function probeTapHealth(
  baseUrl: string,
  adminPassword?: string,
): Promise<void> {
  const healthUrl = `${baseUrl.replace(/\/+$/, '')}/health`
  const headers: Record<string, string> = {}
  if (adminPassword) {
    headers.Authorization = `Basic ${Buffer.from(`admin:${adminPassword}`).toString('base64')}`
  }
  try {
    const response = await fetch(healthUrl, { headers })
    if (response.ok) {
      const text = await response.text()
      let summary: string
      try {
        summary = JSON.stringify(JSON.parse(text))
      } catch {
        summary = text.slice(0, 200)
      }
      console.log(`[tap] health OK ${healthUrl} → ${summary}`)
    } else {
      console.warn(
        `[tap] health ${response.status} ${response.statusText} (${healthUrl})`,
      )
    }
  } catch (err) {
    console.warn(
      `[tap] health check failed (${healthUrl}) — continuing to WebSocket:`,
      err instanceof Error ? err.message : err,
    )
  }
}
