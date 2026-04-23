import { GENERATED_BANNER_RECORD_URLS } from "./generated-banner-record-urls";

export interface EcosystemHeroArtSpec {
  categoryId: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

export interface EcosystemHeroArtListingSummary {
  name: string;
  tagline?: string | null;
}

/**
 * Runtime context used to personalize an ecosystem hero prompt with real product
 * signals (platform description, representative listings, common app tags). All
 * fields are optional — when absent the prompt falls back to the static spec.
 */
export interface EcosystemHeroArtPromptContext {
  /** Display name of the app that owns the ecosystem (e.g. "Bluesky"). */
  appName?: string | null;
  /** Sub-branch label when generating for `apps/<name>/<sub>` (e.g. "Clients"). */
  branchLabel?: string | null;
  /** Short tagline from the canonical `apps/<name>` platform listing. */
  appTagline?: string | null;
  /** Long-form description from the canonical `apps/<name>` platform listing. */
  appDescription?: string | null;
  /** Number of verified listings in this branch (exact or descendant). */
  branchListingCount?: number;
  /** App tags that appear across listings in this branch, most common first. */
  commonAppTags?: readonly string[];
  /** A handful of representative listings in this branch (name + tagline). */
  representativeListings?: readonly EcosystemHeroArtListingSummary[];
}

const ECOSYSTEM_HERO_ART_SPECS: EcosystemHeroArtSpec[] = [
  {
    categoryId: "apps/bluesky",
    label: "Bluesky Ecosystem",
    assetPath: "/generated/ecosystem-heroes/bluesky.png",
    palettePrompt:
      "electric blue, cyan, indigo, lavender, soft coral, and glossy white highlights",
    subjectPrompt:
      "a premium ecosystem collage of rounded app cards, feed ribbons, social graph constellations, polished utility panels, and layered discovery surfaces",
  },
  {
    categoryId: "apps/bluesky/analytics",
    label: "Bluesky Analytics",
    assetPath: "/generated/ecosystem-heroes/bluesky-analytics.png",
    palettePrompt: "electric blue, cyan, indigo, and soft mint accents",
    subjectPrompt:
      "luminous dashboard arcs, trend lines, abstract reporting cards, clustered metrics, and polished data geometry for social products",
  },
  {
    categoryId: "apps/bluesky/client",
    label: "Bluesky Clients",
    assetPath: "/generated/ecosystem-heroes/bluesky-client.png",
    palettePrompt: "electric blue, cyan, violet, white, and subtle coral accents",
    subjectPrompt:
      "floating social app cards, clean feed columns, rounded navigation layers, polished conversation surfaces, and joyful consumer app energy",
  },
  {
    categoryId: "apps/bluesky/feed-generators",
    label: "Bluesky Feed Generators",
    assetPath: "/generated/ecosystem-heroes/bluesky-feed-generators.png",
    palettePrompt: "cyan, blue, purple, mint, and bright white highlights",
    subjectPrompt:
      "curving signal streams, modular ranking tiles, abstract feed channels, layered recommendation ribbons, and energetic discovery patterns",
  },
  {
    categoryId: "apps/bluesky/moderation",
    label: "Bluesky Moderation",
    assetPath: "/generated/ecosystem-heroes/bluesky-moderation.png",
    palettePrompt: "indigo, purple, blue, magenta, and controlled cyan accents",
    subjectPrompt:
      "protective shield-like layers, filter chips, calm control surfaces, trust boundaries, and structured safety dashboards with premium depth",
  },
  {
    categoryId: "apps/bluesky/scheduling",
    label: "Bluesky Scheduling",
    assetPath: "/generated/ecosystem-heroes/bluesky-scheduling.png",
    palettePrompt: "blue, cyan, mint, lavender, and warm coral accents",
    subjectPrompt:
      "timeline lanes, calendar-inspired cards, queued post modules, smooth automation trails, and organized publishing flow surfaces",
  },
  {
    categoryId: "apps/bluesky/tool",
    label: "Bluesky Tools",
    assetPath: "/generated/ecosystem-heroes/bluesky-tool.png",
    palettePrompt: "bright blue, icy cyan, mint, white, and deep indigo accents",
    subjectPrompt:
      "compact helper widgets, utility panels, modular controls, polished workflow tiles, and crisp functional product shapes",
  },
];

const ecosystemHeroArtSpecByCategoryId = new Map(
  ECOSYSTEM_HERO_ART_SPECS.map((spec) => [spec.categoryId, spec]),
);

export function getEcosystemHeroArtSpec(categoryId: string) {
  const fromStatic = ecosystemHeroArtSpecByCategoryId.get(categoryId);
  if (fromStatic) {
    return fromStatic;
  }

  return buildDefaultEcosystemHeroArtSpec(categoryId);
}

export function getEcosystemHeroAssetPathForCategory(categoryId: string) {
  const assetPath = getEcosystemHeroArtSpec(categoryId)?.assetPath;
  if (!assetPath) {
    return null;
  }

  return GENERATED_BANNER_RECORD_URLS[assetPath] ? assetPath : null;
}

export function getEcosystemHeroArtPrompt(
  spec: EcosystemHeroArtSpec,
  context?: EcosystemHeroArtPromptContext,
) {
  const lines: string[] = [
    `Create a premium App Store-style hero illustration for the "${spec.label}" ecosystem category.`,
    `Theme: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
  ];

  const contextLines = buildEcosystemPromptContextLines(context);
  if (contextLines.length > 0) {
    lines.push(...contextLines);
  }

  lines.push(
    "Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.",
    "Use soft 3D gradients, glossy lighting, rounded cards, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.",
    "Composition: wide 16:9 banner, generous calm negative space on the left for headline and CTA overlay, with richer decorative energy on the right side.",
    "Show layered foreground, midground, and background depth with floating app-like tiles and abstract interface hints.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render words, letters, numbers, badges, logos, glyphs, UI chrome, watermarks, or pseudo-text.",
    "No people, no device mockups, and no realistic screenshots.",
  );

  return lines.join(" ");
}

function buildEcosystemPromptContextLines(
  context: EcosystemHeroArtPromptContext | undefined,
): string[] {
  if (!context) {
    return [];
  }

  const lines: string[] = [];

  if (context.appName) {
    const branch =
      context.branchLabel && context.branchLabel.toLowerCase() !== "ecosystem"
        ? `, specifically the "${context.branchLabel}" sub-ecosystem`
        : "";
    const countSuffix =
      typeof context.branchListingCount === "number" && context.branchListingCount > 0
        ? ` (${context.branchListingCount} verified listings)`
        : "";
    lines.push(
      `Ecosystem context: this hero represents the ${context.appName} ecosystem${branch}${countSuffix}.`,
    );
  }

  const tagline = cleanAndTruncate(context.appTagline, 220);
  if (tagline) {
    lines.push(`Platform tagline: ${tagline}.`);
  }

  const description = cleanAndTruncate(context.appDescription, 520);
  if (description) {
    lines.push(`Platform description: ${description}.`);
  }

  const tags = (context.commonAppTags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (tags.length > 0) {
    lines.push(`Common app categories in this branch: ${tags.join(", ")}.`);
  }

  const listings = (context.representativeListings ?? [])
    .map((listing) => ({
      name: listing.name?.trim() ?? "",
      tagline: cleanAndTruncate(listing.tagline ?? null, 100),
    }))
    .filter((listing) => listing.name.length > 0)
    .slice(0, 6);
  if (listings.length > 0) {
    const formatted = listings
      .map((listing) =>
        listing.tagline ? `${listing.name} — ${listing.tagline}` : listing.name,
      )
      .join("; ");
    lines.push(`Representative listings to evoke (do not depict literally): ${formatted}.`);
  }

  if (lines.length > 0) {
    lines.push(
      "Use these product signals to inform mood, metaphors, and motifs so the art feels unmistakably on-brand for this ecosystem, while still producing an abstract editorial illustration.",
    );
  }

  return lines;
}

function cleanAndTruncate(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export { ECOSYSTEM_HERO_ART_SPECS };

export interface EcosystemHeroArtContextListingRow {
  name: string;
  tagline?: string | null;
  fullDescription?: string | null;
  categorySlugs?: readonly string[] | null;
  appTags?: readonly (string | null | undefined)[] | null;
}

/**
 * Builds an {@link EcosystemHeroArtPromptContext} from raw listing rows for the
 * ecosystem category identified by `categoryId` (e.g. `apps/bluesky` or
 * `apps/bluesky/client`). Rows should ideally be pre-filtered to verified
 * listings; this function only handles normalization and branch filtering.
 *
 * The "platform listing" — whose `fullDescription` and `tagline` anchor the
 * prompt — is the listing whose primary (first) category slug equals
 * `apps/<name>` exactly. Representative listings and tag counts are sourced
 * from the branch (exact or descendant match).
 */
export function deriveEcosystemHeroArtContext(
  categoryId: string,
  rows: readonly EcosystemHeroArtContextListingRow[],
): EcosystemHeroArtPromptContext | null {
  const parts = categoryId.trim().toLowerCase().split("/").filter(Boolean);
  if (parts[0] !== "apps" || !parts[1]) {
    return null;
  }

  const rootCategoryId = `apps/${parts[1]}`;
  const branchCategoryId = parts.slice(0, 3).join("/");
  const branchPrefix = `${branchCategoryId}/`;

  const branchRows: EcosystemHeroArtContextListingRow[] = [];
  let platformRow: EcosystemHeroArtContextListingRow | null = null;

  for (const row of rows) {
    const slugs = (row.categorySlugs ?? [])
      .map((slug) => slug?.trim().toLowerCase() ?? "")
      .filter(Boolean);
    if (slugs.length === 0) continue;

    if (!platformRow && slugs[0] === rootCategoryId) {
      platformRow = row;
    }

    const matchesBranch = slugs.some(
      (slug) => slug === branchCategoryId || slug.startsWith(branchPrefix),
    );
    if (matchesBranch) {
      branchRows.push(row);
    }
  }

  if (!platformRow && branchRows.length === 0) {
    return null;
  }

  const tagCounts = new Map<string, number>();
  for (const row of branchRows) {
    for (const rawTag of row.appTags ?? []) {
      const tag = rawTag?.trim();
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const commonAppTags = [...tagCounts.entries()]
    .sort(
      (left, right) =>
        right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([tag]) => tag);

  const representativeListings = branchRows
    .filter((row) => row !== platformRow)
    .map((row) => ({
      name: row.name,
      tagline: row.tagline ?? null,
    }))
    .filter((listing) => listing.name.trim().length > 0)
    .slice(0, 8);

  const fullOption = getEcosystemBranchLabels(parts);

  return {
    appName: fullOption.appName,
    branchLabel: fullOption.branchLabel,
    appTagline: platformRow?.tagline ?? null,
    appDescription: platformRow?.fullDescription ?? null,
    branchListingCount: branchRows.length,
    commonAppTags,
    representativeListings,
  };
}

function getEcosystemBranchLabels(parts: string[]): {
  appName: string;
  branchLabel: string | null;
} {
  const appName = formatSegmentTitleCase(parts[1] ?? "");
  if (parts.length <= 2) {
    return { appName, branchLabel: null };
  }

  const last = parts[parts.length - 1] ?? "";
  return {
    appName,
    branchLabel: formatSegmentTitleCase(last.replace(/-/g, " ")),
  };
}

function buildDefaultEcosystemHeroArtSpec(
  categoryId: string,
): EcosystemHeroArtSpec | null {
  const segments = categoryId
    .trim()
    .toLowerCase()
    .split("/")
    .filter(Boolean);

  if (segments.length < 2 || segments[0] !== "apps") {
    return null;
  }

  const assetSlug = segments.slice(1).join("-");
  if (!assetSlug) {
    return null;
  }

  const appName = formatSegmentTitleCase(segments[1] ?? "App");
  const branchLabel =
    segments.length > 2
      ? formatSegmentTitleCase((segments[segments.length - 1] ?? "Category").replace(
          /-/g,
          " ",
        ))
      : "Ecosystem";
  const label = `${appName} ${branchLabel}`.trim();

  return {
    categoryId: segments.join("/"),
    label,
    assetPath: `/generated/ecosystem-heroes/${assetSlug}.png`,
    palettePrompt:
      "electric blue, cyan, indigo, violet, mint, and soft white highlights",
    subjectPrompt: `premium abstract ecosystem artwork for "${label}" with polished app cards, layered social surfaces, modular utility panels, and dynamic discovery pathways`,
  };
}

function formatSegmentTitleCase(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
