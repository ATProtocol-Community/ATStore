/** Matches Satori `width` / `height` on OG routes — single source of truth for raster output. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type RenderOgOptions = {
  width?: number;
  height?: number;
  /**
   * DPI hint for SVG rasterization (embedded images/text sharpness). Sharp default is 72;
   * OG cards benefit from a higher value.
   */
  density?: number;
  cacheControl?: string;
};

/**
 * Turn Satori SVG output into a PNG `Response` for Open Graph. Many crawlers and messengers
 * only reliably accept raster OG images (SVG is often ignored or stripped).
 */
export async function renderOg(
  svg: string,
  options?: RenderOgOptions,
): Promise<Response> {
  const width = options?.width ?? OG_IMAGE_WIDTH;
  const height = options?.height ?? OG_IMAGE_HEIGHT;
  const density = options?.density ?? 144;
  const cacheControl = options?.cacheControl ?? "public, max-age=3600";

  const { default: sharp } = await import("sharp");

  const png = await sharp(Buffer.from(svg, "utf8"), { density })
    .resize(width, height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": cacheControl,
    },
  });
}
