export interface ProtocolPageHeroArtSpec {
  heroId: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

const PROTOCOL_PAGE_HERO_ART_SPECS: ProtocolPageHeroArtSpec[] = [
  {
    heroId: "tags",
    label: "Protocol Categories",
    assetPath: "/generated/protocol-page-heroes/tags.png",
    palettePrompt:
      "electric blue, cyan, teal, lavender, deep indigo, violet, mint, and crisp white highlights",
    subjectPrompt:
      "a premium overview of the AT Protocol infrastructure stack with layered service tiles, flowing record ribbons, secure node clusters, index surfaces, sync paths, and abstract systems geometry that blends personal data server and appview motifs without literal logos",
  },
  {
    heroId: "listings",
    label: "Protocol Listings",
    assetPath: "/generated/protocol-page-heroes/listings.png",
    palettePrompt:
      "electric blue, cyan, teal, lavender, indigo, mint, and crisp white highlights",
    subjectPrompt:
      "a premium browse-and-search view of the AT Protocol ecosystem with polished infrastructure cards, flowing query lanes, stacked service surfaces, linked data pathways, and abstract directory-like discovery geometry without literal logos",
  },
  {
    heroId: "search",
    label: "All Listings Search",
    assetPath: "/generated/protocol-page-heroes/search.png",
    palettePrompt:
      "electric blue, cyan, violet, pink, mint, deep indigo, and crisp white highlights",
    subjectPrompt:
      "a premium cross-category search experience spanning apps and protocol tools, with floating listing cards, glassy query surfaces, discovery paths, layered metadata chips, and abstract marketplace navigation energy",
  },
];

const protocolPageHeroArtSpecById = new Map(
  PROTOCOL_PAGE_HERO_ART_SPECS.map((spec) => [spec.heroId, spec]),
);

export function getProtocolPageHeroArtSpec(heroId: string) {
  return protocolPageHeroArtSpecById.get(heroId) ?? null;
}

export function getProtocolPageHeroArtPrompt(spec: ProtocolPageHeroArtSpec) {
  return [
    `Create a premium App Store-style hero illustration for the "${spec.label}" AT Protocol directory page.`,
    `Theme: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
    "Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.",
    "Use soft 3D gradients, glossy lighting, translucent glass layers, luminous highlights, subtle depth, and a sense of motion and delight.",
    "Composition: wide 16:9 banner, generous calm negative space on the left for headline and CTA overlay, with richer decorative energy on the right side.",
    "Show layered foreground, midground, and background depth with floating infrastructure-like tiles, abstract protocol stack motifs, and flowing network paths.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render words, letters, numbers, badges, logos, glyphs, UI chrome, watermarks, or pseudo-text.",
    "No people, no device mockups, and no realistic screenshots.",
  ].join(" ");
}

export { PROTOCOL_PAGE_HERO_ART_SPECS };
