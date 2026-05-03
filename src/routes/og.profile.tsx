import type { SatoriOptions } from "satori";

import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db/index.server";
import * as schema from "#/db/schema";
import { fetchBlueskyPublicProfileFields } from "#/lib/bluesky-public-profile";
import { httpsListingImageUrlOrNull } from "#/lib/listing-image-url";
import { loadAppleEmojiAsset } from "#/lib/og-emoji.server";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  renderOg,
} from "#/lib/render-og.server";
import { and, avg, count, desc, eq } from "drizzle-orm";
import satori from "satori";

const OG_WIDTH = OG_IMAGE_WIDTH;
const OG_HEIGHT = OG_IMAGE_HEIGHT;
const INTER_REGULAR_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff";
const INTER_BOLD_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff";

const BG = "#ffffff";
const BORDER = "#e4e4e7";
const TEXT = "#0a0a0a";
const TEXT_MUTED = "#71717a";
const TEXT_LABEL = "#a1a1aa";
const SURFACE_SUBTLE = "#fafafa";

/**
 * Avatar fallback uses a soft peach surface with a deep red ink so the initials read with
 * strong contrast at 1200×630 raster size. Single palette (not hashed) keeps OG previews
 * deterministic and matches the design comp.
 */
const AVATAR_FALLBACK_BG_FROM = "#fde2dc";
const AVATAR_FALLBACK_BG_TO = "#f6c4b8";
const AVATAR_FALLBACK_INK = "#7a1a1a";
const AVATAR_BORDER = "#f0d3cb";

const AVATAR_DISPLAY_PX = 168;
/** Rounded-square radius — matches `Avatar` size `xl` ratio (~radius.xl on a 5xl square). */
const AVATAR_RADIUS = "36px";
/**
 * Bottom strip of favorite app icons. Sized so 8 squircle icons + 7 × 18px gaps fit inside
 * the OG canvas's 1072px content width (1200 − 2 × 64px padding) with a little breathing
 * room (8 × 116 + 7 × 18 = 1054).
 */
const FAVORITE_CARDS_LIMIT = 8;
const FAVORITE_ICON_DISPLAY_PX = 116;
const FAVORITE_ICON_GAP_PX = 18;
const FAVORITE_ICON_RADIUS = "26px";

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

