import { APP_TAG_EMOJI, normalizeAppTagKey } from "./app-tag-visuals";

/**
 * Emoji lookup for directory **category tree** nodes (`EcosystemCategoryCard`, category
 * page heroes). `getAppTagEmoji` intentionally returns ✨ for unmapped keys as a “wire this
 * tag up” signal — directory labels frequently don’t match app-tag slugs 1:1 (`CLI`, `PDS`,
 * `Lexicons`, `Protocol Tools`, …) so leaning only on the app-tag map produces a sea of ✨.
 *
 * Resolution order:
 *   1. Explicit ecosystem map (top-level tree + protocol vocabulary),
 *   2. App-tag map **only when** the glyph isn’t ✨,
 *   3. Strip a trailing `tool` / `tools` suffix and retry (↔ “Analytics Tool” → analytics),
 *   4. Keyword heuristics (longer/more specific patterns first),
 *   5. Stable hash into a small neutral pool — always distinct from ✨ so cards stay readable.
 */

const SPARKLE = "✨";

/** Top-level and protocol-style labels that never appear as app tags. Keys: `normalizeAppTagKey`. */
const ECOSYSTEM_CATEGORY_EMOJI: Record<string, string> = {
  apps: "📱",
  protocol: "🔌",
  "protocol tools": "🔌",
  bluesky: "🦋",
  // Protocol stack (labels vary by taxonomy version)
  pds: "💾",
  appview: "🔭",
  lexicons: "📜",
  lexicon: "📜",
  relay: "📡",
  firehose: "🔥",
  jetstream: "🌊",
  identity: "🆔",
  hosting: "🖥",
  infrastructure: "🏗",
  oauth: "🔐",
  authentication: "🔐",
  // Common directory phrasing
  cli: "⌨️",
  sdk: "📦",
  api: "🔌",
  tooling: "🛠",
  tools: "🛠",
  services: "🧩",
  clients: "📲",
  servers: "🖥",
  experimentation: "🧪",
  experiments: "🧪",
  // Bento / marketing labels that differ from app-tag spelling
  "analytics tool": "📊",
  "account tool": "🪪",
  "developer tool": "🛠",
  "creator tool": "🎬",
};

/**
 * `(pattern, emoji)` — first match wins. Patterns run against `normalizeAppTagKey(label)`.
 * Keep multi-word / specific patterns above loose single-token matches.
 */
