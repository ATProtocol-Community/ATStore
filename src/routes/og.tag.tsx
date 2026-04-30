import type { SatoriOptions } from "satori";

import { createFileRoute } from "@tanstack/react-router";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  renderOg,
} from "#/lib/render-og.server";
import satori from "satori";

import type { AppTagAccent } from "../lib/app-tag-visuals";

import { getAppTagAccent, getAppTagEmoji } from "../lib/app-tag-visuals";
import { getOgTagCardPalette } from "../lib/og-tag-card-style";

const OG_WIDTH = OG_IMAGE_WIDTH;
const OG_HEIGHT = OG_IMAGE_HEIGHT;
const INTER_REGULAR_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff";
const INTER_BOLD_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff";

const VALID_ACCENTS: ReadonlySet<AppTagAccent> = new Set([
  "amber",
  "blue",
  "bronze",
  "crimson",
  "cyan",
  "grass",
  "indigo",
  "iris",
  "jade",
  "orange",
  "pink",
  "plum",
  "purple",
  "ruby",
  "sky",
  "teal",
  "tomato",
  "violet",
]);

type FontPair = { regular: ArrayBuffer; bold: ArrayBuffer };
let fontPromise: Promise<FontPair> | null = null;

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load asset (${response.status}) from ${url}`);
  }

  return response.arrayBuffer();
}

async function getFonts() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      fetchArrayBuffer(INTER_REGULAR_URL),
      fetchArrayBuffer(INTER_BOLD_URL),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }

  return fontPromise;
}

/**
 * Convert an emoji string into the hyphenated hex codepoint sequence Twemoji uses for its
 * SVG asset filenames. This is the standard "Vercel/og + Twemoji" recipe:
 *   - drop variation selectors (\uFE0F) unless the emoji contains a ZWJ sequence
 *     (some ZWJ emojis require the FE0F to be retained for the asset to exist),
 *   - decode UTF-16 surrogate pairs into a single codepoint,
 *   - join codepoints with `-`.
 *
 * Mirrors logic from `@vercel/og`'s emoji loader so emoji like `🪪` (single codepoint),
 * `👨‍💻` (ZWJ sequence), and `✨` (basic) all resolve to a real Twemoji SVG.
 */
function emojiToTwemojiCodepoints(emoji: string): string {
  const ZWJ = "\u200D";
  const VS16 = /\uFE0F/g;
  const normalized = emoji.includes(ZWJ) ? emoji : emoji.replace(VS16, "");

  const codepoints: Array<string> = [];
  let highSurrogate = 0;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.codePointAt(i);
    if (c === undefined) continue;
    if (highSurrogate) {
      codepoints.push(
        (
          0x1_00_00 +
          ((highSurrogate - 0xd8_00) << 10) +
          (c - 0xdc_00)
        ).toString(16),
      );
      highSurrogate = 0;
    } else if (c >= 0xd8_00 && c <= 0xdb_ff) {
      highSurrogate = c;
    } else {
      codepoints.push(c.toString(16));
    }
  }

  return codepoints.join("-");
}

/**
 * Cache fetched Twemoji SVGs so a single OG response (which may render the same emoji five
 * times) only hits the CDN once, and so subsequent requests reuse the same data URL.
 */
const emojiAssetCache = new Map<string, string>();

/**
 * Satori's emoji hook: when it tokenizes the JSX text and finds an emoji glyph, it calls this
 * with `code === "emoji"` and the actual segment string. Satori 0.26 expects the returned
 * value to be a data URL (it inlines the bytes during render). Returning a remote URL string
 * triggers an internal `.trim()` on `undefined` because Satori's fetch path assumes data was
 * preloaded — so we fetch + base64-encode here and hand back a data URL.
 */
async function loadAdditionalAsset(
  code: string,
  segment: string,
): Promise<string | undefined> {
  if (code !== "emoji") return undefined;
  const codepoints = emojiToTwemojiCodepoints(segment);
  if (!codepoints) return undefined;

  const cached = emojiAssetCache.get(codepoints);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg`,
    );
    if (!response.ok) return undefined;
    const svg = await response.text();
    const base64 = Buffer.from(svg, "utf8").toString("base64");
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    emojiAssetCache.set(codepoints, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}

