#!/usr/bin/env node
import "dotenv/config";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PROTOCOL_PAGE_HERO_ART_SPECS,
  getProtocolPageHeroArtPrompt,
} from "../src/lib/protocol-page-hero-art";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "public/generated/protocol-page-heroes",
);

type ScriptArgs = {
  dryRun: boolean;
  force: boolean;
  help: boolean;
  heroId: string | null;
  limit: number | null;
};

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    help: false,
    heroId: null,
    limit: null,
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

    if (arg === "--hero-id") {
      out.heroId = argv[++i] ?? null;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`
Usage: npm run generate:protocol-page-hero-images -- [options]

Options:
      --dry-run          Print prompts without calling Gemini or writing files
      --force            Regenerate even if the target file already exists
  -l, --limit <n>        Process at most n assets
      --hero-id <id>     Generate a single asset by hero id
  -h, --help             Show help
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const specs = PROTOCOL_PAGE_HERO_ART_SPECS.filter((spec) =>
    args.heroId ? spec.heroId === args.heroId : true,
  ).slice(0, args.limit ?? Number.POSITIVE_INFINITY);

  if (specs.length === 0) {
    console.log("No matching protocol page hero assets to generate.");
    return;
  }

  for (const spec of specs) {
    const targetPath = path.resolve(process.cwd(), `public${spec.assetPath}`);
    const prompt = getProtocolPageHeroArtPrompt(spec);

    if (args.dryRun) {
      console.log(`\n[Dry run] ${spec.heroId} -> ${targetPath}\n${prompt}\n`);
      continue;
    }

    if (!args.force && (await fileExists(targetPath))) {
      console.log(`Skipping ${spec.label} (${spec.heroId}) because it already exists.`);
      continue;
    }

    console.log(`Generating ${spec.label} (${spec.heroId})...`);
    const { buffer, mimeType } = await generateImage(prompt);

    if (getExtensionFromMimeType(mimeType) !== ".png") {
      console.warn(
        `Gemini returned ${mimeType} for ${spec.heroId}; saving to the configured .png asset path.`,
      );
    }

    await writeFile(targetPath, buffer);
    console.log(`Saved ${spec.heroId} -> ${targetPath}`);
  }
}

await main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
