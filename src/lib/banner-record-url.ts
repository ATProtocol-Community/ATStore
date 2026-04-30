import { GENERATED_BANNER_RECORD_URLS } from "#/lib/generated-banner-record-urls";

const GENERATED_PREFIX = "/generated/";
const IMGPROXY_BASE_URL =
  process.env.IMGPROXY_URL?.trim().replace(/\/+$/, "") ?? "";
const IMGPROXY_INSECURE_PLAIN_SEGMENT = "/insecure/plain/";

export function resolveBannerRecordUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith(GENERATED_PREFIX)) {
    return trimmed;
  }

  const mapped = GENERATED_BANNER_RECORD_URLS[trimmed];
  if (mapped) {
    return mapped;
  }

  if (IMGPROXY_BASE_URL) {
    return `${IMGPROXY_BASE_URL}${trimmed}`;
  }

  return null;
}

type ImgproxyResizeMode = "fill" | "fit";

export function resolveResizedBannerRecordUrl(
  url: string | null | undefined,
  options: {
    width: number;
    height: number;
    mode?: ImgproxyResizeMode;
  },
): string | null {
  const base = resolveBannerRecordUrl(url);
  if (!base) {
    return null;
  }

  const mode = options.mode ?? "fill";
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));

  if (!base.includes(IMGPROXY_INSECURE_PLAIN_SEGMENT)) {
    return base;
  }

  return base.replace(
    IMGPROXY_INSECURE_PLAIN_SEGMENT,
    `/insecure/rs:${mode}:${width}:${height}/plain/`,
  );
}
