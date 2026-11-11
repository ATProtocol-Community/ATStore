/**
 * `games.atmosphere.define` (atmosphere.games) — parse + mapping into the AT Store listing read model.
 * Schema: https://atmosphere.games/lexicons/games.atmosphere.define.json
 *
 * Client-safe: no DB / server imports (the `GameDetails` type is shared with the UI).
 */
import { blobLikeToBskyCdnUrl } from "#/lib/atproto/blob-cdn-url";
import { GAMES_NSID } from "#/lib/atproto/nsids";
import { z } from "zod";

/** `store_listings.listing_type` — apps come from `fyi.atstore.listing.detail`, games from `games.atmosphere.define`. */
export type ListingType = "app" | "game";

export const GAME_STATUSES = ["live", "beta", "coming", "archived"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_CATEGORIES = [
  "browser",
  "download",
  "physical",
  "other",
] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export type GameParty = {
  name: string;
  did: string | null;
  url: string | null;
};

export type GameTrailer = {
  title: string;
  platform: string | null;
  videoId: string | null;
  url: string | null;
  thumbnailUrl: string | null;
};

/** A record the game reads/writes (`#recordUse`) or gates on (`#rule`), flattened for display. */
export type GameRecordRef = {
  nsid: string | null;
  /** `#recordUse.role` (e.g. character, stats) or `#rule.check` (e.g. record, vouch, any). */
  kind: string;
  label: string | null;
  purpose: string | null;
  acquire: string | null;
};

/**
 * Game-specific fields mirrored onto `store_listings.game_details`. Mirrors the parts of
 * `games.atmosphere.define` the store renders; unknown/advanced rule fields are not kept.
 */
export type GameDetails = {
  /** AT URI of the `games.atmosphere.define` record this was built from. */
  defineAtUri: string;
  /** Unknown values from newer lexicon revisions are kept verbatim. */
  category: string | null;
  status: string | null;
  tags: Array<string>;
  developer: GameParty | null;
  releasedAt: string | null;
  legacyIds: Array<string>;
  trailers: Array<GameTrailer>;
  requires: Array<GameRecordRef>;
  uses: Array<GameRecordRef>;
  /**
   * DIDs allowed to take this game over when it is held in someone else's repo (e.g. atmosphere.games
   * publishing on a developer's behalf): `developer.did` plus DID entries in `claimAllowed`.
   */
  claimantDids: Array<string>;
};

const optionalTrimmed = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return;
      const t = String(s).trim();
      return t.length > 0 ? t.slice(0, max) : undefined;
    });

const partySchema = z.object({
  name: z.string().trim().min(1).max(100),
  did: optionalTrimmed(2048),
  url: optionalTrimmed(2048),
});

const videoSchema = z.object({
  title: z.string().trim().min(1).max(120),
  platform: optionalTrimmed(32),
  videoId: optionalTrimmed(120),
  url: optionalTrimmed(2048),
  thumbnail: z.unknown().optional(),
});

const mediaItemSchema = z.object({
  image: z.unknown(),
  type: optionalTrimmed(32),
  alt: optionalTrimmed(300),
});

const ruleSchema: z.ZodType<RawRule> = z.lazy(() =>
  z
    .object({
      check: z.string().max(32),
      nsid: optionalTrimmed(317),
      label: optionalTrimmed(120),
      acquire: optionalTrimmed(2048),
      rules: z.array(ruleSchema).max(16).optional(),
      rule: ruleSchema.optional(),
    })
    .passthrough(),
);

type RawRule = {
  check: string;
  nsid?: string;
  label?: string;
  acquire?: string;
  rules?: Array<RawRule>;
  rule?: RawRule;
};

const recordUseSchema = z
  .object({
    role: z.string().trim().max(32).optional().default("other"),
    nsid: optionalTrimmed(317),
    label: optionalTrimmed(120),
    purpose: optionalTrimmed(300),
    acquire: optionalTrimmed(2048),
  })
  .passthrough();

const stringList = (maxItems: number, maxLen: number) =>
  z
    .array(z.unknown())
    .optional()
    .transform((arr) =>
      (arr ?? [])
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().slice(0, maxLen))
        .filter(Boolean)
        .slice(0, maxItems),
    );

const defineBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  tagline: optionalTrimmed(200),
  description: optionalTrimmed(2000),
  url: z
    .string()
    .trim()
    .min(1)
    .refine((s) => /^https?:\/\//i.test(s), {
      message: "url must be http(s)",
    }),
  publisher: optionalTrimmed(2048),
  legacyIds: stringList(12, 80),
  category: optionalTrimmed(30),
  tags: stringList(12, 32),
  cover: z.unknown().optional(),
  icon: z.unknown().optional(),
  media: z.array(z.unknown()).max(24).optional(),
  trailers: z.array(z.unknown()).max(8).optional(),
  developer: z.unknown().optional(),
  claimAllowed: stringList(12, 128),
  status: optionalTrimmed(32),
  releasedAt: optionalTrimmed(64),
  requires: z.array(z.unknown()).max(16).optional(),
  uses: z.array(z.unknown()).max(32).optional(),
  createdAt: z.string().min(1),
  updatedAt: optionalTrimmed(64),
});

/** Parsed `games.atmosphere.define` — lenient for optional sub-objects (bad entries are dropped). */
export type GamesAtmosphereDefine = {
  $type: typeof GAMES_NSID.define;
  name: string;
  tagline?: string;
  description?: string;
  url: string;
  publisher?: string;
  legacyIds: Array<string>;
  category?: string;
  tags: Array<string>;
  cover?: unknown;
  icon?: unknown;
  media: Array<{ image: unknown; type?: string; alt?: string }>;
  trailers: Array<z.infer<typeof videoSchema>>;
  developer?: z.infer<typeof partySchema>;
  claimAllowed: Array<string>;
  status?: string;
  releasedAt?: string;
  requires: Array<RawRule>;
  uses: Array<z.infer<typeof recordUseSchema>>;
  createdAt: string;
  updatedAt?: string;
};

