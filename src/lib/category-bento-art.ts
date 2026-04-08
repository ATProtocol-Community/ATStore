export type CategoryBentoAccent = "blue" | "pink" | "purple" | "green";

export interface CategoryBentoArtSpec {
  label: string;
  accent: CategoryBentoAccent;
  slug: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

const CATEGORY_BENTO_ART_SPECS: CategoryBentoArtSpec[] = [
  {
    label: "Account Tool",
    accent: "blue",
    slug: "account-tool",
    assetPath: "/generated/category-bento/account-tool.png",
    palettePrompt: "electric blue, frosted cyan, bright white highlights",
    subjectPrompt:
      "floating profile cards, clean settings dials, secure account controls, polished glass layers",
  },
  {
    label: "Analytics Tool",
    accent: "blue",
    slug: "analytics-tool",
    assetPath: "/generated/category-bento/analytics-tool.png",
    palettePrompt: "azure blue, cobalt glow, pale sky reflections",
    subjectPrompt:
      "luminous charts, abstract bar graphs, trend arcs, dashboard geometry, premium data visualization shapes",
  },
  {
    label: "Automation",
    accent: "green",
    slug: "automation",
    assetPath: "/generated/category-bento/automation.png",
    palettePrompt: "emerald, jade, mint highlights",
    subjectPrompt:
      "connected workflow nodes, elegant motion paths, smart triggers, modular system blocks",
  },
  {
    label: "Community",
    accent: "green",
    slug: "community",
    assetPath: "/generated/category-bento/community.png",
    palettePrompt: "jade green, seafoam, soft lime reflections",
    subjectPrompt:
      "interconnected circles, group constellations, shared spaces, friendly abstract people forms",
  },
  {
    label: "Creator Tool",
    accent: "pink",
    slug: "creator-tool",
    assetPath: "/generated/category-bento/creator-tool.png",
    palettePrompt: "vivid pink, magenta, warm violet highlights",
    subjectPrompt:
      "creative studio objects, sparkles, camera-like forms, composition boards, glossy editorial shapes",
  },
  {
    label: "Design",
    accent: "purple",
    slug: "design",
    assetPath: "/generated/category-bento/design.png",
    palettePrompt: "violet, lavender, orchid glow",
    subjectPrompt:
      "3D color swatches, bezier curves, layout blocks, premium interface composition, glossy sculptural tools",
  },
  {
    label: "Developer Tool",
    accent: "purple",
    slug: "developer-tool",
    assetPath: "/generated/category-bento/developer-tool.png",
    palettePrompt: "violet, indigo, neon lilac accents",
    subjectPrompt:
      "code blocks, API nodes, terminal windows, abstract systems architecture, sleek engineering shapes",
  },
  {
    label: "Moderation",
    accent: "green",
    slug: "moderation",
    assetPath: "/generated/category-bento/moderation.png",
    palettePrompt: "emerald, cool teal, soft silver light",
    subjectPrompt:
      "protective shields, filters, trust indicators, calm control surfaces, abstract safety systems",
  },
  {
    label: "Social",
    accent: "pink",
    slug: "social",
    assetPath: "/generated/category-bento/social.png",
    palettePrompt: "rose pink, cherry, purple neon accents",
    subjectPrompt:
      "conversation bubbles, social graph constellations, connection trails, energetic floating cards",
  },
  {
    label: "Utility",
    accent: "blue",
    slug: "utility",
    assetPath: "/generated/category-bento/utility.png",
    palettePrompt: "bright blue, icy cyan, clean white reflections",
    subjectPrompt:
      "compact tools, toggles, smart widgets, organized modules, crisp functional interface objects",
  },
];

const specByLabel = new Map(
  CATEGORY_BENTO_ART_SPECS.map((spec) => [spec.label.toLowerCase(), spec]),
);

export function formatCategoryLabel(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return value;
  }

  const shouldTitleCase =
    /[_-]/.test(value) ||
    value === value.toLowerCase() ||
    value === value.toUpperCase();

  if (!shouldTitleCase) {
    return normalized;
  }

  return normalized
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getCategoryBentoArtSpec(label: string) {
  return specByLabel.get(formatCategoryLabel(label).toLowerCase()) ?? null;
}

export function getCategoryBentoArtPrompt(spec: CategoryBentoArtSpec) {
  return [
    "Create a premium App Store editorial illustration for a category card.",
    `Category: ${spec.label}.`,
    `Subject matter: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
    "Style: glossy 3D objects, soft gradients, dramatic but clean lighting, polished reflections, tasteful depth, minimal background noise.",
    "Composition: landscape image designed for a product category bento card, central focus, room for overlay text, high contrast focal area.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render letters, words, numbers, symbols, badges, logos, labels, icons with embedded glyphs, UI chrome, watermarks, or brand marks.",
    "Avoid anything that could read as typography or signage, even abstract pseudo-text.",
    "No device mockups, no UI screenshots, and no interface panels containing written content.",
  ].join(" ");
}

export { CATEGORY_BENTO_ART_SPECS };
