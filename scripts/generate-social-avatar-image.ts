#!/usr/bin/env node
import "dotenv/config";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  "public/generated/social-avatars/at-store-avatar.png",
);

type ScriptArgs = {
  dryRun: boolean;
  force: boolean;
  help: boolean;
  outPath: string;
};

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    dryRun: false,
    force: false,
    help: false,
    outPath: DEFAULT_OUTPUT_PATH,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--") continue;
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
    if (arg === "--out" || arg === "-o") {
      const value = argv[++i];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      out.outPath = path.resolve(process.cwd(), value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function printHelp() {
  console.log(`
Usage: npm run generate:social-avatar -- [options]

Options:
      --dry-run         Print prompt without calling Gemini
      --force           Regenerate even if the target file already exists
  -o, --out <path>      Output path (default: public/generated/social-avatars/at-store-avatar.png)
  -h, --help            Show help
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

function buildSocialAvatarPrompt() {
  return [
    'Create a premium App Store-style social media avatar for the "at-store" brand.',
    "Theme: abstract app marketplace ecosystem with floating rounded app cards, protocol-inspired nodes.",
    "Palette: pastel blue, pastel cyan, bright white highlights",
    "Style: polished editorial 3D gradients, translucent glass layers, luminous highlights, subtle depth, playful but refined energy.",
    "Composition: square 1:1 image with centered focal energy and balanced geometry that reads clearly at very small sizes. Fill the square with the image.",
    "Image must be kept simple because will be displayed at 80px square.",
    "Avoid edge clutter; keep key forms inside a safe central area so circular profile crops still look strong. DO NOT INCLUDE ANY CIRCULAR CROP OR BORDER.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render letters, words, numbers, logos, glyphs, symbols, badges, UI chrome, brand marks, signatures, or watermarks.",
    "No people, no device mockups, and no realistic screenshots.",
    "Only render at max 3 shapes",
    "The only text allowed is 'AT' on the surface of a shape. AT should be rather large"
  ].join(" ");
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const prompt = buildSocialAvatarPrompt();

  if (args.dryRun) {
    console.log(prompt);
    return;
  }

  if (!args.force && (await fileExists(args.outPath))) {
    console.log(`Skipping avatar generation: file already exists at ${args.outPath}`);
    console.log("Re-run with --force to overwrite.");
    return;
  }

  await mkdir(path.dirname(args.outPath), { recursive: true });
  const { buffer, mimeType } = await generateImage(prompt);

  if (mimeType !== "image/png") {
    console.warn(`Gemini returned ${mimeType}; writing bytes to ${args.outPath} as-is.`);
  }

  await writeFile(args.outPath, buffer);
  console.log(`Saved social avatar -> ${args.outPath}`);
}

await main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
