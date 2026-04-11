import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { mimeFromPath } from '#/lib/atproto/resolve-image-bytes.shared'

/**
 * Read an image from `./public` (Node / SSR only). Kept out of the default module
 * so client bundles never pull `node:fs`.
 */
export async function readPublicImageFile(raw: string): Promise<{
  bytes: Uint8Array
  mimeType: string
}> {
  const rel = raw.startsWith('/') ? raw.slice(1) : raw
  const filePath = join(process.cwd(), 'public', rel)
  const bytes = await readFile(filePath)
  const mimeType = mimeFromPath(filePath)
  return { bytes: new Uint8Array(bytes), mimeType }
}
