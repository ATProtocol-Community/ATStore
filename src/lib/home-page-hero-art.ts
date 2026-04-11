export interface HomePageHeroArtSpec {
  heroId: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

const HOME_PAGE_HERO_ART_SPECS: HomePageHeroArtSpec[] = [
  {
    heroId: "home-og",
    label: "at-store Home",
    assetPath: "/generated/home-page-heroes/home-og.png",
    palettePrompt:
      "electric blue, cyan, violet, pink, mint, deep indigo, and crisp white highlights",
    subjectPrompt:
      "a premium cross-category app marketplace scene for the Atmosphere with floating app cards, polished protocol surfaces, abstract social and developer motifs, layered glass panes, and smooth discovery pathways",
  },
];

const homePageHeroArtSpecById = new Map(
  HOME_PAGE_HERO_ART_SPECS.map((spec) => [spec.heroId, spec]),
);

export function getHomePageHeroArtSpec(heroId: string) {
  return homePageHeroArtSpecById.get(heroId) ?? null;
}

export function getHomePageHeroArtPrompt(spec: HomePageHeroArtSpec) {
  return [
    `Create a premium App Store-style hero illustration for the "${spec.label}" social share image.`,
    `Theme: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
    "Style: bright, colorful, playful, polished, editorial, and high-end product marketing art.",
    "Use soft 3D gradients, glossy lighting, translucent glass layers, luminous highlights, and subtle depth.",
    "Composition: wide 1200x630 social card layout with calm negative space on the left and richer decorative energy on the right.",
    "Show layered foreground, midground, and background depth with floating app-like tiles and abstract protocol-inspired structure.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render words, letters, numbers, badges, logos, glyphs, UI chrome, watermarks, or pseudo-text.",
    "No people, no device mockups, and no realistic screenshots.",
  ].join(" ");
}

export { HOME_PAGE_HERO_ART_SPECS };
