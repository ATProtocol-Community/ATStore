import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { and, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
  getAtstoreRepoDid,
  publishDirectoryListingDetail,
} from '#/lib/atproto/publish-directory-listing'
import { adminFnMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

const CANDIDATES_DIR_RELATIVE = 'out/hero-candidates'

const applyInput = z.object({
  listingId: z.string().uuid(),
})

export type HeroCandidateKind = 'og' | 'screenshot'

export interface HeroCandidate {
  kind: HeroCandidateKind
  filename: string
  sourceUrl: string
  mimeType: string
  byteSize: number
  fetchedAt: string
}

export interface HeroCandidateEntry {
  id: string
  slug: string
  name: string
  externalUrl: string | null
  sourceUrl: string
  /** Hero URL currently saved on the listing in the DB (always null/empty here — that's the filter). */
  currentHeroImageUrl: string | null
  candidate: HeroCandidate
  fetchedAt: string
  /** Local URL the admin page renders the candidate from. */
  candidateImageUrl: string
}

export interface HeroCandidatesIndex {
  generatedAt: string | null
  totalListingsMissingHero: number
  withOgCandidate: number
  entries: HeroCandidateEntry[]
}

function ensureLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Hero candidates admin is only available in development.')
  }
}

interface RawIndexEntry {
  id: string
  slug: string
  name: string
  externalUrl: string | null
  sourceUrl: string
  currentHeroImageUrl: string | null
  candidate: HeroCandidate | null
  fetchedAt: string
}

async function readIndexFile(): Promise<{
  generatedAt: string | null
  rawEntries: RawIndexEntry[]
}> {
  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const indexPath = path.resolve(
    process.cwd(),
    CANDIDATES_DIR_RELATIVE,
    'index.json',
  )

  try {
    const raw = await readFile(indexPath, 'utf8')
    const parsed = JSON.parse(raw) as {
      generatedAt?: string
      entries?: RawIndexEntry[]
    }
    return {
      generatedAt: parsed.generatedAt ?? null,
      rawEntries: parsed.entries ?? [],
    }
  } catch {
    return { generatedAt: null, rawEntries: [] }
  }
}

const getHeroCandidates = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }): Promise<HeroCandidatesIndex> => {
    ensureLocalOnly()
    const { db, schema } = context

    const { generatedAt, rawEntries } = await readIndexFile()

    const ogById = new Map<string, RawIndexEntry>()
    for (const entry of rawEntries) {
      if (entry.candidate?.kind === 'og') {
        ogById.set(entry.id, entry)
      }
    }

    const atstoreRepoDid = await getAtstoreRepoDid()

    /**
     * AtStore-managed listings whose hero is effectively missing. Three cases:
     *   1. `NULL` — never had one.
     *   2. `''`   — Tap ingest occasionally lands an empty string after a record loses its
     *               `heroImage` blob.
     *   3. `/generated/listings/…` — leftover local path from the previous broken apply flow.
     *      These render as broken images on the live site since the file isn't deployed; we want
     *      to re-upload them as real atproto blobs.
     */
    const missingHeroRows = await db
      .select({
        id: schema.storeListings.id,
        slug: schema.storeListings.slug,
        name: schema.storeListings.name,
        externalUrl: schema.storeListings.externalUrl,
        sourceUrl: schema.storeListings.sourceUrl,
        heroImageUrl: schema.storeListings.heroImageUrl,
      })
      .from(schema.storeListings)
      .where(
        and(
          eq(schema.storeListings.verificationStatus, 'verified'),
          eq(schema.storeListings.repoDid, atstoreRepoDid),
          or(
            isNull(schema.storeListings.heroImageUrl),
            eq(schema.storeListings.heroImageUrl, ''),
            like(schema.storeListings.heroImageUrl, '/generated/listings/%'),
          ),
        ),
      )
      .orderBy(sql`${schema.storeListings.name} asc`)

    const totalMissingHero = missingHeroRows.length

    const ids = missingHeroRows.map((row) => row.id)
    /**
     * Cross-reference index entries (only the ones that actually exist in the DB and need a
     * hero). `inArray` short-circuits trivially on empty input which keeps the empty-state path
     * cheap.
     */
    const stillExisting = ids.length
      ? await db
          .select({ id: schema.storeListings.id })
          .from(schema.storeListings)
          .where(inArray(schema.storeListings.id, ids))
      : []
    const existingIds = new Set(stillExisting.map((r) => r.id))

    const entries: HeroCandidateEntry[] = []
    for (const row of missingHeroRows) {
      if (!existingIds.has(row.id)) continue
      const idx = ogById.get(row.id)
      if (!idx?.candidate) continue
      entries.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        externalUrl: row.externalUrl,
        sourceUrl: row.sourceUrl,
        currentHeroImageUrl: row.heroImageUrl ?? null,
        candidate: idx.candidate,
        fetchedAt: idx.fetchedAt,
        candidateImageUrl: `/api/admin/hero-candidate-image?id=${encodeURIComponent(row.id)}`,
      })
    }

    return {
      generatedAt,
      totalListingsMissingHero: totalMissingHero,
      withOgCandidate: entries.length,
      entries,
    }
  })