function getQueryText(
  searchParams: URLSearchParams,
  key: string,
  fallback: string,
  maxLength: number,
) {
  const value = searchParams.get(key)?.trim();
  if (!value) {
    return fallback;
  }

  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}…`
    : value;
}

function getAccent(
  searchParams: URLSearchParams,
  fallback: AppTagAccent,
): AppTagAccent {
  const raw = searchParams.get("accent")?.trim().toLowerCase();
  if (raw && VALID_ACCENTS.has(raw as AppTagAccent)) {
    return raw as AppTagAccent;
  }
  return fallback;
}

type EmojiSlot = {
  fontSize: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  rotate: number;
  opacity: number;
};

/**
 * Five-glyph scatter mirroring `AppTagCard`'s featured layout (the OG canvas is wide enough
 * that the larger 5-emoji scatter reads better than the 3-emoji compact one). Sizes/positions
 * are tuned for 1200×630 — they intentionally peek from the right edge and cluster slightly
 * toward the centroid so the title, which sits center-left, stays clearly readable.
 *
 * `fontSize` is the rendered emoji size in px. Satori sizes emoji images to match the
 * surrounding text's font size.
 */
const EMOJI_SLOTS: Array<EmojiSlot> = [
  { fontSize: 220, top: "10%", left: "38%", rotate: -16, opacity: 0.22 },
  { fontSize: 300, top: "32%", right: "-3%", rotate: 11, opacity: 0.18 },
  { fontSize: 160, bottom: "12%", left: "20%", rotate: 24, opacity: 0.24 },
  { fontSize: 200, top: "20%", left: "4%", rotate: 18, opacity: 0.2 },
  { fontSize: 140, bottom: "22%", right: "30%", rotate: -22, opacity: 0.26 },
];

export const Route = createFileRoute("/og/tag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const tag = url.searchParams.get("tag")?.trim() ?? "";
          /**
           * `label` is what we render — falls back to the tag itself so consumers can call this
           * with just `?tag=social`. Categories pass `?label=Account+Tool&tag=account-tool` so
           * the rendered title preserves the human-friendly casing.
           */
          const label = getQueryText(
            url.searchParams,
            "label",
            tag || "ATStore",
            64,
          );
          const kind = getQueryText(url.searchParams, "kind", "Tag", 24);
          const countRaw = url.searchParams.get("count")?.trim();
          const count =
            countRaw && /^\d+$/.test(countRaw) ? Number(countRaw) : null;

          const accent = getAccent(url.searchParams, getAppTagAccent(tag));
          const palette = getOgTagCardPalette(accent);
          const emojiOverride = url.searchParams.get("emoji")?.trim();
          const emoji = emojiOverride || getAppTagEmoji(tag);

          const { regular, bold } = await getFonts();

          const svg = await satori(
            <div
              style={{
                alignItems: "stretch",
                background: `linear-gradient(135deg, ${palette.gradientStart} 0%, ${palette.gradientEnd} 100%)`,
                color: palette.text,
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter",
                height: "100%",
                justifyContent: "space-between",
                padding: "72px",
                position: "relative",
                width: "100%",
                border: `2px solid ${palette.border}`,
              }}
            >
              {EMOJI_SLOTS.map((slot, idx) => {
                /**
                 * Satori 0.26 throws "Cannot read properties of undefined (reading 'trim')"
                 * when a style entry is `undefined` (its CSS parser assumes every value is a
                 * string). Build the style object with only the positional sides we actually
                 * set so the unused ones aren't present at all.
                 */
                const style: Record<string, string | number> = {
                  position: "absolute",
                  fontSize: slot.fontSize,
                  lineHeight: 1,
                  opacity: slot.opacity,
                  transform: `rotate(${slot.rotate}deg)`,
                  display: "flex",
                };
                if (slot.top !== undefined) style.top = slot.top;
                if (slot.left !== undefined) style.left = slot.left;
                if (slot.right !== undefined) style.right = slot.right;
                if (slot.bottom !== undefined) style.bottom = slot.bottom;
                return (
                  <div key={idx} style={style}>
                    {emoji}
                  </div>
                );
              })}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.55)",
                    border: `2px solid ${palette.border}`,
                    fontSize: 32,
                    fontWeight: 700,
                    color: palette.text,
                  }}
                >
                  @
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: palette.text,
                  }}
                >
                  ATStore
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    background: "rgba(255, 255, 255, 0.5)",
                    border: `1px solid ${palette.border}`,
                    borderRadius: 999,
                    color: palette.text,
                    display: "flex",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    padding: "10px 20px",
                    textTransform: "uppercase",
                  }}
                >
                  {kind}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    fontSize: 128,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: "white",
                    textShadow: "0 2px 6px rgba(0, 0, 0, 0.28)",
                  }}
                >
                  {label}
                </div>
                {count === null ? null : (
                  <div
                    style={{
                      color: "white",
                      display: "flex",
                      fontSize: 32,
                      fontWeight: 400,
                      opacity: 0.9,
                      textShadow: "0 1px 3px rgba(0, 0, 0, 0.28)",
                    }}
                  >
                    {`${count.toLocaleString()} ${count === 1 ? "listing" : "listings"}`}
                  </div>
                )}
              </div>
            </div>,
            {
              width: OG_WIDTH,
              height: OG_HEIGHT,
              fonts: [
                { name: "Inter", data: regular, weight: 400, style: "normal" },
                { name: "Inter", data: bold, weight: 700, style: "normal" },
              ],
              loadAdditionalAsset: loadAdditionalAsset as NonNullable<
                SatoriOptions["loadAdditionalAsset"]
              >,
            },
          );

          return renderOg(svg, { width: OG_WIDTH, height: OG_HEIGHT });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not render OG tag image.";

          return new Response(message, {
            status: 500,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          });
        }
      },
    },
  },
});
