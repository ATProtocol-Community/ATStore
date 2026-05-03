/**
 * Parses `include?nsid=…` / `include?nsid=…&aud=…` or shorthand `include:permission-set-id`
 * (`permission-set-id` is commonly a dotted bundle id ending in camelCase, e.g. `app.bsky.authCreatePosts`).
 *
 * Keeps browser/client bundles independent of OAuth probe code that uses Node `fs`.
 */
export function parseIncludeScopeToken(
  token: string,
): { aud: string | null; nsid: string } | null {
  const t = token.trim();

  const qIdx = t.indexOf("?");
  if (qIdx !== -1) {
    const base = t.slice(0, qIdx);
    if (base.toLowerCase() !== "include") return null;
    const sp = new URLSearchParams(t.slice(qIdx + 1));
    const rawNsid = sp.get("nsid");
    if (!rawNsid?.trim()) return null;
    let nsid: string;
    try {
      nsid = decodeURIComponent(rawNsid);
    } catch {
      nsid = rawNsid;
    }
    nsid = nsid.trim();
    if (!nsid) return null;
    const audRaw = sp.get("aud");
    return { nsid, aud: audRaw?.trim() ? audRaw.trim() : null };
  }

  const colonMatch = /^include:(?<rest>.+)$/iu.exec(t);
  if (colonMatch?.groups?.rest) {
    const nsid = colonMatch.groups.rest.trim();
    return nsid.length > 0 ? { nsid, aud: null } : null;
  }

  return null;
}
