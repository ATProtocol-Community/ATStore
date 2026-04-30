export function protocolRecordImageUrlOrNull(
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

  const imgproxyBase = process.env.IMGPROXY_URL?.trim();
  if (imgproxyBase) {
    try {
      const imgproxy = new URL(imgproxyBase);
      if (parsed.origin === imgproxy.origin) {
        return null;
      }
    } catch {
      /* Ignore malformed IMGPROXY_URL and keep URL validation outcome above. */
    }
  }

  return trimmed;
}
