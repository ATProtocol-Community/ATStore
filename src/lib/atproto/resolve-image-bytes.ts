import { mimeFromPath } from "#/lib/atproto/resolve-image-bytes.shared";

/**
 * Load image bytes from an `https?://` URL, or a site path like `/generated/foo.png`
 * (resolved under `./public` on the server, or via same-origin `fetch` in the browser).
 */
export async function resolveUrlToImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const raw = url.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    let res = await fetch(raw);
    // Legacy bug: `blobLikeToBskyCdnUrl` used `mime.split('/').pop()` → `@xml` for some types;
    // CDN 404s but the same blob often works with a raster suffix.
    if (
      !res.ok &&
      res.status === 404 &&
      raw.includes("cdn.bsky.app") &&
      /@xml(?:\?|$)/.test(raw)
    ) {
      const alt = raw.replace(/@xml(\?|$)/, "@jpeg$1");
      if (alt !== raw) {
        res = await fetch(alt);
      }
    }
    if (!res.ok) {
      throw new Error(`fetch ${raw}: ${res.status}`);
    }
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim();
    const buf = new Uint8Array(await res.arrayBuffer());
    const mt =
      mimeType && mimeType.startsWith("image/")
        ? mimeType
        : mimeFromPath(new URL(raw).pathname);
    return { bytes: buf, mimeType: mt };
  }

  // In Node scripts (publish/import), `import.meta.env.SSR` is not guaranteed.
  // Use runtime detection so `/generated/...` paths resolve from `public/`.
  if (globalThis.window === undefined) {
    const { readPublicImageFile } =
      await import("#/lib/atproto/resolve-image-bytes.server");
    return readPublicImageFile(raw);
  }

  const fetchPath = raw.startsWith("/") ? raw : `/${raw}`;
  const res = await fetch(fetchPath);
  if (!res.ok) {
    throw new Error(`fetch ${fetchPath}: ${res.status}`);
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const buf = new Uint8Array(await res.arrayBuffer());
  const mt =
    mimeType && mimeType.startsWith("image/")
      ? mimeType
      : mimeFromPath(fetchPath);
  return { bytes: buf, mimeType: mt };
}