const getHeroCandidatesQueryOptions = queryOptions({
  queryKey: ['admin', 'hero-candidates'],
  queryFn: async () => getHeroCandidates(),
})

export interface ApplyHeroCandidateResult {
  ok: true
  listingId: string
  heroImageUrl: string
  listingDetailUri: string
}

const applyHeroCandidate = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(applyInput)
  .handler(async ({ data, context }): Promise<ApplyHeroCandidateResult> => {
    ensureLocalOnly()
    const { db, schema } = context

    const { rawEntries } = await readIndexFile()
    const idx = rawEntries.find((row) => row.id === data.listingId)
    if (!idx) {
      throw new Error(
        `No hero candidate index entry for listing ${data.listingId}. Re-run scrape.`,
      )
    }
    if (!idx.candidate || idx.candidate.kind !== 'og') {
      throw new Error(
        `Listing ${idx.name} has no captured og:image to apply.`,
      )
    }

    const atstoreRepoDid = await getAtstoreRepoDid()
    const [liveRow] = await db
      .select()
      .from(schema.storeListings)
      .where(eq(schema.storeListings.id, data.listingId))
      .limit(1)
    if (!liveRow) {
      throw new Error(`Listing ${data.listingId} no longer exists.`)
    }
    if (liveRow.repoDid !== atstoreRepoDid) {
      throw new Error(
        `Listing ${idx.name} is not managed by the AtStore account; refusing to overwrite hero.`,
      )
    }

    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')

    const sourcePath = path.resolve(
      process.cwd(),
      CANDIDATES_DIR_RELATIVE,
      idx.candidate.filename,
    )
    let buffer: Buffer
    try {
      buffer = await readFile(sourcePath)
    } catch {
      throw new Error(
        `Candidate file missing on disk: ${sourcePath}. Re-run the scrape script.`,
      )
    }

    /**
     * Upload the og:image as a fresh atproto blob (rather than just copying it to /public and
     * pointing the DB at a local path). Without this, Tap ingest re-syncs from atproto and
     * overwrites `heroImageUrl` back to whatever the record holds — which after the previous
     * apply broke things, was nothing.
     */
    const { uri, heroImageUrl } = await publishDirectoryListingDetail(
      liveRow,
      undefined,
      {
        heroImage: {
          bytes: Uint8Array.from(buffer),
          mimeType: idx.candidate.mimeType,
        },
      },
    )

    if (!heroImageUrl) {
      throw new Error(
        `Published listing record but could not derive a CDN URL for the new hero blob.`,
      )
    }

    await db
      .update(schema.storeListings)
      .set({ heroImageUrl, updatedAt: new Date() })
      .where(eq(schema.storeListings.id, data.listingId))

    return {
      ok: true,
      listingId: data.listingId,
      heroImageUrl,
      listingDetailUri: uri,
    }
  })

export const adminHeroCandidatesApi = {
  getHeroCandidates,
  getHeroCandidatesQueryOptions,
  applyHeroCandidate,
}
