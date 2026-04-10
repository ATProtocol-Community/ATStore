function normalizeProtocolCategorySlugParam(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves a URL segment (e.g. from `/protocol/pds`) to a protocol category group.
 */
export function findProtocolCategoryBySlugParam<
  T extends { segment: string },
>(groups: T[], param: string): T | null {
  const normalizedParam = normalizeProtocolCategorySlugParam(param);
  if (!normalizedParam) {
    return null;
  }

  for (const group of groups) {
    if (normalizeProtocolCategorySlugParam(group.segment) === normalizedParam) {
      return group;
    }
  }

  return null;
}

export function getProtocolCategoryDescription(categoryId: string): string {
  if (categoryId.startsWith("protocol/")) {
    const label = categoryId.split("/").pop() ?? categoryId;
    return `Infrastructure, services, and tools for ${label.replace(/-/g, " ")}.`;
  }

  return "Protocol tooling and infrastructure.";
}
