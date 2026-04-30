/**
 * Shared "what does this app tag look like?" data — accent palette + emoji glyph.
 *
 * Two consumers care:
 *   - `AppTagCard` (browser, stylex) reads these to pick a `softXxxSurface` style + the emoji
 *     glyphs that scatter behind the card title.
 *   - The OG image renderer (`/og/tag`, server-side via Satori) reads them to mirror the same
 *     visual treatment in social previews. Satori can't evaluate stylex `light-dark()` tokens,
 *     so it pairs these with the concrete-hex table in `og-tag-card-style.ts`.
 *
 * Keep this module free of stylex/UI imports so it can be used in server-only code paths
 * (Satori OG generation) without bundling the design system.
 */

/**
 * Intentionally broader than `DirectoryListingCard["accent"]` (which is locked to 4 brand-level
 * category accents). App tags are a finer cut — one accent per tag so the `/apps/tags` grid and
 * matching OG cards read as a colorful taxonomy rather than four repeating colors.
 */
export type AppTagAccent =
  | "amber"
  | "blue"
  | "bronze"
  | "crimson"
  | "cyan"
  | "grass"
  | "indigo"
  | "iris"
  | "jade"
  | "orange"
  | "pink"
  | "plum"
  | "purple"
  | "ruby"
  | "sky"
  | "teal"
  | "tomato"
  | "violet";

/**
 * Per-tag accent assignments. Picks are intentional, not hash-based:
 *   - data / analytics / science lean cool cyans,
 *   - creative / media / art lean warm pinks/violets/plums,
 *   - dev / work / messaging lean indigo/iris,
 *   - publishing / writing / books lean bronze (paper/ink),
 *   - safety / moderation / news / video lean ruby/tomato,
 *   - community / fitness / outdoors lean grass.
 *
 * Keys must match the lowercase canonical form produced by `normalizeAppTagKey`. Tags not in
 * this map fall through to `blue` so they're visually obvious as unmapped.
 */
export const APP_TAG_ACCENTS: Record<string, AppTagAccent> = {
  "account tool": "indigo",
  analytics: "cyan",
  annotation: "amber",
  art: "pink",
  articles: "bronze",
  audio: "violet",
  automation: "orange",
  bookmarks: "amber",
  books: "bronze",
  community: "grass",
  conferencing: "cyan",
  creative: "ruby",
  "creator tool": "pink",
  "data-explorer": "cyan",
  design: "violet",
  developer: "iris",
  "developer tool": "iris",
  developers: "iris",
  events: "orange",
  experiments: "teal",
  "feed generator": "sky",
  fitness: "grass",
  food: "tomato",
  fun: "pink",
  games: "ruby",
  groups: "grass",
  labeler: "ruby",
  livestreaming: "tomato",
  location: "sky",
  marketplace: "amber",
  messaging: "indigo",
  moderation: "ruby",
  news: "tomato",
  "personal page": "amber",
  photo: "plum",
  productivity: "teal",
  publishing: "bronze",
  reviews: "orange",
  roleplaying: "plum",
  science: "cyan",
  social: "purple",
  sports: "grass",
  utility: "teal",
  video: "tomato",
  work: "indigo",
  writing: "bronze",
};

/**
 * Per-tag emoji. Picks aim for a *single, unambiguous* glyph per tag — close-but-distinct
 * choices (e.g. 📰 articles vs. 🗞️ news) are deliberate so the grid reads as a taxonomy at a
 * glance, not as a dozen identical newspaper icons.
 *
 * Keys mirror `APP_TAG_ACCENTS`. Unmapped tags fall through to ✨ — a visible signal that the
 * tag is new and should get a deliberate emoji.
 */
export const APP_TAG_EMOJI: Record<string, string> = {
  "account tool": "🪪",
  analytics: "📊",
  annotation: "✍️",
  art: "🎨",
  articles: "📰",
  audio: "🎧",
  automation: "🤖",
  bookmarks: "🔖",
  books: "📚",
  community: "👥",
  conferencing: "📞",
  creative: "🪄",
  "creator tool": "🎬",
  "data-explorer": "🔍",
  design: "🖌️",
  developer: "👨‍💻",
  "developer tool": "🛠️",
  developers: "👩‍💻",
  events: "📅",
  experiments: "🧪",
  "feed generator": "📡",
  fitness: "💪",
  food: "🍳",
  fun: "🎉",
  games: "🎮",
  groups: "🫂",
  labeler: "🏷️",
  livestreaming: "📺",
  location: "📍",
  marketplace: "🛍️",
  messaging: "💬",
  moderation: "🛡️",
  news: "🗞️",
  "personal page": "👤",
  photo: "📷",
  productivity: "✅",
  publishing: "📖",
  reviews: "⭐",
  roleplaying: "🎭",
  science: "🔬",
  social: "🌐",
  sports: "⚽",
  utility: "🧰",
  video: "🎥",
  work: "💼",
  writing: "✏️",
};

/**
 * Normalize a tag string into the lowercase, single-spaced form used as the lookup key in
 * `APP_TAG_ACCENTS` / `APP_TAG_EMOJI`. Mirrors how older records may have been stored with
 * mixed casing or extra whitespace.
 */
export function normalizeAppTagKey(tag: string): string {
  return tag.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

export function getAppTagAccent(tag: string): AppTagAccent {
  const normalized = normalizeAppTagKey(tag);
  return APP_TAG_ACCENTS[normalized] ?? APP_TAG_ACCENTS[tag] ?? "blue";
}

export function getAppTagEmoji(tag: string): string {
  const normalized = normalizeAppTagKey(tag);
  return APP_TAG_EMOJI[normalized] ?? APP_TAG_EMOJI[tag] ?? "✨";
}
