#!/usr/bin/env node
/**
 * One-off cleanup: app tags only apply to top-level `apps/<slug>` listings.
 * Ecosystem / sub-app rows (e.g. `apps/bluesky/client`, `apps/bluesky/tool`)
 * must not carry `appTags`, but historical seed data accidentally shipped
 * tags on a couple of them.
 *
 * Clears `appTags` on every row whose primary category is not a top-level
 * `apps/<slug>`, in both the `fyi.atstore.listing.detail` record on atproto
 * (so Tap sync doesn't re-hydrate them) and the `store_listings` row (so
 * the site reflects the fix immediately).
 *
 * Requires DATABASE_URL, ATSTORE_IDENTIFIER, ATSTORE_APP_PASSWORD.
 */
import 'dotenv/config'

import { eq } from 'drizzle-orm'

import { db, dbClient } from '../src/db/index.server'
import { storeListings } from '../src/db/schema'
import { publishDirectoryListingDetail } from '../src/lib/atproto/publish-directory-listing'

function isTopLevelAppCategorySlug(slug: string): boolean {
  const parts = slug.split('/').filter(Boolean)
  return parts.length === 2 && parts[0] === 'apps'
}

async function main() {
  const rows = await db.select().from(storeListings)
  const targets = rows.filter(
    (row) =>
      (row.appTags?.length ?? 0) > 0 &&
      !(row.categorySlugs ?? []).some(isTopLevelAppCategorySlug),
  )

  if (targets.length === 0) {
    console.log('Nothing to do — no sub-app rows with app tags.')
    return
  }

  console.log(
    `Clearing appTags on ${targets.length} row(s):\n` +
      targets
        .map(
          (r) =>
            `  - ${r.name} (${r.slug}) [${r.categorySlugs?.join(', ') ?? ''}] tags=${JSON.stringify(r.appTags ?? [])}`,
        )
        .join('\n'),
  )

  const now = new Date()
  for (const row of targets) {
    if (row.atUri && row.rkey) {
      try {
        await publishDirectoryListingDetail(row, { appTags: [] })
        console.log(`  ✓ published empty appTags for ${row.slug}`)
      } catch (err) {
        console.error(
          `  ✗ failed to publish appTags for ${row.slug}: ${(err as Error).message}`,
        )
        throw err
      }
    } else {
      console.log(
        `  · ${row.slug} has no atproto record (rkey missing) — DB update only`,
      )
    }

    await db
      .update(storeListings)
      .set({ appTags: [], updatedAt: now })
      .where(eq(storeListings.id, row.id))
  }

  console.log(`Done. Cleared appTags on ${targets.length} row(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
