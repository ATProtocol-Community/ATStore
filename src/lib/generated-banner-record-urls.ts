/**
 * Runtime cache for `/generated/...` → storage URL mapping.
 *
 * Source of truth is the `generated_banner_record_urls` table. This module keeps
 * a synchronous snapshot so existing consumers (`resolveBannerRecordUrl`, card
 * components) can keep their sync signature.
 *
 * Hydration:
 * - Server: `getGeneratedBannerRecordUrls` (see `api-banner-record-urls.functions`)
 *   reads DB and calls `replaceGeneratedBannerRecordUrls` as a side effect before
 *   SSR renders. Called from the root route's `beforeLoad`.
 * - Client: the root document emits an inline `<script>` that sets
 *   `window.__GENERATED_BANNER_RECORD_URLS__` before the React bundle runs, so
 *   this module picks it up at import time.
 * - Admin writes: banner upload / admin flows UPSERT into DB and may call
 *   `setGeneratedBannerRecordUrl` to keep the in-memory cache fresh for the
 *   current process.
 */

declare global {
  interface Window {
    __GENERATED_BANNER_RECORD_URLS__?: Record<string, string>
  }
}

function readInitialSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }
  const injected = window.__GENERATED_BANNER_RECORD_URLS__
  return injected && typeof injected === 'object' ? { ...injected } : {}
}

export const GENERATED_BANNER_RECORD_URLS: Record<string, string> = readInitialSnapshot()

export function replaceGeneratedBannerRecordUrls(next: Record<string, string>) {
  for (const key of Object.keys(GENERATED_BANNER_RECORD_URLS)) {
    delete GENERATED_BANNER_RECORD_URLS[key]
  }
  Object.assign(GENERATED_BANNER_RECORD_URLS, next)
}

export function setGeneratedBannerRecordUrl(assetPath: string, mappedUrl: string) {
  GENERATED_BANNER_RECORD_URLS[assetPath] = mappedUrl
}
