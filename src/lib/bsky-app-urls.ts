/** Build a bsky.app link from an AT URI for `app.bsky.feed.post`. */
export function bskyAppPostUrlFromAtUri(atUri: string): string | null {
  const trimmed = atUri.trim();
  const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(trimmed);
  if (!m) return null;
  const [, did, rkey] = m;
  return `https://bsky.app/profile/${did}/post/${encodeURIComponent(rkey)}`;
}
