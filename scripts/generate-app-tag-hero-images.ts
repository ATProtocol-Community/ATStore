#!/usr/bin/env node
import "dotenv/config";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  getAppTagHeroArtSpec,
  getAppTagHeroArtPrompt,
  getAppTagHeroArtSpecForTag,
} from "../src/lib/app-tag-hero-art";
import { db, dbClient } from "../src/db/index.server";
import { storeListings } from "../src/db/schema";
import { sql } from "drizzle-orm";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const OUTPUT_DIR = path.resolve(process.cwd(), "public/generated/app-tag-heroes");
const STATIC_APP_TAG_HERO_SLUGS = ["all", "all-apps"] as const;

type ScriptArgs = {
  dryRun: boolean;
  force: boolean;
  help: boolean;
  limit: number | null;
  slug: string | null;
};

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    help: false,
    limit: null,
    slug: null,
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

    if (arg === "--slug") {
      out.slug = argv[++i] ?? null;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`
Usage: npm run generate:app-tag-hero-images -- [options]

Options:
      --dry-run       Print prompts without calling Gemini or writing files
      --force         Regenerate even if the target file already exists
  -l, --limit <n>     Process at most n assets
      --slug <slug>   Generate a single asset by slug (example: analytics, all)
  -h, --help          Show help
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

function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) return "";
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

type S3LookupContext = {
  client: S3Client;
  bucket: string;
  keyPrefix: string;
};

function getS3LookupContext(): S3LookupContext | null {
  const endpoint = process.env.AWS_ENDPOINT?.trim();
  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_BUCKET_NAME?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
    bucket,
    keyPrefix: normalizePrefix(process.env.AWS_BUCKET_PREFIX),
  };
}

async function s3ObjectExists(
  context: S3LookupContext,
  key: string,
): Promise<boolean> {
  try {
    await context.client.send(
      new HeadObjectCommand({
        Bucket: context.bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    const name = (error as { name?: string }).name;

    if (statusCode === 404 || name === "NotFound" || name === "NoSuchKey") {
      return false;
    }

    throw error;
  }
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

async function getSpecsFromDatabase() {
  const rows = await db
    .select({
      tag: sql<string>`unnest(${storeListings.appTags})`,
    })
    .from(storeListings);

  const distinctTags = [...new Set(rows.map((row) => row.tag).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

  const specs = new Map<string, ReturnType<typeof getAppTagHeroArtSpec>>();

  for (const slug of STATIC_APP_TAG_HERO_SLUGS) {
    specs.set(slug, getAppTagHeroArtSpec(slug));
  }

  for (const tag of distinctTags) {
    const spec = getAppTagHeroArtSpecForTag(tag);
    specs.set(spec.slug, spec);
  }

  return [...specs.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const s3Lookup = getS3LookupContext();

  if (s3Lookup) {
    console.log("S3 lookup enabled for existing asset checks.");
  } else {
    console.warn(
      "S3 lookup disabled (missing AWS env vars); falling back to local file checks only.",
    );
  }

  const allSpecs = await getSpecsFromDatabase();
  const specs = allSpecs.filter((spec) =>
    args.slug ? spec.slug === args.slug : true,
  ).slice(0, args.limit ?? Number.POSITIVE_INFINITY);

  if (specs.length === 0) {
    console.log("No matching app-tag hero assets to generate.");
    return;
  }

  for (const spec of specs) {
    const targetPath = path.resolve(process.cwd(), `public${spec.assetPath}`);
    const prompt = getAppTagHeroArtPrompt(spec);
    const objectKey = `${s3Lookup?.keyPrefix ?? ""}${spec.assetPath.replace(/^\//, "")}`;

    if (!args.force && s3Lookup && (await s3ObjectExists(s3Lookup, objectKey))) {
      console.log(
        `Skipping ${spec.label} (${spec.slug}) because it already exists in s3://${s3Lookup.bucket}/${objectKey}.`,
      );
      continue;
    }

    if (!args.force && (await fileExists(targetPath))) {
      console.log(`Skipping ${spec.label} (${spec.slug}) because it already exists locally.`);
      continue;
    }

    if (args.dryRun) {
      console.log(`\n[Dry run] ${spec.slug} -> ${targetPath}\n${prompt}\n`);
      continue;
    }

    console.log(`Generating ${spec.label} (${spec.slug})...`);
    const { buffer, mimeType } = await generateImage(prompt);

    if (getExtensionFromMimeType(mimeType) !== ".png") {
      console.warn(
        `Gemini returned ${mimeType} for ${spec.slug}; saving to the configured .png asset path.`,
      );
    }

    await writeFile(targetPath, buffer);
    console.log(`Saved ${spec.slug} -> ${targetPath}`);
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
