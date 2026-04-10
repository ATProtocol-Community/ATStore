#!/usr/bin/env node
import "dotenv/config";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { directoryListings } from "../src/db/schema";
import { db, dbClient } from "../src/db/index.server";
import { getDirectoryCategoryOption } from "../src/lib/directory-categories";
import {
  getProtocolCategoryCoverArtPrompt,
  getProtocolCategoryCoverArtSpecForSegment,
  PROTOCOL_CATEGORY_COVER_SPECS,
  type ProtocolCategoryCoverArtSpec,
} from "../src/lib/protocol-category-hero-art";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "public/generated/protocol-categories",
);

type ScriptArgs = {
  dryRun: boolean;
  force: boolean;
  help: boolean;
  limit: number | null;
  segment: string | null;
};

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    help: false,
    limit: null,
    segment: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      out.force = true;
      continue;
    }

    if (arg === "--limit" || arg === "-l") {
      const raw = argv[++i];
      const value = Number.parseInt(raw ?? "", 10);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --limit value "${raw ?? ""}"`);
      }

      out.limit = value;
      continue;
    }

    if (arg === "--segment") {
      out.segment = argv[++i] ?? null;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`
Usage: npm run generate:protocol-category-covers -- [options]

Generates cover images for protocol category cards (home + protocol browse).
Files are written under public/generated/protocol-categories/<segment>.png

Options:
      --dry-run          Print prompts without calling Gemini or writing files
      --force            Regenerate even if the target file already exists
  -l, --limit <n>        Process at most n assets
      --segment <slug>   Generate a single asset (e.g. pds, appview)
  -h, --help             Show help

Requires GEMINI_API_KEY or GOOGLE_API_KEY.
`);
}

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_API_KEY is required. Set it in your environment variables.",
    );
  }

  return key;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  return ".png";
}

async function generateImage(prompt: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": getGeminiApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini image request failed: ${await response.text()}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: {
            data?: string;
            mimeType?: string;
          };
        }>;
      };
    }>;
  };

  const imagePart = json.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData;

  if (!imagePart?.data) {
    throw new Error(`No image data returned by Gemini: ${JSON.stringify(json)}`);
  }

  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType ?? "image/png",
  };
}

async function getSpecsFromDatabase(): Promise<ProtocolCategoryCoverArtSpec[]> {
  const rows = await db
    .select({ categorySlugs: directoryListings.categorySlugs })
    .from(directoryListings);

  const segments = new Set<string>();

  for (const row of rows) {
    for (const slug of row.categorySlugs ?? []) {
      if (!slug?.startsWith("protocol/")) {
        continue;
      }
      const parts = slug.split("/").filter(Boolean);
      if (parts.length !== 2 || parts[0] !== "protocol") {
        continue;
      }
      segments.add(parts[1]!);
    }
  }

  for (const spec of PROTOCOL_CATEGORY_COVER_SPECS) {
    segments.add(spec.segment);
  }

  const specs: ProtocolCategoryCoverArtSpec[] = [];

  for (const segment of [...segments].sort((a, b) => a.localeCompare(b))) {
    const option = getDirectoryCategoryOption(`protocol/${segment}`);
    const label = option?.label ?? segment;
    specs.push(getProtocolCategoryCoverArtSpecForSegment(segment, label));
  }

  return specs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  let specs = await getSpecsFromDatabase();

  if (args.segment) {
    const option = getDirectoryCategoryOption(`protocol/${args.segment}`);
    const label = option?.label ?? args.segment;
    specs = [getProtocolCategoryCoverArtSpecForSegment(args.segment, label)];
  }

  specs = specs.slice(0, args.limit ?? Number.POSITIVE_INFINITY);

  if (specs.length === 0) {
    console.log("No protocol category cover assets to generate.");
    return;
  }

  for (const spec of specs) {
    const targetPath = path.resolve(process.cwd(), `public${spec.assetPath}`);
    const prompt = getProtocolCategoryCoverArtPrompt(spec);

    if (args.dryRun) {
      console.log(`\n[Dry run] ${spec.segment} -> ${targetPath}\n${prompt}\n`);
      continue;
    }

    if (!args.force && (await fileExists(targetPath))) {
      console.log(
        `Skipping ${spec.label} (${spec.segment}) because it already exists.`,
      );
      continue;
    }

    console.log(`Generating ${spec.label} (${spec.segment})...`);
    const { buffer, mimeType } = await generateImage(prompt);

    if (getExtensionFromMimeType(mimeType) !== ".png") {
      console.warn(
        `Gemini returned ${mimeType} for ${spec.segment}; saving to the configured .png asset path.`,
      );
    }

    await writeFile(targetPath, buffer);
    console.log(`Saved ${spec.segment} -> ${targetPath}`);
  }
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 });
  });
