/**
 * Build Standard.site permalink: publication `url` + document `path`
 * (https://standard.site/ — canonical URL from publication + path).
 */
export function canonicalStandardSitePostUrl(
  publicationBaseUrl: string,
  documentPath: string,
): string | null {
  const baseRaw = publicationBaseUrl.trim().replace(/\/+$/, "");
  const pathRaw = documentPath.trim();
  if (!baseRaw || !pathRaw) return null;
  const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
  try {
    return new URL(path, `${baseRaw}/`).href;
  } catch {
    return null;
  }
}
