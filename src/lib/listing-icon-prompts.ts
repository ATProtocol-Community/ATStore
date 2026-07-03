/**
 * Prompts for directory listing icon generation (screenshot vs site asset polish).
 */

export function buildIconPolishFromSiteAssetPrompt(input: {
  name: string
  pageUrl: string
  tagline: string | null
  productType: string | null
  domain: string | null
  scope: string | null
}): string {
  const meta = [
    `Name: ${input.name}`,
    `URL: ${input.pageUrl}`,
    input.tagline ? `Tagline: ${input.tagline}` : null,
    input.productType ? `Product type: ${input.productType}` : null,
    input.domain ? `Domain: ${input.domain}` : null,
    input.scope ? `Scope: ${input.scope}` : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join('\n')

  return `You are given an existing site icon, favicon, or logo image (it may be very small, pixelated, or multi-resolution .ico).

Task — **upscale and sharpen only** (like a higher-res export + mild sharpening). The output must be **visually the same artwork** as the input: same shapes, same layout, same proportions, same colors (no recoloring), same style (flat vs gradient vs pixel art). **Do not redesign, simplify, “improve”, add detail, remove detail, change line weight, round or square off corners differently, add outlines, glows, textures, or shadows that were not in the source.**

If the source is pixel art or a crisp tiny favicon, preserve that character — only make it **sharper** and **larger**, not smoother in a way that changes the design.

Format (required):
- Output must be exactly 1:1 — a square image (equal width and height).
- Do not add a separate container shape: no rounded-square plate, squircle, circle mask, glossy bubble, or drop-shadow tile behind the mark. The logo/mark sits on a flat fill or transparent background filling the square — not inside a second artificial shape.
- Padding is only empty margin around the mark, not an extra outlined or beveled "icon backing."

Constraints:
- No browser chrome, page screenshots, or unrelated decoration.
- No new readable text; keep any text from the source only if it was already there, unchanged in wording.

Listing metadata:
${meta}`
}
