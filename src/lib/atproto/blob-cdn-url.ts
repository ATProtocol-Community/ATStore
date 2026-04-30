/**
 * Resolve ATProto listing blob refs to Bluesky CDN image URLs (same pattern as Kitchen tap-sync).
 * Handles JSON `ref.$link`, CBOR `ref.bytes`, and Tap/indigo `{ code, version, hash }` multihash forms.
 */
import { CID } from "multiformats/cid";
import * as Digest from "multiformats/hashes/digest";

/** Multicodec: raw */
const RAW_CODEC = 0x55;
/** Multihash: sha2-256 */
const MH_SHA2_256 = 0x12;

/** JSON.parse(JSON.stringify(record)) turns Uint8Array into `{ "0": n, "1": n, ... }`. */
function numericKeyedObjectToUint8(input: unknown): Uint8Array | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const o = input as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) return null;
  for (const k of keys) {
    if (!/^\d+$/.test(k)) return null;
  }
  const indices = keys.map((k) => Number.parseInt(k, 10));
  const max = Math.max(...indices);
  if (!Number.isFinite(max) || max < 0 || max > 50_000_000) return null;
  if (keys.length !== max + 1) return null;
  const out = new Uint8Array(max + 1);
  for (const k of keys) {
    const i = Number.parseInt(k, 10);
    const v = o[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 255) {
      return null;
    }
    out[i] = v;
  }
  return out;
}

function toUint8(input: unknown): Uint8Array | null {
  if (input instanceof Uint8Array) return input;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }
  if (Array.isArray(input) && input.every((x) => typeof x === "number")) {
    return Uint8Array.from(input);
  }
  const fromObj = numericKeyedObjectToUint8(input);
  if (fromObj) return fromObj;
  return null;
}

/** One-line ref shape for logs (no secrets). */
export function summarizeRefForLog(ref: unknown): string {
  if (ref == null) return "null";
  if (typeof ref !== "object") return typeof ref;
  const r = ref as Record<string, unknown>;
  const keys = Object.keys(r).slice(0, 12).join(",");
  const link =
    typeof r.$link === "string" ? `link=${r.$link.slice(0, 20)}…` : "no $link";
  let bytesLen = "";
  const b = toUint8(r.bytes);
  if (b) bytesLen = `bytes.len=${b.byteLength}`;
  let hashLen = "";
  const h = toUint8(r.hash);
  if (h) hashLen = `hash.len=${h.byteLength}`;
  return `{keys=${keys} ${link} ${bytesLen} ${hashLen}}`;
}

/**
 * Why `blobLikeToBskyCdnUrl` returned null (mime, CID extraction, ref shape).
 */
export function explainMissingBlobUrl(blobLike: unknown): string {
  if (blobLike === null || typeof blobLike !== "object") {
    return "blob is null or not object";
  }
  const b = blobLike as Record<string, unknown>;
  if (typeof b.mimeType !== "string" || !b.mimeType.trim()) {
    return "mimeType missing or empty";
  }
  const cid = getBlobCidString(blobLike);
  if (cid) return "unexpected: CID resolved (should have URL)";
  const ref = b.ref;
  if (ref === null || ref === undefined) return "ref missing";
  if (typeof ref !== "object") return `ref is ${typeof ref}`;
  return `no derivable CID; ref ${summarizeRefForLog(ref)}`;
}

/**
 * Extract a CID string from a lexicon `blob` object (any common wire shape).
 */
export function getBlobCidString(blob: unknown): string | null {
  if (blob === null || typeof blob !== "object") return null;
  const b = blob as Record<string, unknown>;
  if (typeof b.cid === "string" && b.cid.length > 0) return b.cid;

  const ref = b.ref;
  if (ref == null || typeof ref !== "object") return null;
  const r = ref as Record<string, unknown>;

  const link = r.$link ?? r.link;
  if (typeof link === "string" && link.length > 0) return link;

  const bytes = toUint8(r.bytes);
  if (bytes) {
    try {
      return CID.decode(bytes).toString();
    } catch {
      /* try other forms */
    }
  }

  const hash = toUint8(r.hash);
  if (!hash) return null;

  // 1) `hash` holds full CID bytes
  try {
    return CID.decode(hash).toString();
  } catch {
    /* continue */
  }

  // 2) `hash` is a multihash-wrapped digest (varint + code + len + digest)
  try {
    const digest = Digest.decode(hash);
    const codec =
      typeof r.code === "number" && r.code >= 0 ? r.code : RAW_CODEC;
    const ver = typeof r.version === "number" ? r.version : 1;
    if (ver === 1) {
      return CID.createV1(codec, digest).toString();
    }
  } catch {
    /* continue */
  }

  // 3) `hash` is raw 32-byte sha256 digest only (common when code/version/hash are split)
  if (hash.length === 32) {
    try {
      const digest = Digest.create(MH_SHA2_256, hash);
      return CID.createV1(RAW_CODEC, digest).toString();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Bluesky `img/feed_fullsize` expects a simple `@suffix` (e.g. `@jpeg`, `@png`).
 * Naive `mime.split('/').pop()` breaks for `image/svg+xml` (`svg+xml`), `image/xml`, etc.
 */
function mimeTypeToBskyCdnExtension(mimeType: string): string {
  const base = mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  switch (base) {
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg": {
      return "jpeg";
    }
    case "image/png": {
      return "png";
    }
    case "image/webp": {
      return "webp";
    }
    case "image/gif": {
      return "gif";
    }
    case "image/avif": {
      return "avif";
    }
    case "image/svg+xml":
    case "image/svg": {
      return "svg";
    }
    default: {
      if (base.startsWith("image/")) {
        const sub = base.slice("image/".length);
        if (sub.startsWith("svg")) return "svg";
        // Junk types (e.g. `image/xml`) — use a CDN-supported raster suffix.
        if (sub === "xml") return "jpeg";
        const simple = sub.split("+")[0] ?? "";
        if (/^[a-z0-9]+$/i.test(simple)) return simple;
      }
      return "jpeg";
    }
  }
}

/**
 * Bluesky CDN URL for a repo blob (feed_fullsize template used in Kitchen).
 */
export function blobLikeToBskyCdnUrl(
  blobLike: unknown,
  repoDid: string,
): string | null {
  if (blobLike === null || typeof blobLike !== "object") return null;
  const b = blobLike as Record<string, unknown>;
  const mimeType = typeof b.mimeType === "string" ? b.mimeType : "";
  const cid = getBlobCidString(blobLike);
  if (!cid || !mimeType) return null;
  const ext = mimeTypeToBskyCdnExtension(mimeType);
  return `https://cdn.bsky.app/img/feed_fullsize/plain/${repoDid}/${cid}@${ext}`;
}
