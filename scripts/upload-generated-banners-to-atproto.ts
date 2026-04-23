#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { EXT_TO_MIME, mimeFromPath } from '../src/lib/atproto/resolve-image-bytes.shared'
import * as schema from '../src/db/schema'

const PROJECT_ROOT = process.cwd()
const GENERATED_ROOT = path.resolve(PROJECT_ROOT, 'public/generated')
const BANNER_DIRS = [
  'app-tag-heroes',
  'category-bento',
  'ecosystem-heroes',
  'home-page-heroes',
  'protocol-categories',
  'protocol-page-heroes',
] as const

type Args = {
  dryRun: boolean
  includeBrand: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    includeBrand: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg === '--include-brand') {
      args.includeBrand = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown arg: ${arg}`)
  }

  return args
}

function printHelp() {
  console.log(`
Usage: pnpm upload:generated-banners [--dry-run] [--include-brand]

Uploads banner files from public/generated/* to the AT Store S3 bucket,
then upserts the asset → URL mapping into the generated_banner_record_urls
table. The runtime loads this table at SSR and hydrates it to the client
via an inline script, so no local file needs to be committed.

Options:
  --dry-run        Show files that would be uploaded
  --include-brand  Also upload public/generated/brand/* images
`)
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(absolute)))
      continue
    }
    if (entry.isFile()) {
      out.push(absolute)
    }
  }
  return out
}

function toPublicAssetPath(absolutePath: string): string {
  const relFromPublic = path.relative(path.resolve(PROJECT_ROOT, 'public'), absolutePath)
  return `/${relFromPublic.split(path.sep).join('/')}`
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) return ''
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `${trimmed}/` : ''
}

function extensionForImgproxy(pathname: string): string {
  const ext = path.extname(pathname).toLowerCase().replace('.', '')
  if (ext === 'jpg') return 'jpeg'
  if (ext) return ext
  return 'png'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const targetDirs = args.includeBrand
    ? [...BANNER_DIRS, 'brand']
    : [...BANNER_DIRS]

  const files = (
    await Promise.all(
      targetDirs.map(async (relativeDir) => {
        const absoluteDir = path.join(GENERATED_ROOT, relativeDir)
        try {
          return await walkFiles(absoluteDir)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return []
          }
          throw error
        }
      }),
    )
  )
    .flat()
    .filter((filePath) => {
      const lower = filePath.toLowerCase()
      return Object.keys(EXT_TO_MIME).some((ext) => lower.endsWith(ext))
    })
    .sort((left, right) => left.localeCompare(right))

  if (files.length === 0) {
    throw new Error('No banner image files found under public/generated.')
  }

  if (args.dryRun) {
    console.log(`Found ${files.length} banner files:`)
    for (const filePath of files) {
      console.log(`- ${toPublicAssetPath(filePath)}`)
    }
    return
  }

  const databaseUrl = requiredEnv('DATABASE_URL')
  const endpoint = requiredEnv('AWS_ENDPOINT')
  const region = requiredEnv('AWS_REGION')
  const bucket = requiredEnv('AWS_BUCKET_NAME')
  const accessKeyId = requiredEnv('AWS_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnv('AWS_SECRET_ACCESS_KEY')
  const imgproxyBase = process.env.IMGPROXY_URL?.trim().replace(/\/+$/, '') ?? ''
  const keyPrefix = normalizePrefix(process.env.AWS_BUCKET_PREFIX)

  const s3 = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  const sqlClient = postgres(databaseUrl, { max: 1, prepare: false })
  const db = drizzle(sqlClient, { schema })

  try {
    const uploadedMap: Record<string, string> = {}

    for (const filePath of files) {
      const publicPath = toPublicAssetPath(filePath)
      const key = `${keyPrefix}${publicPath.replace(/^\//, '')}`
      const bytes = new Uint8Array(await readFile(filePath))
      const mimeType = mimeFromPath(filePath)
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Unsupported image mime for ${publicPath}: ${mimeType}`)
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )

      const mappedUrl = imgproxyBase
        ? `${imgproxyBase}/insecure/plain/s3://${bucket}/${key}@${extensionForImgproxy(
            publicPath,
          )}`
        : publicPath
      uploadedMap[publicPath] = mappedUrl
      console.log(`Uploaded s3://${bucket}/${key}`)
    }

    if (!imgproxyBase) {
      console.warn(
        '\nIMGPROXY_URL not set — skipping generated_banner_record_urls writes.',
      )
    } else {
      let upsertedCount = 0
      for (const [assetPath, mappedUrl] of Object.entries(uploadedMap)) {
        await db
          .insert(schema.generatedBannerRecordUrls)
          .values({ assetPath, mappedUrl })
          .onConflictDoUpdate({
            target: schema.generatedBannerRecordUrls.assetPath,
            set: { mappedUrl, updatedAt: sql`now()` },
          })
        upsertedCount += 1
      }
      console.log(
        `\nUpserted ${upsertedCount} row(s) into generated_banner_record_urls.`,
      )
    }

    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${keyPrefix}generated/`,
        MaxKeys: 5,
      }),
    )
    console.log(
      `\nBucket check: found ${listed.KeyCount ?? 0} objects under ${keyPrefix}generated/ (showing up to 5):`,
    )
    for (const object of listed.Contents ?? []) {
      if (object.Key) {
        console.log(`- ${object.Key}`)
      }
    }
  } finally {
    await sqlClient.end({ timeout: 5 })
  }
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
