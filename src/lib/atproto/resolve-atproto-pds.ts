/**
 * Resolve the personal data server origin (no trailing slash) for a DID.
 * Uses plc.directory for `did:plc` (covers typical Bluesky product accounts).
 */
export async function resolveAtprotoPdsBaseUrl(
  did: string,
): Promise<string | null> {
  const trimmed = did.trim();
  if (!trimmed.startsWith("did:plc:")) return null;
  try {
    const res = await fetch(
      `https://plc.directory/${encodeURIComponent(trimmed)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const doc = (await res.json()) as {
      service?: Array<{
        id?: string;
        type?: string;
        serviceEndpoint?: string | string[];
      }>;
    };
    for (const s of doc.service ?? []) {
      if (s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer") {
        const ep = s.serviceEndpoint;
        const url = Array.isArray(ep) ? ep[0] : ep;
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          return url.replace(/\/+$/, "");
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