const KEYWORD_EMOJI_RULES: ReadonlyArray<[RegExp, string]> = [
  [/bluesky/, "🦋"],
  [/protocol\s+tool/, "🔌"],
  [/\bmoderat/, "🛡"],
  [/\blabeler\b/, "🏷"],
  [/\banalytics\b/, "📊"],
  [/\bdeveloper|\bdev\b|\bdebug\b/, "👨‍💻"],
  [/\bdesign\b|\bui\b|\bux\b/, "🖌"],
  [/\bsocial\b|\bchat\b|\bfeed\b(?!\s+gen)/, "🌐"],
  [/\bcommunity\b|\bgroups?\b/, "👥"],
  [/\bcreator\b|\bstream(ing)?\b/, "🎬"],
  [/\bautomat(e|ion)/, "🤖"],
  [/\butility\b|\butilit/, "🧰"],
  [/\bmessaging\b|\bsms\b/, "💬"],
  [/\bvideo\b|\bstream\b/, "🎥"],
  [/\baudio\b|\bpodcast\b/, "🎧"],
  [/\bphoto\b|\bimage\b|\bcamera\b/, "📷"],
  [/\bnews\b|\bjournal/i, "🗞"],
  [/\bgames?\b|\bgaming\b/, "🎮"],
  [/\bsports?\b/, "⚽"],
  [/\bfitness\b|\bworkout\b/, "💪"],
  [/\bfood\b|\bcook/, "🍳"],
  [/\bbooks?\b|\bread(ing)?\b/, "📚"],
  [/\bwriting\b|\beditor\b|\bmarkdown\b/, "✏"],
  [/\bpublish/, "📖"],
  [/\bscience\b|\bresearch\b/, "🔬"],
  [/\blocation\b|\bmaps?\b/, "📍"],
  [/\bmarket(place)?\b|\bshop(ping)?\b/, "🛍"],
  [/\bconferenc/, "📞"],
  [/\bevents?\b|\bcalendar\b/, "📅"],
  [/\bexperiment\b|\babtest\b/, "🧪"],
  [/\bfeed\s*gen/, "📡"],
  [/\bproductiv/, "✅"],
  [/\bpersonal\s*page\b|\bprofile\b/, "👤"],
  [/\brole\s*play/, "🎭"],
  [/\breviews?\b|\bratings?\b/, "⭐"],
  [/\bannotate\b|\bnotes?\b/, "✍"],
  [/\bbookmarks?\b/, "🔖"],
  [/\baccount\b|\bauth\b|\blogin\b|\bsso\b/, "🪪"],
  [/\bdatabase\b|\bstore\b|\brepo\b/, "🗄"],
  [/\bnetwork(ing)?\b|\bsocket\b/, "🌐"],
  [/\bsecurity\b|\bencrypt\b|\bsso\b/, "🔒"],
  [/\blexicons?\b|\bschema\b/, "📜"],
  [/\bpds\b|\bpersonal\s*data/, "💾"],
  [/\bappview\b|\bapp\s*view\b/, "🔭"],
  [/\brelay\b/, "📡"],
  [/\bhost(ing)?\b|\binfra(structure)?\b|\bdeploy\b/, "🖥"],
  [/\bcli\b|\bterminal\b|\bconsole\b/, "⌨"],
  [/\bsdk\b|\blibrary\b|\bpackage\b/, "📦"],
  [/\bapi\b|\bgraphql\b|\brest\b/, "🔌"],
  [/\btool(s|ing)?\b|\bplugin\b|\bextension\b/, "🛠"],
  [/\bservice(s)?\b/, "🧩"],
];

const FALLBACK_EMOJI_POOL = [
  "📦",
  "🗂",
  "🧩",
  "🔧",
  "⚙",
  "📌",
  "🎯",
  "🔮",
  "🧭",
  "🗃",
  "📋",
  "💠",
  "🔷",
  "🧱",
  "🏷",
] as const;

function stripToolSuffix(normalized: string): string {
  return normalized
    .replace(/\s+tools$/, "")
    .replace(/\s+tool$/, "")
    .trim();
}

function appTagGlyphIfMapped(normalized: string): string | null {
  const glyph = APP_TAG_EMOJI[normalized] ?? null;
  if (!glyph || glyph === SPARKLE) {
    return null;
  }
  return glyph;
}

function stableFallbackEmoji(normalized: string): string {
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = Math.trunc(Math.imul(31, h) + (normalized.codePointAt(i) ?? 0));
  }
  const idx = Math.abs(h) % FALLBACK_EMOJI_POOL.length;
  return FALLBACK_EMOJI_POOL[idx] ?? FALLBACK_EMOJI_POOL[0];
}

export function getEcosystemCategoryEmoji(label: string): string {
  const n = normalizeAppTagKey(label);

  if (ECOSYSTEM_CATEGORY_EMOJI[n]) {
    return ECOSYSTEM_CATEGORY_EMOJI[n];
  }

  const fromApp = appTagGlyphIfMapped(n);
  if (fromApp) {
    return fromApp;
  }

  const stripped = stripToolSuffix(n);
  if (stripped !== n) {
    if (ECOSYSTEM_CATEGORY_EMOJI[stripped]) {
      return ECOSYSTEM_CATEGORY_EMOJI[stripped];
    }
    const fromStrippedApp = appTagGlyphIfMapped(stripped);
    if (fromStrippedApp) {
      return fromStrippedApp;
    }
  }

  for (const [re, emoji] of KEYWORD_EMOJI_RULES) {
    if (re.test(n)) {
      return emoji;
    }
  }

  return stableFallbackEmoji(n);
}
