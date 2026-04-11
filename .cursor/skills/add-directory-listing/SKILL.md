---
name: add-directory-listing
description: Add or update manual directory listings in at-store, including copy, taxonomy, branding assets, fallback handcrafted icons, and optional DB import. Use when the user asks to add a listing, provider, app, protocol service, PDS, or product from a website into the directory.
---

# Add Directory Listing

## Goal

Add a new manual listing to the at-store directory with:

- copy
- taxonomy
- local assets
- AI-generated icon/hero candidates when helpful
- JSON source entry
- optional DB import

Use the repo script for the repetitive parts and do lightweight research for the judgment calls.
Default to `--no-import` unless the user explicitly asks for DB import.

## Inputs to gather

- Listing name
- Canonical source URL
- External URL
- Category slug such as `protocol/pds` or `apps/bluesky/analytics`
- Tagline
- Full description
- Taxonomy fields when known:
  `rawCategoryHint`, `scope`, `productType`, `domain`, `vertical`, `classificationReason`

## Workflow

1. Inspect the target website for:
   - product name
   - concise tagline
   - fuller description
   - logo, favicon, or `og:image`
2. Prefer local assets over remote runtime URLs.
   - Download useful brand assets into `public/generated/listings/`
   - If the site has no good square icon, first try the in-app `Generate icon` dev action to create a local candidate from the homepage screenshot
   - The generated icon prompt uses style fallbacks: brand mark first, then motif/monogram from the wordmark, then a restrained gradient-plus-symbol treatment for weak branding
   - If the generated result still feels generic or off-brand, create a simple local SVG icon inspired by the branding instead
3. Add or update the manual source entry with `npm run listing:add -- ... --no-import`
4. Publish to ATProto (preferred default):
   - `pnpm listing:publish-store <slug-or-uuid>`
5. Verify DB import only if the user explicitly asked for import.

## Asset rules

- Prefer a strong standalone mark over a wordmark screenshot.
- Prefer SVG for handcrafted icons.
- Use filenames like `<slug>-icon.svg`, `<slug>-logo.png`, `<slug>-screenshot.png`.
- Keep icons readable at small sizes.
- Treat AI-generated icons as drafts to review, not guaranteed final assets.
- When handcrafting an icon, stay close to the site's visual language instead of inventing a new brand.

## Script

Primary command:

```bash
npm run listing:add -- --name "Product" --source-url "https://source" --category-slug "protocol/pds" --no-import ...
```

Common flags:

- `--external-url`
- `--tagline`
- `--description`
- `--raw-category-hint`
- `--scope`
- `--product-type`
- `--domain`
- `--vertical`
- `--classification-reason`
- `--icon-url`
- `--screenshot-url` (repeatable)
- `--icon-asset-url`
- `--screenshot-asset-url` (repeatable)
- `--asset-slug`
- `--no-import`
- `--dry-run`

Publish command:

```bash
pnpm listing:publish-store <slug-or-uuid>
```

## When to handcraft an icon

Create a local SVG icon when:

- the AI-generated icon still looks generic, blurry, or off-brand
- the available logo is only a wide wordmark
- the favicon is missing or low quality
- the social card is usable as a header image but not as an avatar/icon

Good fallback pattern:

- square canvas
- 1 core brand motif
- restrained gradient or neutral background
- high contrast
- no tiny text

## Verification

- Confirm `out/manual-directory-listings.json` contains the intended record.
- Confirm downloaded/generated assets exist under `public/generated/listings/`.
- If you used the in-app generator, confirm the resulting `iconUrl` or `screenshotUrls[0]` point at local generated assets.
- If published, confirm the command returns an `at://` URI.
- If imported (explicit opt-in), confirm the listing row resolves to the expected `iconUrl` and `categorySlug`.

## Examples

- Command examples: [examples.md](examples.md)
