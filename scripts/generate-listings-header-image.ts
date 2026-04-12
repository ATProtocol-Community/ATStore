#!/usr/bin/env node
import "dotenv/config"

import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { desc, isNotNull } from "drizzle-orm"
import sharp from "sharp"

import { db, dbClient } from "../src/db/index.server"
import { storeListings } from "../src/db/schema"
import { resolveBannerRecordUrl } from "../src/lib/banner-record-url"
import { geminiFlashGenerateImageFromPromptAndImage } from "../src/lib/gemini-flash-image-gen"

type ScriptArgs = {
  dryRun: boolean
  force: boolean
  help: boolean
  outPath: string
  referenceOutPath: string
}

type ListingIconRow = {
  id: string
  slug: string
  name: string
  iconUrl: string | null
}

const DEFAULT_OUT_PATH = path.resolve(
  process.cwd(),
  "public/generated/listings-headers/listings-header.png",
)
const DEFAULT_REFERENCE_OUT_PATH = path.resolve(
  process.cwd(),
  "out/generated-listings-headers/listings-icon-board.png",
)

const ICON_BOARD_WIDTH = 1600
const ICON_BOARD_HEIGHT = 900
const ICON_TILE_SIZE = 136
const ICON_PADDING = 16
const ICON_GAP = 20
const ICON_BOARD_MARGIN = 44
const ICON_FETCH_TIMEOUT_MS = 15_000
const MIN_REQUIRED_ICONS = 8

/**
 * Update this list to control exactly which listing icons are rendered in the
 * generated header reference board (in this exact order).
 */
const HEADER_LISTING_SLUGS: string[] = [
  "at-fund",
"kich",
"openmeet",
"bridgy-fed",
"leaflet",
"bluesky",
"you-and-me","winesky","wisp-place","woosh","tangled","stream-place","spark","skylight","semble","grain","germ-network","margin","keytrace","goals-garden","flushes","colibri","blento","pckt-blog","offprint","beacon-bits",'aether-os',"sill",'sifa','rocksky','rpg-actor','puzzmo','plyr-fm'
]

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    help: false,
    outPath: DEFAULT_OUT_PATH,
    referenceOutPath: DEFAULT_REFERENCE_OUT_PATH,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--") continue
    if (arg === "--help" || arg === "-h") {
      out.help = true
      continue
    }
    if (arg === "--dry-run") {
      out.dryRun = true
      continue
    }
    if (arg === "--force") {
      out.force = true
      continue
    }
    if (arg === "--out" || arg === "-o") {
      const value = argv[++i]
      if (!value) {
        throw new Error("Missing value for --out")
      }
      out.outPath = path.resolve(process.cwd(), value)
      continue
    }
    if (arg === "--reference-out") {
      const value = argv[++i]
      if (!value) {
        throw new Error("Missing value for --reference-out")
      }
      out.referenceOutPath = path.resolve(process.cwd(), value)
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return out
}

