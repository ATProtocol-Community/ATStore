import { scope as atprotoScope } from "@atcute/oauth-node-client";

export const scope = [
  atprotoScope.blob({ accept: ["image/*", "video/*"] }),
  // NOT atprotoScope.include({ nsid }) — that builds the query form
  // `include?nsid=fyi.atstore.authBasic`, which some authorization servers
  // reject with "Unsupported scope". `include:<nsid>` is the canonical
  // positional form the atproto reference implementation normalizes to.
  "include:fyi.atstore.authBasic",
];

/**
 * Transitional scope granting read access to the account email: it makes
 * `com.atproto.server.getSession` include `email` + `emailConfirmed`. Only
 * requested once a user opts into the weekly digest.
 */
export const EMAIL_SCOPE = "transition:email";

/**
 * Client metadata must declare every scope we may ever request; individual
 * authorize calls then pick a subset (see {@link resolveRequestScope}).
 */
export const clientMetadataScope = [...scope, EMAIL_SCOPE];

/**
 * Scope for one authorize request, derived from the (normalized) client metadata
 * scope so its normalized form is kept verbatim. Drops {@link EMAIL_SCOPE}
 * unless the user opted into the weekly digest.
 */
export function resolveRequestScope(
  metadataScope: string | undefined,
  opts: { email: boolean },
): string {
  return (metadataScope ?? clientMetadataScope.join(" "))
    .trim()
    .split(/\s+/)
    .filter((entry) => opts.email || entry !== EMAIL_SCOPE)
    .join(" ");
}

export function hasEmailScope(grantedScope: string | null | undefined) {
  if (!grantedScope) return false;
  return grantedScope.split(/\s+/).includes(EMAIL_SCOPE);
}
