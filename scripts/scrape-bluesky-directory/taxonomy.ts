/**
 * Structured taxonomy for Bluesky / AT Protocol listings.
 *
 * We intentionally separate:
 * - scope: ecosystem/platform focus
 * - productType: what kind of product this is
 * - domain: main job to be done
 * - vertical: optional subject-area specialization for standalone apps
 */
export const ALLOWED_SCOPES = [
  "bluesky",
  "atproto",
  "cross_network",
] as const

export const ALLOWED_PRODUCT_TYPES = [
  "client",
  "creator_tool",
  "analytics_tool",
  "account_tool",
  "integration",
  "developer_tool",
  "standalone_app",
] as const

export const ALLOWED_DOMAINS = [
  "posting",
  "scheduling",
  "analytics",
  "discovery",
  "account_management",
  "bookmarks",
  "profile_identity",
  "embeds_sharing",
  "moderation_safety",
  "migration",
  "automation",
  "developer_infra",
  "community_social",
  "music",
  "productivity",
  "marketplace",
  "games",
] as const

export const ALLOWED_VERTICALS = [
  "social",
  "music",
  "productivity",
  "events",
  "books",
  "recipes",
  "fitness",
  "jobs",
  "marketplace",
  "developer",
] as const

export type AllowedScope = (typeof ALLOWED_SCOPES)[number]
export type AllowedProductType = (typeof ALLOWED_PRODUCT_TYPES)[number]
export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number]
export type AllowedVertical = (typeof ALLOWED_VERTICALS)[number]

export type StructuredTaxonomy = {
  scope: AllowedScope
  productType: AllowedProductType
  domain: AllowedDomain
  vertical: AllowedVertical | null
}

const SCOPE_SET = new Set<string>(ALLOWED_SCOPES)
const PRODUCT_TYPE_SET = new Set<string>(ALLOWED_PRODUCT_TYPES)
const DOMAIN_SET = new Set<string>(ALLOWED_DOMAINS)
const VERTICAL_SET = new Set<string>(ALLOWED_VERTICALS)

function normalizeEnumValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
}

export function normalizeScope(raw: string): AllowedScope | null {
  const s = normalizeEnumValue(raw)
  return SCOPE_SET.has(s) ? (s as AllowedScope) : null
}

export function normalizeProductType(raw: string): AllowedProductType | null {
  const s = normalizeEnumValue(raw)
  return PRODUCT_TYPE_SET.has(s) ? (s as AllowedProductType) : null
}

export function normalizeDomain(raw: string): AllowedDomain | null {
  const s = normalizeEnumValue(raw)
  return DOMAIN_SET.has(s) ? (s as AllowedDomain) : null
}

export function normalizeVertical(raw: string | null | undefined): AllowedVertical | null {
  if (raw == null || raw.trim() === "") return null
  const s = normalizeEnumValue(raw)
  return VERTICAL_SET.has(s) ? (s as AllowedVertical) : null
}

export function formatStructuredTaxonomyForPrompt(): string {
  return [
    "Scopes:",
    ...ALLOWED_SCOPES.map((value) => `- ${value}`),
    "",
    "Product types:",
    ...ALLOWED_PRODUCT_TYPES.map((value) => `- ${value}`),
    "",
    "Domains:",
    ...ALLOWED_DOMAINS.map((value) => `- ${value}`),
    "",
    "Optional verticals (use null when not needed):",
    ...ALLOWED_VERTICALS.map((value) => `- ${value}`),
  ].join("\n")
}
