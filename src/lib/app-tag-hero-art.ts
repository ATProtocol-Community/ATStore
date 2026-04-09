export interface AppTagHeroArtSpec {
  slug: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

const APP_TAG_HERO_ART_SPECS: AppTagHeroArtSpec[] = [
  {
    slug: "all",
    label: "Browse Apps by Tag",
    assetPath: "/generated/app-tag-heroes/all.png",
    palettePrompt:
      "electric blue, cyan, pink, purple, coral, mint, and small sunny yellow highlights",
    subjectPrompt:
      "a premium app marketplace ecosystem with floating rounded app cards, glass panels, glowing blobs, layered interface fragments, and joyful editorial energy",
  },
  {
    slug: "all-apps",
    label: "Browse All Apps",
    assetPath: "/generated/app-tag-heroes/all-apps.png",
    palettePrompt:
      "electric blue, cyan, pink, purple, coral, mint, and glossy white highlights",
    subjectPrompt:
      "a premium catalog of floating app cards, polished discovery tiles, abstract interface layers, rounded glass panels, and vibrant editorial marketplace energy",
  },
  {
    slug: "account-tool",
    label: "Account Tool",
    assetPath: "/generated/app-tag-heroes/account-tool.png",
    palettePrompt: "electric blue, frosted cyan, clean white reflections",
    subjectPrompt:
      "floating profile cards, polished settings controls, identity layers, secure account surfaces, and tidy utility shapes",
  },
  {
    slug: "analytics",
    label: "Analytics",
    assetPath: "/generated/app-tag-heroes/analytics.png",
    palettePrompt: "electric blue, cyan, indigo, and soft mint accents",
    subjectPrompt:
      "luminous chart arcs, abstract dashboards, data dots, trend waves, and premium reporting geometry",
  },
  {
    slug: "automation",
    label: "Automation",
    assetPath: "/generated/app-tag-heroes/automation.png",
    palettePrompt: "mint, green, cyan, blue, and warm yellow accents",
    subjectPrompt:
      "connected workflow nodes, elegant motion trails, triggers, modular tiles, and smooth systems choreography",
  },
  {
    slug: "community",
    label: "Community",
    assetPath: "/generated/app-tag-heroes/community.png",
    palettePrompt: "purple, pink, lavender, blue, and coral accents",
    subjectPrompt:
      "clustered conversation bubbles, orbiting circles, shared spaces, connection lines, and friendly gathering shapes",
  },
  {
    slug: "creator-tool",
    label: "Creator Tool",
    assetPath: "/generated/app-tag-heroes/creator-tool.png",
    palettePrompt: "pink, coral, violet, blue, and warm gold accents",
    subjectPrompt:
      "playful studio objects, sparkles, composition boards, layered media tiles, and glossy creative energy",
  },
  {
    slug: "design",
    label: "Design",
    assetPath: "/generated/app-tag-heroes/design.png",
    palettePrompt: "pink, coral, purple, blue, and warm yellow accents",
    subjectPrompt:
      "layered color swatches, bezier curves, soft blobs, vector-like forms, and sculptural design tools",
  },
  {
    slug: "developer-tool",
    label: "Developer Tool",
    assetPath: "/generated/app-tag-heroes/developer-tool.png",
    palettePrompt: "green, cyan, blue, and deep indigo accents",
    subjectPrompt:
      "modular blocks, code-like grids, glowing nodes, abstract terminal forms, and polished systems diagrams",
  },
  {
    slug: "moderation",
    label: "Moderation",
    assetPath: "/generated/app-tag-heroes/moderation.png",
    palettePrompt: "purple, indigo, blue, and controlled magenta accents",
    subjectPrompt:
      "shield-like forms, filters, calm control surfaces, protective boundaries, and structured trust layers",
  },
  {
    slug: "messaging",
    label: "Messaging",
    assetPath: "/generated/app-tag-heroes/messaging.png",
    palettePrompt: "blue, cyan, violet, and soft coral accents",
    subjectPrompt:
      "conversation threads, direct message bubbles, connection paths, private communication layers, and clean social signal shapes",
  },
  {
    slug: "personal-page",
    label: "Personal Page",
    assetPath: "/generated/app-tag-heroes/personal-page.png",
    palettePrompt: "sky blue, pink, white, lavender, and soft gold accents",
    subjectPrompt:
      "profile-inspired cards, elegant identity frames, link hubs, polished personal brand surfaces, and expressive layout shapes",
  },
  {
    slug: "publishing",
    label: "Publishing",
    assetPath: "/generated/app-tag-heroes/publishing.png",
    palettePrompt: "indigo, cobalt, violet, warm coral, and paper-white highlights",
    subjectPrompt:
      "editorial cards, story panels, layered pages, flowing article ribbons, and polished creator publishing scenes",
  },
  {
    slug: "games",
    label: "Games",
    assetPath: "/generated/app-tag-heroes/games.png",
    palettePrompt: "electric blue, neon purple, pink, mint, and warm gold highlights",
    subjectPrompt:
      "playful game pieces, glowing paths, arcade-inspired abstract geometry, motion trails, and joyful competitive energy",
  },
  {
    slug: "social",
    label: "Social",
    assetPath: "/generated/app-tag-heroes/social.png",
    palettePrompt: "pink, purple, blue, cyan, and coral accents",
    subjectPrompt:
      "conversation bubbles, social graph constellations, energetic floating cards, connection trails, and playful motion",
  },
  {
    slug: "utility",
    label: "Utility",
    assetPath: "/generated/app-tag-heroes/utility.png",
    palettePrompt: "bright blue, icy cyan, white, and subtle mint accents",
    subjectPrompt:
      "smart widgets, toggles, compact helper tools, organized modules, and crisp functional interface objects",
  },
];

const appTagHeroArtSpecBySlug = new Map(
  APP_TAG_HERO_ART_SPECS.map((spec) => [spec.slug, spec]),
);

export function getAppTagHeroArtSpec(slug: string) {
  return appTagHeroArtSpecBySlug.get(slug) ?? buildDefaultAppTagHeroArtSpec(slug);
}

export function getAppTagHeroArtSpecForTag(tag: string) {
  const normalized = tag.trim().toLowerCase();

  if (normalized === "account tool") return getAppTagHeroArtSpec("account-tool");
  if (normalized === "creator tool") return getAppTagHeroArtSpec("creator-tool");
  if (normalized === "developer tool") {
    return getAppTagHeroArtSpec("developer-tool");
  }
  if (normalized === "personal page") return getAppTagHeroArtSpec("personal-page");

  return getAppTagHeroArtSpec(normalized.replace(/\s+/g, "-"));
}

export function getAppTagHeroAssetPathForTag(tag: string) {
  return getAppTagHeroArtSpecForTag(tag)?.assetPath ?? null;
}

export function getAppTagHeroArtPrompt(spec: AppTagHeroArtSpec) {
  return [
    `Create a premium App Store-style hero illustration for the "${spec.label}" app collection page.`,
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

export { APP_TAG_HERO_ART_SPECS };

function buildDefaultAppTagHeroArtSpec(slug: string): AppTagHeroArtSpec {
  const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const cleanedSlug = normalizedSlug.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const safeSlug = cleanedSlug || "misc";
  const label = safeSlug
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  return {
    slug: safeSlug,
    label,
    assetPath: `/generated/app-tag-heroes/${safeSlug}.png`,
    palettePrompt: "electric blue, pink, purple, cyan, mint, and bright white highlights",
    subjectPrompt: `premium abstract editorial shapes that evoke ${label.toLowerCase()} apps, with floating cards, layered glass panels, and polished product energy`,
  };
}
