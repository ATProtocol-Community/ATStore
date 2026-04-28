import satori from "satori";
import { createFileRoute } from "@tanstack/react-router";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const INTER_REGULAR_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff";
const INTER_BOLD_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff";

/**
 * Brand surface for the "general store page" OG card. Pulled from the design system's blue
 * tokens (`border1`/`border2`/`solid1`) so the gradient matches `AppTagCard` blue surface and
 * sits next to tag/category OG cards as the same visual family.
 */
const BRAND_GRADIENT_START = "#8ec8f6";
const BRAND_GRADIENT_END = "#0090ff";
const BRAND_BORDER = "#acd8fc";
const BRAND_INK = "#0c2452";

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

/**
 * Strip emoji + emoji modifiers from a string. Satori can't render color emoji from the bundled
 * Inter font, so without an explicit Twemoji loader emojis come out as missing-glyph rectangles.
 * The emoji-rich variant lives at `/og/tag` (used for tag/category cards). The general OG just
 * leads with the ATStore wordmark, so dropping emojis here keeps the title clean rather than
 * pretending we have emoji rendering.
 */
function stripEmoji(value: string) {
  const withoutEmoji = value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\p{Emoji_Component}/gu, "");
  const collapsedWhitespace = withoutEmoji.replace(/\s+/g, " ").trim();
  return collapsedWhitespace || "ATStore";
}

export const Route = createFileRoute("/og/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const rawTitle = getQueryText(
            url.searchParams,
            "title",
            "ATStore",
            90,
          );
          const description = getQueryText(
            url.searchParams,
            "description",
            "Discover apps and tools across the Atmosphere ecosystem.",
            220,
          );
          const title = stripEmoji(rawTitle);
          /**
           * Detect whether the title is just our brand name. If so we drop the redundant
           * "ATStore" subtitle line — the wordmark already carries it. Otherwise we show the
           * page-specific title beneath the wordmark.
           */
          const titleIsBrand = /^at[-\s]?store$/i.test(title.trim());
          const { regular, bold } = await getFonts();

          const svg = await satori(
            <div
              style={{
                alignItems: "stretch",
                background: `linear-gradient(135deg, ${BRAND_GRADIENT_START} 0%, ${BRAND_GRADIENT_END} 100%)`,
                color: BRAND_INK,
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter",
                height: "100%",
                justifyContent: "center",
                padding: "96px",
                position: "relative",
                width: "100%",
                border: `2px solid ${BRAND_BORDER}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "32px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 168,
                    height: 168,
                    borderRadius: 36,
                    background: "rgba(255, 255, 255, 0.65)",
                    border: `2px solid ${BRAND_BORDER}`,
                    fontSize: 120,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: BRAND_INK,
                  }}
                >
                  {/*
                   * In Inter the "@" sits noticeably low inside the line box (its optical
                   * center is a bit below the geometric center of the em-square). Flex
                   * `alignItems: center` aligns the line box, not the glyph, so the badge
                   * looks visibly bottom-heavy. Nudge the glyph up a few pixels — tuned so
                   * the curl of the @ sits on the badge's horizontal centerline.
                   */}
                  <div
                    style={{ display: "flex", transform: "translateY(-10px)" }}
                  >
                    @
                  </div>
                </div>
                <div
                  style={{
                    color: "white",
                    display: "flex",
                    fontSize: 144,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    textShadow: "0 3px 8px rgba(0, 0, 0, 0.22)",
                  }}
                >
                  ATStore
                </div>
              </div>
              {!titleIsBrand ? (
                <div
                  style={{
                    color: "white",
                    display: "flex",
                    flexWrap: "wrap",
                    fontSize: 56,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    marginTop: 56,
                    maxWidth: "100%",
                    textShadow: "0 2px 6px rgba(0, 0, 0, 0.22)",
                  }}
                >
                  {title}
                </div>
              ) : null}
              <div
                style={{
                  color: "rgba(255, 255, 255, 0.92)",
                  display: "flex",
                  flexWrap: "wrap",
                  fontSize: 32,
                  lineHeight: 1.35,
                  marginTop: titleIsBrand ? 56 : 24,
                  maxWidth: "100%",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.22)",
                }}
              >
                {description}
              </div>
            </div>,
            {
              width: OG_WIDTH,
              height: OG_HEIGHT,
              fonts: [
                { name: "Inter", data: regular, weight: 400, style: "normal" },
                { name: "Inter", data: bold, weight: 700, style: "normal" },
              ],
            },
          );

          return new Response(svg, {
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not render OG image.";

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
