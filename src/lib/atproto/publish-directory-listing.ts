import { Client, CredentialManager } from '@atcute/client'

import type { StoreListing } from '#/db/schema'
import {
  buildListingDetailRecordWithBlobs,
  type ListingDetailBlobOverrides,
} from '#/lib/atproto/listing-record'
import {
  createListingDetailRecord,
  putListingDetailRecord,
} from '#/lib/atproto/repo-records'

export async function createAtstorePublishClient(): Promise<{
  client: Client
  repoDid: string
}> {
  const identifier = process.env.ATSTORE_IDENTIFIER?.trim()
  const password = process.env.ATSTORE_APP_PASSWORD?.trim()
  const service = process.env.ATSTORE_SERVICE?.trim() || 'https://bsky.social'
  if (!identifier || !password) {
    throw new Error(
      'Set ATSTORE_IDENTIFIER and ATSTORE_APP_PASSWORD (store account app password) to publish listing records.',
    )
  }
  const manager = new CredentialManager({ service })
  await manager.login({ identifier, password })
  const session = manager.session
  if (!session?.did) {
    throw new Error('AT Store login failed')
  }
  return { client: new Client({ handler: manager }), repoDid: session.did }
}

let atstoreRepoDidMemo: string | null = null

/**
 * DID of the AT Store listing publisher (same account as `createAtstorePublishClient`).
 * Set `ATSTORE_REPO_DID` to avoid an extra login when checking claim eligibility.
 */
export async function getAtstoreRepoDid(): Promise<string> {
  const fromEnv = process.env.ATSTORE_REPO_DID?.trim()
  if (fromEnv?.startsWith('did:')) {
    return fromEnv
  }
  if (atstoreRepoDidMemo) {
    return atstoreRepoDidMemo
  }
  const { repoDid } = await createAtstorePublishClient()
  atstoreRepoDidMemo = repoDid
  return repoDid
}

function mergeListingRow(
  row: StoreListing,
  patch?: Partial<StoreListing>,
): StoreListing {
  if (!patch) return row
  return { ...row, ...patch }
}

/**
 * Publish `fyi.atstore.listing.detail` to the store repo. Postgres is updated by Tap ingest, not here.
 */
export async function publishDirectoryListingDetail(
  row: StoreListing,
  patch?: Partial<StoreListing>,
  blobOverrides?: ListingDetailBlobOverrides,
): Promise<{ uri: string }> {
  const { client, repoDid } = await createAtstorePublishClient()
  const merged = mergeListingRow(row, patch)
  const { record } = await buildListingDetailRecordWithBlobs(
    client,
    merged,
    blobOverrides,
  )
  record.updatedAt = new Date().toISOString()

  if (row.rkey && row.atUri) {
    return putListingDetailRecord(client, repoDid, row.rkey, record)
  }
  const { uri } = await createListingDetailRecord(client, repoDid, record)
  return { uri }
}
