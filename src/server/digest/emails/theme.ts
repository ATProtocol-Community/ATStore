/** Palette + helpers shared by the digest emails (light values; dark mode lives in `EmailHead`). */
export const c = {
  page: "#f4f6f9",
  card: "#ffffff",
  ink: "#1c2024",
  soft: "#60646c",
  muted: "#8b8d98",
  line: "#e0e1e6",
  accent: "#2870bd",
  white: "#ffffff",
};

export const sans =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Logo palette, used for the initial tile when an app has no icon. */
const ICON_TONES = ["#4058a7", "#219546", "#6dacde", "#86af58", "#2870bd"];

export function iconTone(seed: string): string {
  let hash = 0;
  for (const ch of seed) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return ICON_TONES[hash % ICON_TONES.length] ?? "#2870bd";
}
