import type { Client } from '@atcute/client'
import { ok } from '@atcute/client'

import { COLLECTION, NSID } from '#/lib/atproto/nsids'
import type { FyiAtstoreListingDetail } from '#/lib/atproto/listing-record'

export type FyiAtstoreProfile = {
  $type: typeof NSID.profile
  displayName: string
  description?: string
  website?: string
}

/**
 * Create a record, or replace it if one exists. `swapRecord` must be a CID, not a boolean.
 */
async function repoUpsertRecord(
  client: Client,
  input: {
    repo: string
    collection: string
    rkey: string
    record: Record<string, unknown>
  },
): Promise<{ uri: string }> {
  const existing = await client.get('com.atproto.repo.getRecord', {
    params: {
      repo: input.repo,
      collection: input.collection,
      rkey: input.rkey,
    },
  })

  if (existing.ok && existing.data?.cid) {
    const res = await ok(
      client.post('com.atproto.repo.putRecord', {
        input: {
          repo: input.repo,
          collection: input.collection,
          rkey: input.rkey,
          record: input.record,
          swapRecord: existing.data.cid,
        },
      }),
    )
    return { uri: res.uri }
  }

  const res = await ok(
    client.post('com.atproto.repo.createRecord', {
      input: {
        repo: input.repo,
        collection: input.collection,
        rkey: input.rkey,
        record: input.record,
      },
    }),
  )
  return { uri: res.uri }
}

export async function putProfileSelfRecord(
  client: Client,
  repo: string,
  record: FyiAtstoreProfile,
): Promise<{ uri: string }> {
  return repoUpsertRecord(client, {
    repo,
    collection: COLLECTION.profile,
    rkey: 'self',
    record: { ...record, $type: NSID.profile },
  })
}

export async function createListingDetailRecord(
  client: Client,
  repo: string,
  record: FyiAtstoreListingDetail,
): Promise<{ uri: string; cid: string }> {
  const res = await ok(
    client.post('com.atproto.repo.createRecord', {
      input: {
        repo,
        collection: COLLECTION.listingDetail,
        record,
      },
    }),
  )
  return { uri: res.uri, cid: res.cid }
}

export async function deleteRecord(
  client: Client,
  repo: string,
  collection: string,
  rkey: string,
): Promise<void> {
  await ok(
    client.post('com.atproto.repo.deleteRecord', {
      input: { repo, collection, rkey },
    }),
  )
}