function printHelp() {
  console.log(`
Usage: npm run generate:listings-header-image -- [options]

Options:
      --dry-run           Build and save icon reference board only (no Gemini call)
      --force             Regenerate even if target output already exists
  -o, --out <path>        Header output path (default: public/generated/listings-headers/listings-header.png)
      --reference-out <path> Icon-board output path (default: out/generated-listings-headers/listings-icon-board.png)
  -h, --help              Show help

Icon selection:
  Edit HEADER_LISTING_SLUGS in this script to choose exactly which apps appear.
`)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function buildHeaderPrompt(iconNames: string[]): string {
  const sampledNames = iconNames.slice(0, 16).join(", ")

  return [
    'Create a premium App Store-style wide header illustration for the "at-store" app directory.',
    "Use the provided icon-board image as hard visual reference for shape language, mark motifs, and palette accents from real listing app icons.",
    "Theme: vibrant software marketplace energy with floating rounded app-icon cards, layered glass surfaces, soft gradients, and connection trails.",
    "Style: polished editorial 3D, colorful but clean, luminous highlights, subtle depth, playful and modern.",
    "Composition: wide 16:9 header with calmer negative space on the left and richer icon-driven detail on the right.",
    "Integrate many icon-derived motifs from the reference board so the output clearly feels tied to real listings, but keep overall composition cohesive and non-cluttered.",
    "Do not copy any single icon as the dominant center mark; blend multiple icon influences into the scene.",
    "No readable words, no standalone typography, no watermarks, no browser chrome, no device mockups, no people.",
    "do not repeat the same icon in the composition",
    sampledNames ? `Sample listing names represented in the icon board: ${sampledNames}.` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ")
}

async function fetchListingIcons(): Promise<ListingIconRow[]> {
  const rows = await db
    .select({
      id: storeListings.id,
      slug: storeListings.slug,
      name: storeListings.name,
      iconUrl: storeListings.iconUrl,
    })
    .from(storeListings)
    .where(isNotNull(storeListings.iconUrl))
    .orderBy(desc(storeListings.updatedAt), desc(storeListings.createdAt))

  return rows
    .filter((row) => Boolean(row.iconUrl?.trim()))
}

function pickRowsByConfiguredSlugs(rows: ListingIconRow[]): ListingIconRow[] {
  if (HEADER_LISTING_SLUGS.length === 0) {
    throw new Error(
      "HEADER_LISTING_SLUGS is empty. Add listing slugs to the array in this script.",
    )
  }

  const rowBySlug = new Map(rows.map((row) => [row.slug, row]))
  const selected: ListingIconRow[] = []
  const missingSlugs: string[] = []

  for (const slug of HEADER_LISTING_SLUGS) {
    const match = rowBySlug.get(slug)
    if (!match) {
      missingSlugs.push(slug)
      continue
    }
    selected.push(match)
  }

  if (missingSlugs.length > 0) {
    console.warn(
      `Missing or iconless slugs: ${missingSlugs.join(", ")} (they will be skipped).`,
    )
  }

  return selected
}

async function readIconSource(iconUrl: string): Promise<Buffer | null> {
  const trimmed = iconUrl.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith("/")) {
    const filePath = path.resolve(process.cwd(), "public", trimmed.replace(/^\//, ""))
    try {
      return await readFile(filePath)
    } catch {
      const resolved = resolveBannerRecordUrl(trimmed)
      if (!resolved) {
        return null
      }
      return fetchImageBuffer(resolved)
    }
  }

  return fetchImageBuffer(trimmed)
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) {
      return null
    }

    const bytes = await response.arrayBuffer()
    return Buffer.from(bytes)
  } catch {
    return null
  }
}

async function normalizeIcon(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input)
      .resize(ICON_TILE_SIZE - ICON_PADDING * 2, ICON_TILE_SIZE - ICON_PADDING * 2, {
        fit: "contain",
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

async function buildIconTile(iconPng: Buffer): Promise<Buffer> {
  const tile = sharp({
    create: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.12 },
    },
  })

  return tile
    .composite([
      {
        input: iconPng,
        left: ICON_PADDING,
        top: ICON_PADDING,
      },
    ])
    .png()
    .toBuffer()
}

function getTilePositions(tileCount: number): Array<{ left: number; top: number }> {
  const columns = Math.max(
    1,
    Math.floor((ICON_BOARD_WIDTH - ICON_BOARD_MARGIN * 2 + ICON_GAP) / (ICON_TILE_SIZE + ICON_GAP)),
  )

  const positions: Array<{ left: number; top: number }> = []

  for (let i = 0; i < tileCount; i++) {
    const col = i % columns
    const row = Math.floor(i / columns)
    const left = ICON_BOARD_MARGIN + col * (ICON_TILE_SIZE + ICON_GAP)
    const top = ICON_BOARD_MARGIN + row * (ICON_TILE_SIZE + ICON_GAP)

    if (top + ICON_TILE_SIZE > ICON_BOARD_HEIGHT - ICON_BOARD_MARGIN) {
      break
    }

    positions.push({ left, top })
  }

  return positions
}

async function buildIconBoard(inputIcons: Buffer[]): Promise<Buffer> {
  const normalizedIcons: Buffer[] = []
  for (const iconBuffer of inputIcons) {
    const normalized = await normalizeIcon(iconBuffer)
    if (normalized) {
      normalizedIcons.push(normalized)
    }
  }

  if (normalizedIcons.length === 0) {
    throw new Error("No valid icon images were decoded from listings.")
  }

  const tileBuffers: Buffer[] = []
  for (const icon of normalizedIcons) {
    tileBuffers.push(await buildIconTile(icon))
  }

  const positions = getTilePositions(tileBuffers.length)

  const base = sharp({
    create: {
      width: ICON_BOARD_WIDTH,
      height: ICON_BOARD_HEIGHT,
      channels: 4,
      background: { r: 19, g: 28, b: 48, alpha: 1 },
    },
  })

  const composites = positions.map((pos, index) => ({
    input: tileBuffers[index]!,
    left: pos.left,
    top: pos.top,
  }))

  return base.composite(composites).png().toBuffer()
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  if (!args.force && (await fileExists(args.outPath)) && !args.dryRun) {
    console.log(`Skipping header generation: file already exists at ${args.outPath}`)
    console.log("Re-run with --force to overwrite.")
    return
  }

  const iconRows = await fetchListingIcons()
  if (iconRows.length === 0) {
    throw new Error("No listings with iconUrl were found.")
  }

  const configuredRows = pickRowsByConfiguredSlugs(iconRows)
  if (configuredRows.length === 0) {
    throw new Error("No configured slugs could be resolved to listings with iconUrl.")
  }

  const sampledRows: ListingIconRow[] = []
  const iconBuffers: Buffer[] = []

  for (const row of configuredRows) {
    if (!row.iconUrl) continue
    const bytes = await readIconSource(row.iconUrl)
    if (!bytes) continue

    sampledRows.push(row)
    iconBuffers.push(bytes)

  }

  if (iconBuffers.length < MIN_REQUIRED_ICONS) {
    throw new Error(
      `Only ${iconBuffers.length} icon(s) could be loaded. Need at least ${MIN_REQUIRED_ICONS} to generate a good header.`,
    )
  }

  const iconBoard = await buildIconBoard(iconBuffers)
  await mkdir(path.dirname(args.referenceOutPath), { recursive: true })
  await writeFile(args.referenceOutPath, iconBoard)
  console.log(
    `Saved icon reference board (${iconBuffers.length} icons) -> ${args.referenceOutPath}`,
  )

  const prompt = buildHeaderPrompt(sampledRows.map((row) => row.name))
  if (args.dryRun) {
    console.log("\n[Dry run prompt]\n")
    console.log(prompt)
    return
  }

  await mkdir(path.dirname(args.outPath), { recursive: true })
  const generated = await geminiFlashGenerateImageFromPromptAndImage({
    prompt,
    imageBytes: iconBoard,
    imageMimeType: "image/png",
  })

  if (generated.mimeType !== "image/png") {
    console.warn(
      `Gemini returned ${generated.mimeType}; writing bytes to ${args.outPath} as-is.`,
    )
  }

  await writeFile(args.outPath, generated.buffer)
  console.log(`Saved listings header image -> ${args.outPath}`)
}

await main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
