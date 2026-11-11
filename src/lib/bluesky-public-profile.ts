/**
 * Profile fields from public.api.bsky.app (stable JSON for login flows).
 */
export type BlueskyPublicProfileFields = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  /** Profile bio. */
  description: string | null;
};

/**
 * Fetch handle, display name, avatar, banner and bio for a DID via public Bluesky API.
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
    return normalizeProfileResponse(await response.json());
  } catch {
    return null;
  }
}

/** `app.bsky.actor.getProfiles` accepts up to 25 actors per call (server-side cap). */
const GET_PROFILES_BATCH_SIZE = 25;

function normalizeProfileResponse(raw: unknown): BlueskyPublicProfileFields {
  const profileData = raw as {
    handle?: string | null;
    displayName?: string | null;
    avatar?: string | null;
    banner?: string | null;
    description?: string | null;
  };
  const handle = profileData.handle?.trim();
  const displayName = profileData.displayName?.trim();
  const rawAvatar = profileData.avatar;
  const avatarUrl =
    typeof rawAvatar === "string" && rawAvatar.trim() !== ""
      ? rawAvatar.trim()
      : null;
  const bannerUrl =
    typeof profileData.banner === "string" && profileData.banner.trim() !== ""
      ? profileData.banner.trim()
      : null;
  const description =
    typeof profileData.description === "string" &&
    profileData.description.trim() !== ""
      ? profileData.description.trim()
      : null;
  return {
    handle: handle && handle.length > 0 ? handle : null,
    displayName: displayName && displayName.length > 0 ? displayName : null,
    avatarUrl,
    bannerUrl,
    description,
  };
}

/**
 * Batched variant of `fetchBlueskyPublicProfileFields` — calls `app.bsky.actor.getProfiles`
 * (max 25 actors per call) and returns a Map keyed by the DID *we requested*. Listings whose
 * DIDs the API can't resolve map to `null` (matches the per-DID function's contract). On a
 * batch HTTP failure every DID in that batch maps to `null` so callers don't need a
 * second null-check path.
 *
 * The Map shape mirrors the per-request `Map<did, profile>` memo we use for review/mention
 * loaders — callers can drop this in wherever they previously built that map by hand.
 */
export async function fetchBlueskyPublicProfilesBatch(
  rawDids: ReadonlyArray<string>,
): Promise<Map<string, BlueskyPublicProfileFields | null>> {
  const out = new Map<string, BlueskyPublicProfileFields | null>();
  const dids = [
    ...new Set(
      rawDids
        .map((d) => d?.trim())
        .filter((d): d is string => Boolean(d) && d.startsWith("did:")),
    ),
  ];
  if (dids.length === 0) return out;

  // Pre-seed null so a missing DID in the API response still resolves to null below.
  for (const did of dids) out.set(did, null);

  for (let i = 0; i < dids.length; i += GET_PROFILES_BATCH_SIZE) {
    const chunk = dids.slice(i, i + GET_PROFILES_BATCH_SIZE);
    try {
      const url = new URL(
        "xrpc/app.bsky.actor.getProfiles",
        "https://public.api.bsky.app",
      );
      for (const did of chunk) url.searchParams.append("actors", did);
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const data = (await response.json()) as {
        profiles?: Array<{ did?: string } & Record<string, unknown>>;
      };
      for (const profile of data.profiles ?? []) {
        const profileDid = (profile.did ?? "").trim();
        if (!profileDid) continue;
        out.set(profileDid, normalizeProfileResponse(profile));
      }
    } catch {
      // Whole batch fell over — leave the pre-seeded `null`s in place.
      continue;
    }
  }
  return out;
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
