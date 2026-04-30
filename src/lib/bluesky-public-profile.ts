/**
 * Profile fields from public.api.bsky.app (stable JSON for login flows).
 */
export type BlueskyPublicProfileFields = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Fetch handle, display name, and avatar URL for a DID via public Bluesky API.
 */
export async function fetchBlueskyPublicProfileFields(
  did: string,
): Promise<BlueskyPublicProfileFields | null> {
  try {
    const url = new URL(
      "xrpc/app.bsky.actor.getProfile",
      "https://public.api.bsky.app",
    );
    url.searchParams.set("actor", did);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const profileData = (await response.json()) as {
      handle?: string | null;
      displayName?: string | null;
      avatar?: string | null;
    };
    const handle = profileData.handle?.trim();
    const displayName = profileData.displayName?.trim();
    const rawAvatar = profileData.avatar;
    const avatarUrl =
      typeof rawAvatar === "string" && rawAvatar.trim() !== ""
        ? rawAvatar.trim()
        : null;
    return {
      handle: handle && handle.length > 0 ? handle : null,
      displayName: displayName && displayName.length > 0 ? displayName : null,
      avatarUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Whether to set `user.image` from Bluesky's public avatar URL.
 */
export function shouldApplyBlueskyAvatarFromPublicUrl(
  currentImage: string | null | undefined,
  blueskyAvatarUrl: string | null | undefined,
): boolean {
  if (!blueskyAvatarUrl || blueskyAvatarUrl.trim() === "") return false;
  const cur = currentImage?.trim() ?? "";
  if (cur === "") return true;
  if (cur.startsWith("data:image/")) return false;
  if (cur.startsWith("blob:")) return true;
  return false;
}

/**
 * Resolve Bluesky handle for a DID (public.api.bsky.app).
 */
export async function fetchBlueskyHandleForDid(
  did: string,
): Promise<string | null> {
  try {
    const url = new URL(
      "xrpc/app.bsky.actor.getProfile",
      "https://public.api.bsky.app",
    );
    url.searchParams.set("actor", did);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const profileData = (await response.json()) as {
      handle?: string | null;
    };
    const handle = profileData.handle?.trim();
    return handle && handle.length > 0 ? handle : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a handle (e.g. `name.bsky.social`) to a DID via public ATProto API.
 */
export async function resolveBlueskyHandleToDid(
  handle: string,
): Promise<string | null> {
  const trimmed = handle.trim().replace(/^@/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(
      "xrpc/com.atproto.identity.resolveHandle",
      "https://public.api.bsky.app",
    );
    url.searchParams.set("handle", trimmed);
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { did?: string };
    const did = data.did?.trim();
    return did && did.startsWith("did:") ? did : null;
  } catch {
    return null;
  }
}

function isPlausibleProfileDid(value: string): boolean {
  const s = value.trim();
  return s.startsWith("did:") && s.length >= 12 && s.length <= 2048;
}

/**
 * Decode a `/profile/...` path segment: trim and decode URI escapes.
 */
export function normalizeProfilePathActor(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/**
 * Resolve a profile URL segment to a DID: either a `did:…` string or a Bluesky handle
 * (e.g. `user.bsky.social`, `hipstersmoothie.com`).
 */
export async function resolveProfilePathActorToDid(
  raw: string,
): Promise<string | null> {
  const normalized = normalizeProfilePathActor(raw);
  if (!normalized) return null;
  if (normalized.startsWith("did:")) {
    return isPlausibleProfileDid(normalized) ? normalized : null;
  }
  return resolveBlueskyHandleToDid(normalized);
}