export type GameDefineParseResult =
  | { ok: true; record: GamesAtmosphereDefine }
  | { ok: false; reason: string; stage: "no_body" | "zod" };

function keepValid<T>(schema: z.ZodType<T>, items: Array<unknown> | undefined) {
  return (items ?? []).flatMap((item) => {
    const r = schema.safeParse(item);
    return r.success ? [r.data] : [];
  });
}

export function tryParseGameDefineRecord(
  body: Record<string, unknown> | undefined,
): GameDefineParseResult {
  if (!body) {
    return { ok: false, reason: "record body is missing", stage: "no_body" };
  }
  const parsed = defineBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const detail = [
      ...Object.entries(flat.fieldErrors).flatMap(
        ([k, v]) => v?.map((m) => `${k}: ${m}`) ?? [],
      ),
      ...flat.formErrors,
    ].join("; ");
    return {
      ok: false,
      reason: detail || parsed.error.message,
      stage: "zod",
    };
  }

  const d = parsed.data;
  const developer = partySchema.safeParse(d.developer);
  return {
    ok: true,
    record: {
      $type: GAMES_NSID.define,
      name: d.name,
      tagline: d.tagline,
      description: d.description,
      url: d.url,
      publisher: d.publisher,
      legacyIds: d.legacyIds,
      category: d.category,
      tags: d.tags,
      cover: d.cover ?? undefined,
      icon: d.icon ?? undefined,
      media: keepValid(mediaItemSchema, d.media),
      trailers: keepValid(videoSchema, d.trailers),
      developer: developer.success ? developer.data : undefined,
      claimAllowed: d.claimAllowed,
      status: d.status,
      releasedAt: d.releasedAt,
      requires: keepValid(ruleSchema, d.requires),
      uses: keepValid(recordUseSchema, d.uses),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    },
  };
}

/** Flatten a rule tree into the record collections it inspects (composition rules recurse). */
function flattenRule(rule: RawRule, depth = 0): Array<GameRecordRef> {
  if (depth > 4) return [];
  const nested = [
    ...(rule.rules ?? []).flatMap((r) => flattenRule(r, depth + 1)),
    ...(rule.rule ? flattenRule(rule.rule, depth + 1) : []),
  ];
  if (!rule.nsid) {
    // `all` / `any` / `not` — surface the children, labelled by the parent when it has one.
    return nested.map((n) => ({
      ...n,
      label: n.label ?? rule.label ?? null,
      acquire: n.acquire ?? rule.acquire ?? null,
    }));
  }
  return [
    {
      nsid: rule.nsid,
      kind: rule.check,
      label: rule.label ?? null,
      purpose: null,
      acquire: rule.acquire ?? null,
    },
    ...nested,
  ];
}

/** AT URI for a define record. */
export function gameDefineAtUri(did: string, rkey: string) {
  return `at://${did}/${GAMES_NSID.define}/${rkey}`;
}

/** Map a define record onto listing-shaped fields + `game_details`. */
export function gameDefineToListingFields(input: {
  did: string;
  rkey: string;
  record: GamesAtmosphereDefine;
}) {
  const { did, rkey, record } = input;
  const iconUrl = blobLikeToBskyCdnUrl(record.icon, did);
  const heroImageUrl = blobLikeToBskyCdnUrl(record.cover, did);
  const screenshotUrls = record.media
    .filter((m) => !m.type || m.type === "screenshot" || m.type === "artwork")
    .flatMap((m) => {
      const url = blobLikeToBskyCdnUrl(m.image, did);
      return url ? [url] : [];
    })
    .slice(0, 20);

  const developer = record.developer
    ? {
        name: record.developer.name,
        did: record.developer.did?.startsWith("did:")
          ? record.developer.did
          : null,
        url: record.developer.url ?? null,
      }
    : null;

  const gameDetails: GameDetails = {
    defineAtUri: gameDefineAtUri(did, rkey),
    category: record.category ?? null,
    status: record.status ?? null,
    tags: record.tags,
    developer,
    releasedAt: record.releasedAt ?? null,
    legacyIds: record.legacyIds,
    trailers: record.trailers.map((t) => ({
      title: t.title,
      platform: t.platform ?? null,
      videoId: t.videoId ?? null,
      url: t.url ?? null,
      thumbnailUrl: blobLikeToBskyCdnUrl(t.thumbnail, did),
    })),
    requires: record.requires.flatMap((r) => flattenRule(r)),
    uses: record.uses.map((u) => ({
      nsid: u.nsid ?? null,
      kind: u.role,
      label: u.label ?? null,
      purpose: u.purpose ?? null,
      acquire: u.acquire ?? null,
    })),
    claimantDids: [
      ...new Set([
        ...(developer?.did ? [developer.did] : []),
        ...record.claimAllowed.filter((c) => c.startsWith("did:")),
      ]),
    ],
  };

  return {
    name: record.name,
    tagline: record.tagline ?? null,
    fullDescription: record.description ?? null,
    externalUrl: record.url,
    iconUrl,
    heroImageUrl,
    screenshotUrls,
    gameDetails,
  };
}

/**
 * Comparable form of a play / product URL for merge matching: lowercased host without `www.`,
 * no scheme, no trailing slash, no query/hash.
 */
export function normalizeGameUrlForMatch(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}
