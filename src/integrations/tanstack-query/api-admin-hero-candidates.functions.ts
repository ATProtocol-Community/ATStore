import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import {
  getAtstoreRepoDid,
  publishDirectoryListingDetail,
} from '#/lib/atproto/publish-directory-listing'
import { adminFnMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

const CANDIDATES_DIR_RELATIVE = 'out/hero-candidates'
const REVIEWED_FILE_NAME = 'reviewed.json'

const reviewActionEnum = z.enum(['applied', 'dismissed'])
type ReviewAction = z.infer<typeof reviewActionEnum>

const listingIdInput = z.object({
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
  /** Hero URL currently saved on the listing in the DB. */
  currentHeroImageUrl: string | null
  /** Whether the live hero is the legacy AI-generated `/generated/listings/...` path. */
  currentHeroIsAiGenerated: boolean
  candidate: HeroCandidate
  fetchedAt: string
  /** Local URL the admin page renders the candidate from. */
  candidateImageUrl: string
}

export interface HeroCandidatesIndex {
  generatedAt: string | null
  totalWithOgCandidate: number
  totalWithScreenshotCandidate: number
  totalReviewed: number
  totalApplied: number
  totalDismissed: number
  pending: HeroCandidateEntry[]
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

async function getIndexFilePath(): Promise<string> {
  const path = await import('node:path')
  return path.resolve(process.cwd(), CANDIDATES_DIR_RELATIVE, 'index.json')
}

async function readIndexFile(): Promise<{
  generatedAt: string | null
  rawEntries: RawIndexEntry[]
}> {
  const { readFile } = await import('node:fs/promises')
  const indexPath = await getIndexFilePath()

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

/**
 * Atomic write of `index.json` (matches the temp-file-then-rename pattern used by
 * {@link writeReviewedFile} and other hero-candidate writers).
 */
async function writeIndexFile(payload: {
  generatedAt: string | null
  entries: RawIndexEntry[]
}): Promise<void> {
  const { mkdir, rename, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const indexPath = await getIndexFilePath()
  await mkdir(path.dirname(indexPath), { recursive: true })
  const tmp = `${indexPath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8')
  await rename(tmp, indexPath)
}

interface ReviewRecord {
  id: string
  action: ReviewAction
  at: string
  /** Hero URL we set in the DB at apply time (only for `applied`). Helpful for retrospect/undo. */
  heroImageUrl?: string
}

interface ReviewedFile {
  reviews: ReviewRecord[]
}

async function getReviewedFilePath(): Promise<string> {
  const path = await import('node:path')
  return path.resolve(process.cwd(), CANDIDATES_DIR_RELATIVE, REVIEWED_FILE_NAME)
}

async function readReviewedFile(): Promise<ReviewedFile> {
  const { readFile } = await import('node:fs/promises')
  const filePath = await getReviewedFilePath()
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as ReviewedFile
    if (!Array.isArray(parsed.reviews)) {
      return { reviews: [] }
    }
    return parsed
  } catch {
    return { reviews: [] }
  }
}

/**
 * Atomic-ish write so a crash mid-loop can't leave us with a half-written reviewed list. We write
 * the new content to a sibling temp file and rename over the real one (POSIX rename is atomic
 * within a filesystem).
 */
async function writeReviewedFile(file: ReviewedFile): Promise<void> {
  const { mkdir, rename, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const filePath = await getReviewedFilePath()
  const dir = path.dirname(filePath)
  await mkdir(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, JSON.stringify(file, null, 2), 'utf8')
  await rename(tmp, filePath)
}

async function appendReview(record: ReviewRecord): Promise<void> {
  const file = await readReviewedFile()
  /**
   * Re-applying or re-dismissing the same listing replaces the prior record so the file doesn't
   * accumulate dupes; the most recent action wins.
   */
  const filtered = file.reviews.filter((r) => r.id !== record.id)
  filtered.push(record)
  await writeReviewedFile({ reviews: filtered })
}

async function removeReview(listingId: string): Promise<void> {
  const file = await readReviewedFile()
  const next = file.reviews.filter((r) => r.id !== listingId)
  if (next.length === file.reviews.length) return
  await writeReviewedFile({ reviews: next })
}

const getHeroCandidates = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }): Promise<HeroCandidatesIndex> => {
    ensureLocalOnly()
    const { db, schema } = context

    const [{ generatedAt, rawEntries }, reviewedFile] = await Promise.all([
      readIndexFile(),
      readReviewedFile(),
    ])

    /**
     * Surface every listing with *any* captured candidate — the user's review queue should
     * include screenshot-only sites (e.g. atmo.garden ships no og:image, but its screenshot is a
     * fine hero candidate) too. We still track og vs. screenshot counts separately for the
     * status row, and og candidates are sorted to the top of the list below.
     */
    const candidateById = new Map<string, RawIndexEntry>()
    let totalWithOgCandidate = 0
    let totalWithScreenshotCandidate = 0
    for (const entry of rawEntries) {
      if (!entry.candidate) continue
      candidateById.set(entry.id, entry)
      if (entry.candidate.kind === 'og') totalWithOgCandidate += 1
      else if (entry.candidate.kind === 'screenshot')
        totalWithScreenshotCandidate += 1
    }

    let totalApplied = 0
    let totalDismissed = 0
    const reviewedIds = new Set<string>()
    for (const r of reviewedFile.reviews) {
      reviewedIds.add(r.id)
      if (r.action === 'applied') totalApplied += 1
      else if (r.action === 'dismissed') totalDismissed += 1
    }

    const candidateIds = Array.from(candidateById.keys())
    if (candidateIds.length === 0) {
      return {
        generatedAt,
        totalWithOgCandidate: 0,
        totalWithScreenshotCandidate: 0,
        totalReviewed: reviewedFile.reviews.length,
        totalApplied,
        totalDismissed,
        pending: [],
      }
    }

    const atstoreRepoDid = await getAtstoreRepoDid()

    /**
     * Restrict to AtStore-managed verified rows so we never publish to a repo we don't own.
     * Filtering out reviewed ids in SQL would be possible but the set is small enough that doing
     * it in memory keeps the query simple.
     */
    const liveRows = await db
      .select({
        id: schema.storeListings.id,
        slug: schema.storeListings.slug,
        name: schema.storeListings.name,
        externalUrl: schema.storeListings.externalUrl,
        sourceUrl: schema.storeListings.sourceUrl,
        heroImageUrl: schema.storeListings.heroImageUrl,
        categorySlugs: schema.storeListings.categorySlugs,
      })
      .from(schema.storeListings)
      .where(
        and(
          eq(schema.storeListings.verificationStatus, 'verified'),
          eq(schema.storeListings.repoDid, atstoreRepoDid),
          inArray(schema.storeListings.id, candidateIds),
        ),
      )

    const pending: HeroCandidateEntry[] = []
    for (const row of liveRows) {
      if (reviewedIds.has(row.id)) continue
      /**
       * Protocol listings are out of scope for this og:image cleanup pass — their hero art is
       * managed via the dedicated protocol-page hero generation pipeline, not site og:images.
       */
      if (
        row.categorySlugs.some(
          (slug) => slug === 'protocol' || slug.startsWith('protocol/'),
        )
      ) {
        continue
      }
      const idx = candidateById.get(row.id)
      if (!idx?.candidate) continue
      const heroUrl = row.heroImageUrl ?? null
      pending.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        externalUrl: row.externalUrl,
        sourceUrl: row.sourceUrl,
        currentHeroImageUrl: heroUrl,
        currentHeroIsAiGenerated:
          typeof heroUrl === 'string' &&
          heroUrl.startsWith('/generated/listings/'),
        candidate: idx.candidate,
        fetchedAt: idx.fetchedAt,
        candidateImageUrl: `/api/admin/hero-candidate-image?id=${encodeURIComponent(row.id)}`,
      })
    }

    /**
     * Sort priority:
     *   1. Legacy `/generated/listings/...` AI heroes — the ones the user explicitly wants to
     *      replace.
     *   2. og:image candidates before screenshot fallbacks (better source of truth).
     *   3. Alphabetical by name within ties.
     */
    pending.sort((a, b) => {
      if (a.currentHeroIsAiGenerated !== b.currentHeroIsAiGenerated) {
        return a.currentHeroIsAiGenerated ? -1 : 1
      }
      const aOg = a.candidate.kind === 'og' ? 0 : 1
      const bOg = b.candidate.kind === 'og' ? 0 : 1
      if (aOg !== bOg) return aOg - bOg
      return a.name.localeCompare(b.name)
    })

    return {
      generatedAt,
      totalWithOgCandidate,
      totalWithScreenshotCandidate,
      totalReviewed: reviewedFile.reviews.length,
      totalApplied,
      totalDismissed,
      pending,
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
  .inputValidator(listingIdInput)
  .handler(async ({ data, context }): Promise<ApplyHeroCandidateResult> => {
    ensureLocalOnly()
    const { db, schema } = context

    const { rawEntries } = await readIndexFile()
    const idx = rawEntries.find((row) => row.id === data.listingId)
    if (!idx) {
      throw new Error(
        `No hero candidate index entry for listing ${data.listingId}. Populate out/hero-candidates/index.json first.`,
      )
    }
    if (!idx.candidate) {
      throw new Error(
        `Listing ${idx.name} has no captured og:image or screenshot to apply.`,
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
        `Candidate file missing on disk: ${sourcePath}. Regenerate hero candidates or restore out/hero-candidates/.`,
      )
    }

    /**
     * Upload the og:image as a fresh atproto blob (rather than just copying it to /public and
     * pointing the DB at a local path). Without this, Tap ingest re-syncs from atproto and
     * overwrites `heroImageUrl` back to whatever the record holds.
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

    await appendReview({
      id: data.listingId,
      action: 'applied',
      at: new Date().toISOString(),
      heroImageUrl,
    })

    return {
      ok: true,
      listingId: data.listingId,
      heroImageUrl,
      listingDetailUri: uri,
    }
  })

export interface RemoveHeroResult {
  ok: true
  listingId: string
  listingDetailUri: string
}

/**
 * Clears the hero image off a listing entirely: republishes the
 * `fyi.atstore.listing.detail` record without a `heroImage` blob, nulls `hero_image_url` in
 * Postgres, and marks the candidate `dismissed` so the queue skips past it. Use when no
 * candidate (og:image *or* screenshot) is good enough and we'd rather render the directory
 * fallback than ship a wrong/branded/AI hero.
 */
const removeHero = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(listingIdInput)
  .handler(async ({ data, context }): Promise<RemoveHeroResult> => {
    ensureLocalOnly()
    const { db, schema } = context

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
        `Listing ${liveRow.name} is not managed by the AtStore account; refusing to clear hero.`,
      )
    }

    const { uri } = await publishDirectoryListingDetail(liveRow, undefined, {
      clearHero: true,
    })

    await db
      .update(schema.storeListings)
      .set({ heroImageUrl: null, updatedAt: new Date() })
      .where(eq(schema.storeListings.id, data.listingId))

    await appendReview({
      id: data.listingId,
      action: 'dismissed',
      at: new Date().toISOString(),
    })

    return { ok: true, listingId: data.listingId, listingDetailUri: uri }
  })

export interface DismissHeroCandidateResult {
  ok: true
  listingId: string
}

const dismissHeroCandidate = createServerFn({ method: 'POST' })
  .middleware([adminFnMiddleware])
  .inputValidator(listingIdInput)
  .handler(async ({ data }): Promise<DismissHeroCandidateResult> => {
    ensureLocalOnly()
    await appendReview({
      id: data.listingId,
      action: 'dismissed',
      at: new Date().toISOString(),
    })
    return { ok: true, listingId: data.listingId }
  })

export interface RemoveOgCandidateResult {
  ok: true
  listingId: string
  removedFile: string | null
}

/**
 * Throws away the captured `og:image` for a listing: deletes the candidate file from
 * `out/hero-candidates/`, clears the entry's `candidate` field in `index.json`, and marks the
 * listing as `dismissed` so it leaves the review queue. Use when the og:image itself is junk
 * (default social share, wrong product, etc.) and you don't want it offered again on re-runs.
 */
const removeOgCandidate = createServerFn({ method: 'POST' })
  .middleware([adminFnMiddleware])
  .inputValidator(listingIdInput)
  .handler(async ({ data }): Promise<RemoveOgCandidateResult> => {
    ensureLocalOnly()

    const { generatedAt, rawEntries } = await readIndexFile()
    const entry = rawEntries.find((row) => row.id === data.listingId)
    let removedFile: string | null = null

    if (entry?.candidate) {
      const path = await import('node:path')
      const { unlink } = await import('node:fs/promises')
      const filePath = path.resolve(
        process.cwd(),
        CANDIDATES_DIR_RELATIVE,
        entry.candidate.filename,
      )
      try {
        await unlink(filePath)
        removedFile = entry.candidate.filename
      } catch (err) {
        /**
         * If the file's already gone, that's fine — the goal is "no candidate" and we can still
         * proceed to update the index. Anything else (perms, etc.) we surface so the user knows.
         */
        const code = (err as NodeJS.ErrnoException).code
        if (code !== 'ENOENT') {
          throw err
        }
      }

      const nextEntries = rawEntries.map((row) =>
        row.id === data.listingId ? { ...row, candidate: null } : row,
      )
      await writeIndexFile({ generatedAt, entries: nextEntries })
    }

    await appendReview({
      id: data.listingId,
      action: 'dismissed',
      at: new Date().toISOString(),
    })

    return { ok: true, listingId: data.listingId, removedFile }
  })

export interface UnreviewHeroCandidateResult {
  ok: true
  listingId: string
}

/** Pull a listing back into the queue (e.g. user clicked Skip by mistake). */
const unreviewHeroCandidate = createServerFn({ method: 'POST' })
  .middleware([adminFnMiddleware])
  .inputValidator(listingIdInput)
  .handler(async ({ data }): Promise<UnreviewHeroCandidateResult> => {
    ensureLocalOnly()
    await removeReview(data.listingId)
    return { ok: true, listingId: data.listingId }
  })

export const adminHeroCandidatesApi = {
  getHeroCandidates,
  getHeroCandidatesQueryOptions,
  applyHeroCandidate,
  dismissHeroCandidate,
  removeOgCandidate,
  removeHero,
  unreviewHeroCandidate,
}
