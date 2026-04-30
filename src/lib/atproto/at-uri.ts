/**
 * Parse `at://repo/collection/rkey` (AT URI for a repo record).
 */
export function parseAtUriParts(uri: string): {
  repo: string;
  collection: string;
  rkey: string;
} {
  const t = uri.trim();
  const m = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(t);
  if (!m) {
    throw new Error(`Invalid at-uri: ${uri}`);
  }
  return { repo: m[1], collection: m[2], rkey: m[3] };
}
