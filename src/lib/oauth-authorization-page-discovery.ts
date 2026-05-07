import { tryResolveOAuthClientMetadataUrlFast } from "#/lib/oauth-listing-auth-probe";

/**
 * Ordered probe targets derived from an OAuth authorization / PDS login URL.
 * ATProto clients often pass the app’s client-metadata document URL as `client_id`
 * (https URL). `resource` may name the protected resource for RFC 9728 discovery.
 */
export function oauthAuthorizationPageProbeTargets(
  pageUrl: string,
): Array<string> {
  let u: URL;
  try {
    u = new URL(pageUrl.trim());
  } catch {
    return [];
  }

  const ordered: Array<string> = [];
  const seen = new Set<string>();

  function push(s: string) {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  }

  const sp = u.searchParams;

  const clientId = sp.get("client_id")?.trim();
  if (clientId && /^https?:\/\//iu.test(clientId)) {
    push(clientId);
  }

  push(pageUrl.trim());

  const resource = sp.get("resource")?.trim();
  if (resource) {
    try {
      const dec = decodeURIComponent(resource);
      if (/^https?:\/\//iu.test(dec)) push(dec);
    } catch {
      if (/^https?:\/\//iu.test(resource)) push(resource);
    }
  }

  push(`${u.origin}/`);

  const redirectUri = sp.get("redirect_uri")?.trim();
  if (redirectUri) {
    try {
      const r = new URL(decodeURIComponent(redirectUri));
      push(`${r.origin}/`);
    } catch {
      try {
        const r = new URL(redirectUri);
        push(`${r.origin}/`);
      } catch {
        /* ignore */
      }
    }
  }

  return ordered;
}

export type AuthorizationPageProbeAttempt = {
  target: string;
  clientMetadataFoundUrl: string | null;
  error?: string;
};

/**
 * Fast client-metadata discovery for a PDS / authorization-server login URL.
 * Uses {@link tryResolveOAuthClientMetadataUrlFast} only (no full listing OAuth probe).
 */
export async function probeOAuthClientMetadataFromAuthorizationServerPage(
  pageUrl: string,
  onProgress?: (event: string, data?: Record<string, unknown>) => void,
): Promise<{
  clientMetadataUrl: string | null;
  attempts: Array<AuthorizationPageProbeAttempt>;
}> {
  const targets = oauthAuthorizationPageProbeTargets(pageUrl);
  onProgress?.("authorization_page_probe_targets", {
    pageUrl,
    count: targets.length,
    targets,
  });
  const attempts: Array<AuthorizationPageProbeAttempt> = [];
  let clientMetadataUrl: string | null = null;

  for (const [i, target] of targets.entries()) {
    onProgress?.("authorization_page_probe_target_start", {
      index: i + 1,
      total: targets.length,
      target,
    });
    try {
      const found = await tryResolveOAuthClientMetadataUrlFast(
        target,
        onProgress,
      );
      attempts.push({
        target,
        clientMetadataFoundUrl: found?.url ?? null,
      });
      if (found) {
        clientMetadataUrl = found.url;
        onProgress?.("authorization_page_probe_done", {
          clientMetadataUrl,
        });
        break;
      }
    } catch (error) {
      attempts.push({
        target,
        clientMetadataFoundUrl: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    onProgress?.("authorization_page_probe_target_end", {
      index: i + 1,
      target,
      hit: Boolean(clientMetadataUrl),
    });
  }

  return { clientMetadataUrl, attempts };
}
