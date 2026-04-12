import satori from "satori";
import { createFileRoute } from "@tanstack/react-router";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const INTER_FONT_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff";

let interFontPromise: Promise<ArrayBuffer> | null = null;

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

function getQueryUrl(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  if (!value) {
    return "";
  }

  return value;
}

function getQueryNumber(
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
) {
  const raw = searchParams.get(key)?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function stripEmoji(value: string) {
  const withoutEmoji = value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\p{Emoji_Component}/gu, "");
  const collapsedWhitespace = withoutEmoji.replace(/\s+/g, " ").trim();
  return collapsedWhitespace || "at-store";
}

async function getInterFont() {
  if (!interFontPromise) {
    interFontPromise = fetch(INTER_FONT_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load Inter font (${response.status}).`);
      }

      return response.arrayBuffer();
    });
  }

  return interFontPromise;
}

export const Route = createFileRoute("/og/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const title = stripEmoji(
            getQueryText(url.searchParams, "title", "at-store", 90),
          );
          const description = getQueryText(
            url.searchParams,
            "description",
            "Discover apps and protocol tooling across the Atmosphere ecosystem.",
            220,
          );
          const avatarUrl = getQueryUrl(url.searchParams, "avatar");
          const ownedProductCount = getQueryNumber(
            url.searchParams,
            "ownedProducts",
            getQueryNumber(url.searchParams, "products", 0),
          );
          const reviewCount = getQueryNumber(url.searchParams, "reviews", 0);
          const fontData = await getInterFont();
          const initials =
            title
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("") || "AS";

          const svg = await satori(
            <div
              style={{
                alignItems: "stretch",
                background: "#f8fafc",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter",
                height: "100%",
                justifyContent: "space-between",
                padding: "48px",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#1d4ed8",
                    fontWeight: 700,
                  }}
                >
                  at-store
                </div>
                <div
                  style={{
                    background: "#dbeafe",
                    border: "2px solid #93c5fd",
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 86,
                    width: 86,
                    overflow: "hidden",
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      width={86}
                      height={86}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        color: "#1e3a8a",
                        fontSize: 30,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #cbd5e1",
                  borderRadius: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: "28px",
                  marginTop: "22px",
                  padding: "38px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    fontSize: 66,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: "#0f172a",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    color: "#334155",
                    display: "flex",
                    flexWrap: "wrap",
                    fontSize: 32,
                    lineHeight: 1.35,
                    maxWidth: "100%",
                  }}
                >
                  {description}
                </div>
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: "20px",
                  }}
                >
                  {ownedProductCount > 0 ? (
                    <div
                      style={{
                        alignItems: "center",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 999,
                        color: "#1e3a8a",
                        display: "flex",
                        gap: "10px",
                        padding: "10px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 2,
                          width: 18,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            background: "#2563eb",
                            borderRadius: 2,
                            width: 8,
                            height: 8,
                          }}
                        />
                        <div
                          style={{
                            background: "#2563eb",
                            borderRadius: 2,
                            width: 8,
                            height: 8,
                          }}
                        />
                        <div
                          style={{
                            background: "#2563eb",
                            borderRadius: 2,
                            width: 8,
                            height: 8,
                          }}
                        />
                        <div
                          style={{
                            background: "#2563eb",
                            borderRadius: 2,
                            width: 8,
                            height: 8,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>
                        {`${ownedProductCount.toLocaleString()} owned products`}
                      </div>
                    </div>
                  ) : null}
                  <div
                    style={{
                      alignItems: "center",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 999,
                      color: "#1e3a8a",
                      display: "flex",
                      gap: "10px",
                      padding: "10px 16px",
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        border: "2px solid #2563eb",
                        borderRadius: 999,
                        display: "flex",
                        justifyContent: "center",
                        height: 12,
                        width: 22,
                      }}
                    >
                      <div
                        style={{
                          background: "#2563eb",
                          borderRadius: 999,
                          height: 6,
                          width: 6,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>
                      {`${reviewCount.toLocaleString()} reviews written`}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            {
              width: OG_WIDTH,
              height: OG_HEIGHT,
              fonts: [
                { name: "Inter", data: fontData, weight: 400, style: "normal" },
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
