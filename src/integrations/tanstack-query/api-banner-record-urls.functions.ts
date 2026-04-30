import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'

import { replaceGeneratedBannerRecordUrls } from '#/lib/generated-banner-record-urls'

import { dbMiddleware } from './db-middleware'

/**
 * Reads the `generated_banner_record_urls` table. As a side effect, populates the
 * in-memory cache so synchronous callers (`resolveBannerRecordUrl`) see the latest
 * map without needing to await anything during render.
 */
const getGeneratedBannerRecordUrls = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }): Promise<Record<string, string>> => {
    const { db, schema } = context
    const rows = await db
      .select({
        assetPath: schema.generatedBannerRecordUrls.assetPath,
        mappedUrl: schema.generatedBannerRecordUrls.mappedUrl,
      })
      .from(schema.generatedBannerRecordUrls)

    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.assetPath] = row.mappedUrl
    }

    replaceGeneratedBannerRecordUrls(map)
    return map
  })

export const getGeneratedBannerRecordUrlsQueryOptions = queryOptions({
  queryKey: ['banner-record-urls'] as const,
  queryFn: () => getGeneratedBannerRecordUrls(),
  staleTime: Number.POSITIVE_INFINITY,
})
