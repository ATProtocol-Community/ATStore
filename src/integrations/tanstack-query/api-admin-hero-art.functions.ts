import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '#/db/index.server'
import type * as DbSchema from '#/db/schema'
import {
  deriveEcosystemHeroArtContext,
  type EcosystemHeroArtPromptContext,
} from '#/lib/ecosystem-hero-art'
import {
  replaceGeneratedBannerRecordUrls,
  setGeneratedBannerRecordUrl,
} from '#/lib/generated-banner-record-urls'
import {
  buildHeroArtInventory,
  HERO_ART_KINDS,
  resolveHeroArtGenerationTarget,
  type HeroArtInventory,
  type HeroArtKind,
} from '#/lib/missing-hero-art'
import { adminFnMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

const generateHeroArtInput = z.object({
  kind: z.enum(HERO_ART_KINDS),
  id: z.string().min(1),
})

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview' as const

const getMissingHeroArt = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .handler(async ({ context }): Promise<HeroArtInventory> => {
    const { db, schema } = context
    const table = schema.storeListings

    const [rows] = await Promise.all([
      db
        .select({
          categorySlugs: table.categorySlugs,
          appTags: table.appTags,
        })
        .from(table)
        .where(eq(table.verificationStatus, 'verified')),
      refreshBannerRecordUrlsCache(db, schema),
    ])

    const categorySlugs = new Set<string>()
    const appTags = new Set<string>()
    const categorySlugsByListing: string[][] = []

    for (const row of rows) {
      const listingSlugs: string[] = []
      for (const slug of row.categorySlugs ?? []) {
        const trimmed = slug?.trim()
        if (!trimmed) continue
        categorySlugs.add(trimmed)
        listingSlugs.push(trimmed)
      }
      categorySlugsByListing.push(listingSlugs)

      for (const tag of row.appTags ?? []) {
        if (tag?.trim()) {
          appTags.add(tag)
        }
      }
    }

    return buildHeroArtInventory({
      categorySlugs: [...categorySlugs],
      appTags: [...appTags],
      categorySlugsByListing,
    })
  })

async function loadEcosystemHeroArtContext(
  db: Database,
  schema: typeof DbSchema,
  categoryId: string,
): Promise<EcosystemHeroArtPromptContext | undefined> {
  try {
    const rows = await db
      .select({
        name: schema.storeListings.name,
        tagline: schema.storeListings.tagline,
        fullDescription: schema.storeListings.fullDescription,
        categorySlugs: schema.storeListings.categorySlugs,
        appTags: schema.storeListings.appTags,
      })
      .from(schema.storeListings)
      .where(eq(schema.storeListings.verificationStatus, 'verified'))

    return deriveEcosystemHeroArtContext(categoryId, rows) ?? undefined
  } catch (error) {
    console.warn(
      `Couldn't load ecosystem hero context for "${categoryId}"; falling back to static prompt.`,
      error,
    )
    return undefined
  }
}

async function refreshBannerRecordUrlsCache(
  db: Database,
  schema: typeof DbSchema,
) {
  const rows = await db
    .select({
      assetPath: schema.generatedBannerRecordUrls.assetPath,
      mappedUrl: schema.generatedBannerRecordUrls.mappedUrl,
    })
    .from(schema.generatedBannerRecordUrls)

  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.assetPath] = row.mappedUrl
  }
  replaceGeneratedBannerRecordUrls(map)
}

const getMissingHeroArtQueryOptions = queryOptions({
  queryKey: ['admin', 'hero-art'],
  queryFn: async () => getMissingHeroArt(),
})

export interface GenerateHeroArtResult {
  kind: HeroArtKind
  id: string
  label: string
  assetPath: string
  /** Final imgproxy URL if S3/imgproxy configured. */
  mappedUrl: string | null
  /** Inline base64 of the freshly generated image so the UI can preview immediately. */
  previewDataUrl: string
  /** True when the banner map was persisted (dev) so the image goes live. */
  persistedBannerMap: boolean
  persistedWarnings: string[]
}

