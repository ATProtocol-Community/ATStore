import {
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoDeleteRecord,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoPutRecord,
} from '@atcute/atproto'
import type { Client } from '@atcute/client'
import { ok } from '@atcute/client'
import type { InferInput } from '@atcute/lexicons/validations'
import * as TID from '@atcute/tid'

import { COLLECTION, NSID } from '#/lib/atproto/nsids'
import type { FyiAtstoreListingDetail } from '#/lib/atproto/listing-record'

type RepoCreateRecordInput = InferInput<
  (typeof ComAtprotoRepoCreateRecord.mainSchema.input)['schema']
>
type RepoGetRecordParams = InferInput<typeof ComAtprotoRepoGetRecord.mainSchema.params>
type RepoPutRecordInput = InferInput<
  (typeof ComAtprotoRepoPutRecord.mainSchema.input)['schema']
>
type RepoDeleteRecordInput = InferInput<
  (typeof ComAtprotoRepoDeleteRecord.mainSchema.input)['schema']
>

/** Runtime values are validated by the PDS; narrow plain strings to lexicon-branded types. */
function lexCreateRecordInput(args: {
  repo: string
  collection: string
  rkey: string
  record: unknown
}): RepoCreateRecordInput {
  return args as RepoCreateRecordInput
}

function lexGetRecordParams(args: {
  repo: string
  collection: string
  rkey: string
}): RepoGetRecordParams {
  return args as RepoGetRecordParams
}

function lexPutRecordInput(args: {
  repo: string
  collection: string
  rkey: string
  record: Record<string, unknown>
  swapRecord: string
}): RepoPutRecordInput {
  return args as RepoPutRecordInput
}

function lexDeleteRecordInput(args: {
  repo: string
  collection: string
  rkey: string
}): RepoDeleteRecordInput {
  return args as RepoDeleteRecordInput
}

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
    params: lexGetRecordParams({
      repo: input.repo,
      collection: input.collection,
      rkey: input.rkey,
    }),
  })

  if (existing.ok && existing.data?.cid) {
    const res = await ok(
      client.post('com.atproto.repo.putRecord', {
        input: lexPutRecordInput({
          repo: input.repo,
          collection: input.collection,
          rkey: input.rkey,
          record: input.record,
          swapRecord: existing.data.cid,
        }),
      }),
    )
    return { uri: res.uri }
  }

  const res = await ok(
    client.call(ComAtprotoRepoCreateRecord, {
      input: lexCreateRecordInput({
        repo: input.repo,
        collection: input.collection,
        rkey: input.rkey,
        record: input.record,
      }),
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
    client.call(ComAtprotoRepoCreateRecord, {
      input: lexCreateRecordInput({
        repo,
        collection: COLLECTION.listingDetail,
        rkey: TID.now(),
        record,
      }),
    }),
  )
  return { uri: res.uri, cid: res.cid }
}

export async function createListingReviewRecord(
  client: Client,
  repo: string,
  input: {
    subject: string
    rating: number
    createdAt: string
    text?: string | null
  },
): Promise<{ uri: string; cid: string }> {
  const record: Record<string, unknown> = {
    $type: NSID.listingReview,
    subject: input.subject,
    rating: input.rating,
    createdAt: input.createdAt,
  }
  const t = input.text?.trim()
  if (t) record.text = t

  const res = await ok(
    client.call(ComAtprotoRepoCreateRecord, {
      input: lexCreateRecordInput({
        repo,
        collection: COLLECTION.listingReview,
        rkey: TID.now(),
        record,
      }),
    }),
  )
  return { uri: res.uri, cid: res.cid }
}

/** Replace an existing `fyi.atstore.listing.detail` (same rkey). */
export async function putListingDetailRecord(
  client: Client,
  repo: string,
  rkey: string,
  record: FyiAtstoreListingDetail,
): Promise<{ uri: string }> {
  return repoUpsertRecord(client, {
    repo,
    collection: COLLECTION.listingDetail,
    rkey,
    record: record as Record<string, unknown>,
  })
}

export async function deleteRecord(
  client: Client,
  repo: string,
  collection: string,
  rkey: string,
): Promise<void> {
  await ok(
    client.post('com.atproto.repo.deleteRecord', {
      input: lexDeleteRecordInput({ repo, collection, rkey }),
    }),
  )
}
