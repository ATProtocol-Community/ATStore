/**
 * Gemini 3.1 Flash image preview — shared by hero/icon server flows and CLI scripts.
 */
const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

export type GeminiInlineImageMime = "image/png" | "image/jpeg" | "image/webp";

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "Missing GEMINI_API_KEY or GOOGLE_API_KEY in the environment for image generation.",
    );
  }
  return key;
}

export async function geminiFlashGenerateImageFromPromptAndImage(input: {
  prompt: string;
  imageBytes: Buffer;
  imageMimeType: GeminiInlineImageMime;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = getGeminiApiKey();
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: input.prompt },
            {
              inlineData: {
                mimeType: input.imageMimeType,
                data: input.imageBytes.toString("base64"),
              },
            },
          ],
        },
      ],
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
    throw new Error(
      `No image data returned by Gemini: ${JSON.stringify(json)}`,
    );
  }

  return {
    buffer: Buffer.from(imagePart.data, "base64"),
    mimeType: imagePart.mimeType ?? "image/png",
  };
}
