/**
 * Public media URLs for OG tags and hero backgrounds. Allows relative URLs;
 * drops legacy `/generated/…` asset paths that required a separate resolver.
 */
export function publicMediaUrlOrNull(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/generated/")) {
    return null;
  }

  return trimmed;
}

/**
 * HTTPS image URLs mirrored in Postgres (icons, heroes). Relative paths and
 * `/generated/…` are rejected.
 */
export function httpsListingImageUrlOrNull(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.pathname.startsWith("/generated/")) {
    return null;
  }

  return trimmed;
}
