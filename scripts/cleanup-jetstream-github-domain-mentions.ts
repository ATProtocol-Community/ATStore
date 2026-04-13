#!/usr/bin/env node
/**
 * Remove false-positive Jetstream mentions created by broad shared-host
 * domain matching and recompute listing trending denorms.
 */
import 'dotenv/config'

import { and, eq, sql } from 'drizzle-orm'

import * as schema from '#/db/schema'
import { recomputeListingTrending } from '#/lib/trending/recompute-listing-trending'

const SHARED_HOSTS = ['github.com', 'apps.apple.com'] as const

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[cleanup:shared-domain] DATABASE_URL is required.')
    process.exit(1)
  }

  const dryRun = process.argv.includes('--dry-run')
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='))
  const slugFilter = slugArg ? slugArg.slice('--slug='.length).trim() : null
  const hostArg = process.argv.find((arg) => arg.startsWith('--host='))
  const hostFilter = hostArg ? hostArg.slice('--host='.length).trim() : null
  const selectedHosts = hostFilter ? [hostFilter] : [...SHARED_HOSTS]

  if (selectedHosts.length === 0) {
    console.error('[cleanup:shared-domain] no hosts selected.')
    process.exit(1)
  }

  const { db } = await import('#/db/index.server')

  const sharedHostEvidencePredicate = sql`
    coalesce(${schema.storeListingMentions.matchEvidence} ->> 'host', '') in (${sql.join(
      selectedHosts.map((host) => sql`${host}`),
      sql`, `,
    )})
  `

  const rows = await db
    .select({
      id: schema.storeListingMentions.id,
      storeListingId: schema.storeListingMentions.storeListingId,
      postUri: schema.storeListingMentions.postUri,
    })
    .from(schema.storeListingMentions)
    .innerJoin(
      schema.storeListings,
      eq(schema.storeListings.id, schema.storeListingMentions.storeListingId),
    )
    .where(
      and(
        eq(schema.storeListingMentions.source, 'jetstream'),
        eq(schema.storeListingMentions.matchType, 'url'),
        sharedHostEvidencePredicate,
        slugFilter ? eq(schema.storeListings.slug, slugFilter) : sql`true`,
      ),
    )

  if (rows.length === 0) {
    console.log(
      `[cleanup:github-domain] no rows matched; nothing to ${dryRun ? 'report' : 'delete'}.`,
    )
    process.exit(0)
  }

  const affectedListingIds = [...new Set(rows.map((r) => r.storeListingId))]
  const affectedPostUris = new Set(rows.map((r) => r.postUri))

  if (dryRun) {
    console.log(
      `[cleanup:github-domain] dry run: would delete ${String(rows.length)} mention rows across ${String(affectedListingIds.length)} listings (${String(affectedPostUris.size)} unique posts).`,
    )
    process.exit(0)
  }

  console.log(
    `[cleanup:github-domain] deleting ${String(rows.length)} mention rows across ${String(affectedListingIds.length)} listings (${String(affectedPostUris.size)} unique posts)...`,
  )

  await db
    .delete(schema.storeListingMentions)
    .where(
      and(
        eq(schema.storeListingMentions.source, 'jetstream'),
        eq(schema.storeListingMentions.matchType, 'url'),
        sharedHostEvidencePredicate,
        slugFilter
          ? eq(
              schema.storeListingMentions.storeListingId,
              sql`(
                select ${schema.storeListings.id}
                from ${schema.storeListings}
                where ${schema.storeListings.slug} = ${slugFilter}
                limit 1
              )`,
            )
          : sql`true`,
      ),
    )

  let i = 0
  for (const listingId of affectedListingIds) {
    await recomputeListingTrending(db, listingId)
    i += 1
    if (i % 200 === 0) {
      console.log(
        `[cleanup:github-domain] recomputed trending ${String(i)}/${String(affectedListingIds.length)}`,
      )
    }
  }

  console.log(
    `[cleanup:github-domain] done. deleted ${String(rows.length)} rows, recomputed ${String(affectedListingIds.length)} listings.`,
  )

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
