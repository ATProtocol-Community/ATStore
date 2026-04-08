import "dotenv/config";

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CATEGORY_BENTO_ART_SPECS,
  getCategoryBentoArtPrompt,
} from "../src/lib/category-bento-art";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview" as const;
const OUTPUT_DIR = path.resolve(process.cwd(), "public/generated/category-bento");

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_API_KEY is required. Set it in your environment variables.",
    );
  }

  return key;
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

async function main() {
  const force = process.argv.includes("--force");

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const spec of CATEGORY_BENTO_ART_SPECS) {
    const targetPath = path.resolve(process.cwd(), `public${spec.assetPath}`);

    if (!force && (await fileExists(targetPath))) {
      console.log(`Skipping ${spec.label} (already exists)`);
      continue;
    }

    console.log(`Generating ${spec.label}...`);
    const prompt = getCategoryBentoArtPrompt(spec);
    const { buffer, mimeType } = await generateImage(prompt);

    if (getExtensionFromMimeType(mimeType) !== ".png") {
      console.warn(
        `Gemini returned ${mimeType} for ${spec.label}; saving to .png asset path for now.`,
      );
    }

    await writeFile(targetPath, buffer);
    console.log(`Saved ${spec.label} -> ${targetPath}`);
  }
}

await main();
