export interface EcosystemHeroArtSpec {
  categoryId: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
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
  return ecosystemHeroArtSpecByCategoryId.get(categoryId) ?? null;
}

export function getEcosystemHeroAssetPathForCategory(categoryId: string) {
  return getEcosystemHeroArtSpec(categoryId)?.assetPath ?? null;
}

export function getEcosystemHeroArtPrompt(spec: EcosystemHeroArtSpec) {
  return [
    `Create a premium App Store-style hero illustration for the "${spec.label}" ecosystem category.`,
    `Theme: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
    "Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.",
    "Use soft 3D gradients, glossy lighting, rounded cards, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.",
    "Composition: wide 16:9 banner, generous calm negative space on the left for headline and CTA overlay, with richer decorative energy on the right side.",
    "Show layered foreground, midground, and background depth with floating app-like tiles and abstract interface hints.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render words, letters, numbers, badges, logos, glyphs, UI chrome, watermarks, or pseudo-text.",
    "No people, no device mockups, and no realistic screenshots.",
  ].join(" ");
}

export { ECOSYSTEM_HERO_ART_SPECS };