function isPlausiblePublicDid(value: string) {
  const s = value.trim();
  return s.startsWith("did:") && s.length >= 12 && s.length <= 2048;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatDidShort(did: string) {
  const d = did.trim();
  if (d.length <= 28) return d;
  return `${d.slice(0, 16)}…${d.slice(-6)}`;
}

function initialsFrom(label: string) {
  const t =
    typeof label === "string" ? label.trim() : String(label ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ogRemoteImgSrc(url: string | null | undefined): string | null {
  const t = typeof url === "string" ? url.trim() : "";
  if (!t || !/^https?:\/\//i.test(t)) {
    return null;
  }
  return t;
}

/**
 * Fetch + resize remote images before `satori()` so pixels are fully decoded. Mirrors the
 * helper in `og.review.tsx` — a small JPEG data URL keeps Yoga happy (huge raw `data:` blobs
 * break it).
 */
async function preloadOgRasterImageForSatori(
  url: string | null | undefined,
  displayEdgePx: number,
): Promise<string | undefined> {
  const src = ogRemoteImgSrc(url);
  if (!src) {
    return undefined;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(src, {
      signal: controller.signal,
      headers: { Accept: "image/*,*/*" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return undefined;
    }

    const input = Buffer.from(await res.arrayBuffer());
    if (input.byteLength === 0 || input.byteLength > 12_000_000) {
      return undefined;
    }

    const { default: sharp } = await import("sharp");

    const encode = async (edge: number, quality: number) =>
      sharp(input, { failOn: "none" })
        .rotate()
        .resize(edge, edge, { fit: "cover" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

    const edge = Math.min(384, Math.max(displayEdgePx * 2, displayEdgePx));
    let buf = await encode(edge, 84);
    if (buf.byteLength > 300_000) {
      buf = await encode(Math.min(192, edge), 78);
    }
    if (buf.byteLength > 350_000) {
      buf = await encode(128, 72);
    }

    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Number formatter that keeps the OG card's 1-3 digit numerals legible at large size — long
 * counts get a `1.2k` style abbreviation so the row never has to wrap.
 */
function formatStatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const n = Math.floor(value);
  if (n < 1000) return String(n);
  if (n < 10_000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

function formatAvgRating(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export const Route = createFileRoute("/og/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const did = url.searchParams.get("did")?.trim() ?? "";

          if (!isPlausiblePublicDid(did)) {
            return new Response("Invalid did.", {
              status: 400,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          const reviews = schema.storeListingReviews;
          const favorites = schema.storeListingFavorites;
          const listings = schema.storeListings;
          const verified = eq(listings.verificationStatus, "verified");

          const [profile, reviewAggRows, favoriteCountRows, favoriteRows] =
            await Promise.all([
              fetchBlueskyPublicProfileFields(did),
              db
                .select({
                  reviewsCount: count(),
                  averageRating: avg(reviews.rating),
                })
                .from(reviews)
                .innerJoin(listings, eq(reviews.storeListingId, listings.id))
                .where(and(eq(reviews.authorDid, did), verified)),
              db
                .select({ favoritesCount: count() })
                .from(favorites)
                .innerJoin(listings, eq(favorites.storeListingId, listings.id))
                .where(and(eq(favorites.authorDid, did), verified)),
              db
                .select({
                  id: listings.id,
                  name: listings.name,
                  iconUrl: listings.iconUrl,
                  favoritedAt: favorites.favoriteCreatedAt,
                })
                .from(favorites)
                .innerJoin(listings, eq(favorites.storeListingId, listings.id))
                .where(and(eq(favorites.authorDid, did), verified))
                .orderBy(desc(favorites.favoriteCreatedAt))
                .limit(FAVORITE_CARDS_LIMIT),
            ]);

          const reviewsCount = Number(reviewAggRows[0]?.reviewsCount ?? 0);
          const avgRatingRaw = reviewAggRows[0]?.averageRating;
          const averageRating =
            avgRatingRaw == null
              ? null
              : Number.isFinite(Number(avgRatingRaw))
                ? Number(avgRatingRaw)
                : null;
          const favoritesCount = Number(
            favoriteCountRows[0]?.favoritesCount ?? 0,
          );

          const handleRaw = profile?.handle?.trim() ?? "";
          const handle = handleRaw.replace(/^@/, "") || null;
          const handleLabel = handle ? `@${handle}` : null;
          const displayNameRaw = profile?.displayName?.trim() ?? "";
          const displayName = displayNameRaw || null;
          const primaryLine = displayName || handleLabel || formatDidShort(did);
          const secondaryLine = displayName && handleLabel ? handleLabel : null;

          const favoriteIconSrcs = await Promise.all(
            favoriteRows.map(async (row) => {
              const u = httpsListingImageUrlOrNull(
                row.iconUrl == null ? null : String(row.iconUrl),
              );
              const preloaded = await preloadOgRasterImageForSatori(
                u,
                FAVORITE_ICON_DISPLAY_PX,
              );
              return preloaded ?? ogRemoteImgSrc(u);
            }),
          );

          const avatarPreloaded = await preloadOgRasterImageForSatori(
            profile?.avatarUrl ?? null,
            AVATAR_DISPLAY_PX,
          );
          const avatarImgSrc =
            avatarPreloaded ?? ogRemoteImgSrc(profile?.avatarUrl ?? null);

          const { regular, bold } = await getFonts();

          const titleText = truncate(primaryLine, 36);
          const handleText = secondaryLine ? truncate(secondaryLine, 48) : null;

          const hasReviews = reviewsCount > 0;
          const hasFavoriteCards = favoriteRows.length > 0;

          const svg = await satori(
            <div
              style={{
                backgroundColor: BG,
                borderColor: BORDER,
                borderStyle: "solid",
                borderWidth: "2px",
                color: TEXT,
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter",
                height: "100%",
                padding: "56px 64px",
                width: "100%",
                position: "relative",
              }}
            >
              {/* Top-right ATStore wordmark — matches `AtStoreLogo` (navbar variant): the
                  multi-circle logo mark followed by an `AT` (brand blue) / `Store` lockup. */}
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "12px",
                  position: "absolute",
                  right: "48px",
                  top: "36px",
                }}
              >
                <AtStoreMark size={64} />
              </div>

              {/* Hero: avatar + name/handle */}
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexDirection: "row",
                  marginTop: "24px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: avatarImgSrc
                      ? "transparent"
                      : `linear-gradient(135deg, ${AVATAR_FALLBACK_BG_FROM} 0%, ${AVATAR_FALLBACK_BG_TO} 100%)`,
                    borderColor: AVATAR_BORDER,
                    borderRadius: AVATAR_RADIUS,
                    borderStyle: "solid",
                    borderWidth: "1px",
                    display: "flex",
                    flexShrink: 0,
                    height: `${AVATAR_DISPLAY_PX}px`,
                    justifyContent: "center",
                    marginRight: "32px",
                    overflow: "hidden",
                    width: `${AVATAR_DISPLAY_PX}px`,
                  }}
                >
                  {avatarImgSrc ? (
                    <img
                      alt=""
                      src={avatarImgSrc}
                      height={AVATAR_DISPLAY_PX}
                      width={AVATAR_DISPLAY_PX}
                      style={{
                        height: `${AVATAR_DISPLAY_PX}px`,
                        objectFit: "cover",
                        objectPosition: "center",
                        width: `${AVATAR_DISPLAY_PX}px`,
                        overflow: "hidden",
                        borderRadius: AVATAR_RADIUS,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        alignItems: "center",
                        color: AVATAR_FALLBACK_INK,
                        display: "flex",
                        fontSize: "64px",
                        fontWeight: 700,
                        justifyContent: "center",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {initialsFrom(primaryLine)}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      color: TEXT,
                      display: "flex",
                      fontSize: "76px",
                      fontWeight: 700,
                      letterSpacing: "-0.025em",
                      lineHeight: 1.05,
                    }}
                  >
                    {titleText}
                  </div>
                  {handleText ? (
                    <div
                      style={{
                        color: TEXT_MUTED,
                        display: "flex",
                        fontSize: "32px",
                        fontWeight: 500,
                        lineHeight: 1.1,
                        marginTop: "16px",
                      }}
                    >
                      {handleText}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Stats row.
                  Each column gets a fixed width — Satori's flex sizes columns to the value
                  text rather than the wider label, so without an explicit width the labels
                  bleed into the next column. */}
              <div
                style={{
                  alignItems: "flex-end",
                  display: "flex",
                  flexDirection: "row",
                  gap: "32px",
                  marginTop: "40px",
                  width: "100%",
                }}
              >
                <StatColumn
                  value={formatStatCount(favoritesCount)}
                  label="Favorites"
                  width="220px"
                />
                <StatColumn
                  value={formatStatCount(reviewsCount)}
                  label="Reviews"
                  width="220px"
                />
                {hasReviews ? (
                  <StatColumn
                    value={formatAvgRating(averageRating)}
                    label="Avg"
                    width="220px"
                    labelTrailing={
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ marginLeft: "8px" }}
                      >
                        <path
                          fill="#facc15"
                          d="M12 2.5l2.95 6.36 6.93.7-5.21 4.71 1.49 6.83L12 17.77 5.84 21.1l1.49-6.83L2.12 9.56l6.93-.7L12 2.5z"
                        />
                      </svg>
                    }
                  />
                ) : null}
              </div>

              {/* Bottom: favorite product cards */}
              {hasFavoriteCards ? (
                <div
                  style={{
                    borderTopColor: BORDER,
                    borderTopStyle: "solid",
                    borderTopWidth: "1px",
                    display: "flex",
                    flexDirection: "row",
                    gap: `${FAVORITE_ICON_GAP_PX}px`,
                    marginTop: "32px",
                    paddingTop: "28px",
                    width: "100%",
                  }}
                >
                  {favoriteRows.map((row, idx) => {
                    const iconSrc = favoriteIconSrcs[idx] ?? null;
                    const name = truncate(
                      String(row.name ?? "").trim() || "—",
                      18,
                    );
                    return (
                      <div
                        key={row.id}
                        style={{
                          alignItems: "center",
                          backgroundColor: SURFACE_SUBTLE,
                          borderColor: BORDER,
                          borderRadius: FAVORITE_ICON_RADIUS,
                          borderStyle: "solid",
                          borderWidth: "1px",
                          display: "flex",
                          flexShrink: 0,
                          height: `${FAVORITE_ICON_DISPLAY_PX}px`,
                          justifyContent: "center",
                          overflow: "hidden",
                          width: `${FAVORITE_ICON_DISPLAY_PX}px`,
                        }}
                      >
                        {iconSrc ? (
                          <img
                            alt=""
                            src={iconSrc}
                            height={FAVORITE_ICON_DISPLAY_PX}
                            width={FAVORITE_ICON_DISPLAY_PX}
                            style={{
                              height: `${FAVORITE_ICON_DISPLAY_PX}px`,
                              objectFit: "cover",
                              objectPosition: "center",
                              width: `${FAVORITE_ICON_DISPLAY_PX}px`,
                              overflow: "hidden",
                              borderRadius: FAVORITE_ICON_RADIUS,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              color: TEXT_MUTED,
                              display: "flex",
                              fontSize: "40px",
                              fontWeight: 700,
                            }}
                          >
                            {initialsFrom(name)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>,
            {
              width: OG_WIDTH,
              height: OG_HEIGHT,
              fonts: [
                { name: "Inter", data: regular, weight: 400, style: "normal" },
                { name: "Inter", data: bold, weight: 700, style: "normal" },
              ],
              loadAdditionalAsset: loadAppleEmojiAsset as NonNullable<
                SatoriOptions["loadAdditionalAsset"]
              >,
            },
          );

          return renderOg(svg, { width: OG_WIDTH, height: OG_HEIGHT });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not render OG profile image.";

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

function StatColumn({
  value,
  label,
  width,
  labelTrailing,
}: {
  value: string;
  label: string;
  width?: string;
  /**
   * Optional element appended after the label text — used to render a gold star next to
   * "AVG" without relying on glyphs Inter doesn't ship (U+2605 renders as tofu).
   */
  labelTrailing?: React.ReactNode;
}) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width: width ?? "auto",
      }}
    >
      <div
        style={{
          color: TEXT,
          display: "flex",
          fontSize: "72px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          alignItems: "center",
          color: TEXT_LABEL,
          display: "flex",
          flexDirection: "row",
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "0.16em",
          marginTop: "12px",
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex" }}>{label}</div>
        {labelTrailing ?? null}
      </div>
    </div>
  );
}

/**
 * The ATStore logo mark — overlapping bsky-blue / sage / forest circles with the white
 * cutout. Mirrors `public/logo.svg` (pulled inline because Satori can't load same-origin
 * `<img src="/logo.svg" />` reliably during rendering, and CSS class fills inside an SVG
 * `<style>` block aren't honored — fills must be set via the `fill` attribute).
 */
function AtStoreMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 999.12 1000.08"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle fill="#4058a7" cx="296.27" cy="449.23" r="289.35" />
      <circle fill="#6dacde" cx="499.01" cy="301.53" r="289.35" />
      <circle fill="#92d8f7" cx="701.76" cy="447.88" r="289.35" />
      <circle fill="#219546" cx="625.23" cy="688.22" r="289.35" />
      <path
        fill="#86af58"
        d="M662.15,686.88c0,159.8-129.55,289.35-289.35,289.35S83.45,846.68,83.45,686.88c0-55.27,20.33-126.19,66.1-183.08,24.2-30.09,176.45,149.31,189.01,140.79,67.7-45.9,98.45-209.46,123.53-209.46,23.34,0-14.99-34.93,37.79-8.27,91.19,46.06,162.26,146.92,162.26,260.02Z"
      />
      <path
        fill="#4058a7"
        d="M585.62,447.88c0,159.8-129.55,289.35-289.35,289.35-119.47,0-198.69-78.78-209.46-89.29-56.39-55.05-116.95-186.73-52.36-322.24,68.48-143.67,210.49-162.62,210.49-162.62h0s-121.87,208.27,88.93,377.45c91.61,73.52,251.75-274.72,251.75-92.64Z"
      />
      <path
        fill="#fff"
        d="M644.55,590.71c-20.18,15.9-45.63,33.43-76.53,49.68-36.42,19.15-70.26,31.19-98.02,38.94-22.29-15.25-48.54-35.86-75.19-63.11-26.64-27.24-46.66-53.92-61.41-76.53,8.56-28.49,21.45-62.71,41.27-99.36,15.87-29.33,32.75-53.89,48.34-73.85,27.84-.09,61.05,1.81,98.02,8.06,36.42,6.15,67.99,15.09,93.99,24.17,8.16,25.24,15.95,54.96,21.48,88.62,6.39,38.84,8.27,73.84,8.06,103.39Z"
      />
    </svg>
  );
}
