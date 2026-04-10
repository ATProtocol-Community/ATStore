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

Task: Upscale and clean up faithfully for a software directory (small UI sizes). Preserve the brand mark, colors, and silhouette. Do not invent a different logo or unrelated symbol.

Format (required):
- Output must be exactly 1:1 — a square image (equal width and height).
- Do not add a separate container shape: no rounded-square plate, squircle, circle mask, glossy bubble, or drop-shadow tile behind the mark. The logo/mark sits on a flat fill or transparent background filling the square — not inside a second artificial shape.
- Padding is only empty margin around the mark, not an extra outlined or beveled "icon backing."

Style:
- Crisp edges; if the source is tiny, refine the intended mark without drifting to a new design.
- Transparent or flat background as appropriate; no fake device frames.

Constraints:
- No browser chrome, page screenshots, or unrelated decoration.
- No extra readable text unless it was essential in the tiny source mark.

Listing metadata:
${meta}`
}
