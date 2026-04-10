import { getDirectoryCategoryOption } from "./directory-categories";

export interface ProtocolCategoryCoverArtSpec {
  /** Second path segment, e.g. `pds` for `protocol/pds`. */
  segment: string;
  label: string;
  assetPath: string;
  palettePrompt: string;
  subjectPrompt: string;
}

/**
 * Curated prompts for known protocol categories. Unknown segments still get
 * {@link getProtocolCategoryCoverArtSpecForSegment} with generic prompts.
 */
const PROTOCOL_CATEGORY_COVER_SPECS: ProtocolCategoryCoverArtSpec[] = [
  {
    segment: "pds",
    label: "PDS",
    assetPath: "/generated/protocol-categories/pds.png",
    palettePrompt:
      "deep indigo, electric violet, cyan highlights, cool white reflections, and subtle magenta accents",
    subjectPrompt:
      "abstract personal data server motifs: secure vault-like layers, encrypted shard shapes, distributed storage nodes, trustworthy sync ribbons, and polished decentralized identity infrastructure without literal logos",
  },
  {
    segment: "appview",
    label: "AppView",
    assetPath: "/generated/protocol-categories/appview.png",
    palettePrompt:
      "electric blue, cyan, teal, lavender, and crisp white highlights",
    subjectPrompt:
      "abstract feed aggregation and view-layer concepts: flowing record streams, indexed ribbons, lightweight query surfaces, structured data lanes, and polished read-path infrastructure for social protocols",
  },
];

const protocolCoverSpecBySegment = new Map(
  PROTOCOL_CATEGORY_COVER_SPECS.map((spec) => [spec.segment, spec]),
);

function formatSegmentTitleCase(segment: string) {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Build or resolve a cover spec for a URL segment (e.g. from `/protocol/pds`).
 */
export function getProtocolCategoryCoverArtSpecForSegment(
  segment: string,
  displayLabel?: string,
): ProtocolCategoryCoverArtSpec {
  const normalized = segment.trim().toLowerCase();
  const fromStatic = protocolCoverSpecBySegment.get(normalized);
  if (fromStatic) {
    return fromStatic;
  }

  const label = displayLabel?.trim() || formatSegmentTitleCase(normalized);

  return {
    segment: normalized,
    label,
    assetPath: `/generated/protocol-categories/${normalized}.png`,
    palettePrompt:
      "electric blue, cyan, indigo, violet, mint, and soft white highlights",
    subjectPrompt: `abstract AT Protocol infrastructure illustration evoking "${label}": modular service tiles, protocol stack layers, decentralized network motifs, polished developer-energy geometry, and trustworthy systems depth—no literal brand marks`,
  };
}

/**
 * Resolve cover art from a full category slug such as `protocol/pds`.
 */
export function getProtocolCategoryCoverArtSpecForCategorySlug(
  categorySlug: string | null | undefined,
): ProtocolCategoryCoverArtSpec | null {
  const option = getDirectoryCategoryOption(categorySlug);
  if (!option || option.pathIds[0] !== "protocol" || option.pathIds.length !== 2) {
    return null;
  }

  const segment = option.pathIds[1] ?? "";
  if (!segment) {
    return null;
  }

  const base = getProtocolCategoryCoverArtSpecForSegment(segment, option.label);
  return {
    ...base,
    label: option.label,
  };
}

export function getProtocolCategoryCoverAssetPathForSegment(
  segment: string,
): string | null {
  if (!segment.trim()) {
    return null;
  }

  return getProtocolCategoryCoverArtSpecForSegment(segment).assetPath;
}

export function getProtocolCategoryCoverArtPrompt(spec: ProtocolCategoryCoverArtSpec) {
  return [
    `Create a premium editorial card cover illustration for the "${spec.label}" protocol directory category (AT Protocol / decentralized social stack).`,
    `Theme: ${spec.subjectPrompt}.`,
    `Palette: ${spec.palettePrompt}.`,
    "Style: bright, colorful, playful, polished, high-end product marketing art with soft 3D gradients and luminous highlights.",
    "Composition: square or 4:3, full-bleed decorative cover suitable behind white headline text and a small footer row—richer detail toward the bottom and edges, slightly calmer region behind where titles sit.",
    "Critical constraint: the generated image must contain zero text of any kind.",
    "Do not render words, letters, numbers, badges, logos, glyphs, UI chrome, watermarks, or pseudo-text.",
    "No people, no device mockups, and no realistic screenshots.",
  ].join(" ");
}

export { PROTOCOL_CATEGORY_COVER_SPECS };