const generateMissingHeroArtItem = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, adminFnMiddleware])
  .inputValidator(generateHeroArtInput)
  .handler(async ({ data, context }): Promise<GenerateHeroArtResult> => {
    const { db, schema } = context

    const ecosystemContext =
      data.kind === 'ecosystem'
        ? await loadEcosystemHeroArtContext(db, schema, data.id)
        : undefined

    const target = resolveHeroArtGenerationTarget(data.kind, data.id, {
      ecosystemContext,
    })

    const { buffer, mimeType } = await generateImageWithGemini(target.prompt)

    const [uploadResult, fileWrite] = await Promise.all([
      uploadHeroArtToStorage({
        assetPath: target.assetPath,
        bytes: buffer,
        mimeType,
      }),
      writeHeroArtLocally({
        assetPath: target.assetPath,
        bytes: buffer,
      }),
    ])

    const { mappedUrl, persistedWarnings } = uploadResult

    const persistedMap = mappedUrl
      ? await upsertGeneratedBannerRecordUrlRow(db, schema, target.assetPath, mappedUrl)
      : { persisted: false, warning: 'Skipped writing banner map — no mapped URL.' }

    const warnings = [...persistedWarnings]
    if (!fileWrite.persisted && fileWrite.warning) {
      warnings.push(fileWrite.warning)
    }
    if (!persistedMap.persisted && persistedMap.warning) {
      warnings.push(persistedMap.warning)
    }

    return {
      kind: data.kind,
      id: data.id,
      label: target.label,
      assetPath: target.assetPath,
      mappedUrl,
      previewDataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      persistedBannerMap: persistedMap.persisted,
      persistedWarnings: warnings,
    }
  })

async function upsertGeneratedBannerRecordUrlRow(
  db: Database,
  schema: typeof DbSchema,
  assetPath: string,
  mappedUrl: string,
): Promise<{ persisted: boolean; warning?: string }> {
  try {
    await db
      .insert(schema.generatedBannerRecordUrls)
      .values({ assetPath, mappedUrl })
      .onConflictDoUpdate({
        target: schema.generatedBannerRecordUrls.assetPath,
        set: { mappedUrl, updatedAt: sql`now()` },
      })
    setGeneratedBannerRecordUrl(assetPath, mappedUrl)
    return { persisted: true }
  } catch (error) {
    return {
      persisted: false,
      warning: `Couldn't write generated_banner_record_urls row (${
        error instanceof Error ? error.message : String(error)
      }).`,
    }
  }
}

export const adminHeroArtApi = {
  getMissingHeroArt,
  getMissingHeroArtQueryOptions,
  generateMissingHeroArtItem,
}

async function generateImageWithGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
  if (!apiKey) {
    throw new Error(
      'Missing GEMINI_API_KEY (or GOOGLE_API_KEY) on the server. Set it to generate hero art.',
    )
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini image request failed: ${await response.text()}`)
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string }
        }>
      }
    }>
  }

  const imagePart = json.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData

  if (!imagePart?.data) {
    throw new Error(`No image data returned by Gemini: ${JSON.stringify(json)}`)
  }

  return {
    buffer: Buffer.from(imagePart.data, 'base64'),
    mimeType: imagePart.mimeType ?? 'image/png',
  }
}

function extensionForImgproxy(pathname: string): string {
  const lower = pathname.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpeg'
  if (lower.endsWith('.webp')) return 'webp'
  if (lower.endsWith('.gif')) return 'gif'
  return 'png'
}

function normalizeBucketPrefix(prefix: string | undefined): string {
  if (!prefix) return ''
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `${trimmed}/` : ''
}

async function uploadHeroArtToStorage(input: {
  assetPath: string
  bytes: Buffer
  mimeType: string
}): Promise<{ mappedUrl: string | null; persistedWarnings: string[] }> {
  const endpoint = process.env.AWS_ENDPOINT?.trim()
  const region = process.env.AWS_REGION?.trim()
  const bucket = process.env.AWS_BUCKET_NAME?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  const imgproxyBase = process.env.IMGPROXY_URL?.trim().replace(/\/+$/, '') ?? ''

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return {
      mappedUrl: null,
      persistedWarnings: [
        'Skipped S3 upload — AWS env vars not configured on the server.',
      ],
    }
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const keyPrefix = normalizeBucketPrefix(process.env.AWS_BUCKET_PREFIX)
  const publicPath = input.assetPath.startsWith('/')
    ? input.assetPath
    : `/${input.assetPath}`
  const key = `${keyPrefix}${publicPath.replace(/^\//, '')}`

  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(input.bytes),
      ContentType: input.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  if (!imgproxyBase) {
    return {
      mappedUrl: null,
      persistedWarnings: [
        'Uploaded to S3 but IMGPROXY_URL is not configured; banner map not updated.',
      ],
    }
  }

  const mappedUrl = `${imgproxyBase}/insecure/plain/s3://${bucket}/${key}@${extensionForImgproxy(
    publicPath,
  )}`

  return { mappedUrl, persistedWarnings: [] }
}

async function writeHeroArtLocally(input: {
  assetPath: string
  bytes: Buffer
}): Promise<{ persisted: boolean; warning?: string }> {
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const path = await import('node:path')
    const target = path.resolve(
      process.cwd(),
      `public${input.assetPath.startsWith('/') ? '' : '/'}${input.assetPath}`,
    )
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, new Uint8Array(input.bytes))
    return { persisted: true }
  } catch (error) {
    return {
      persisted: false,
      warning: `Couldn't write public asset to disk (${
        error instanceof Error ? error.message : String(error)
      }).`,
    }
  }
}

