/**
 * Query parameter carrying the DID of the logged-in user who is linking out to
 * another app in the atmosphere. It is a *hint* only: the destination app should
 * use it to resolve DID -> PDS and pre-fill / kick off its own OAuth flow. A DID
 * is public and can't be trusted as proof of identity, so the destination must
 * still authenticate the user itself.
 */
export const REFERRER_DID_PARAM = "referrer_did";

/**
 * Append a `referrer_did` query parameter to an outbound app URL so a logged-in
 * user can be recognised (and offered a fast sign-in) as they move across the
 * atmosphere.
 *
 * The original URL is returned unchanged when there is no DID, the URL is empty,
 * or it isn't an absolute http(s) URL (mailto:, relative paths, etc.). Any hash
 * and existing query parameters are preserved; an existing `referrer_did` is
 * overwritten so a stale value can't linger.
 */
export function withReferrerDid(
  url: string | null | undefined,
  did: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (!did) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Relative or otherwise unparseable URL — leave it untouched.
    return url;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return url;
  }

  parsed.searchParams.set(REFERRER_DID_PARAM, did);
  return parsed.toString();
}
