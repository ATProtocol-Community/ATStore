import type { Client } from '@atcute/client'
import { ComAtprotoRepoUploadBlob } from '@atcute/atproto'
import { ok } from '@atcute/client'
import type { Blob as AtprotoBlob } from '@atcute/lexicons/interfaces'

/**
 * Kitchen-style: POST `com.atproto.repo.uploadBlob` with raw bytes + Content-Type.
 */
export async function uploadImageBlob(
  client: Client,
  bytes: Uint8Array,
  mimeType: string,
): Promise<AtprotoBlob> {
  const data = await ok(
    client.call(ComAtprotoRepoUploadBlob, {
      input: bytes,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(bytes.byteLength),
      },
    }),
  )
  return data.blob as AtprotoBlob
}
