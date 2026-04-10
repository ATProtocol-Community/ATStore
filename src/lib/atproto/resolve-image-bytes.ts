import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function mimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase()
  for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    if (lower.endsWith(ext)) return mime
  }
  return 'application/octet-stream'
}

/**
 * Load image bytes from an `https?://` URL, or a site path like `/generated/foo.png`
 * (resolved under `./public`).
 */
export async function resolveUrlToImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const raw = url.trim()
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    let res = await fetch(raw)
    // Legacy bug: `blobLikeToBskyCdnUrl` used `mime.split('/').pop()` → `@xml` for some types;
    // CDN 404s but the same blob often works with a raster suffix.
    if (
      !res.ok &&
      res.status === 404 &&
      raw.includes('cdn.bsky.app') &&
      /@xml(?:\?|$)/.test(raw)
    ) {
      const alt = raw.replace(/@xml(\?|$)/, '@jpeg$1')
      if (alt !== raw) {
        res = await fetch(alt)
      }
    }
    if (!res.ok) {
      throw new Error(`fetch ${raw}: ${res.status}`)
    }
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim()
    const buf = new Uint8Array(await res.arrayBuffer())
    const mt =
      mimeType && mimeType.startsWith('image/')
        ? mimeType
        : mimeFromPath(new URL(raw).pathname)
    return { bytes: buf, mimeType: mt }
  }

  const rel = raw.startsWith('/') ? raw.slice(1) : raw
  const filePath = join(process.cwd(), 'public', rel)
  const bytes = await readFile(filePath)
  const mimeType = mimeFromPath(filePath)
  return { bytes: new Uint8Array(bytes), mimeType }
}
