import {
  and,
  asc,
  eq,
  isNotNull,
  not,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { getAtstoreRepoDid } from '#/lib/atproto/publish-directory-listing'

/** Two-segment `protocol/…` slug — directory "Protocol" listings; not claimable as app product listings. */
function sqlCategorySlugsHasProtocolBrowseableSegment(
  categorySlugs: AnyPgColumn,
): SQL {
  return sql<boolean>`exists (
    select 1 from unnest(${categorySlugs}) as u(slug)
    where cardinality(string_to_array(trim(both from u.slug::text), '/')) = 2
      and trim(both from u.slug::text) like 'protocol/%'
  )`
}

/** Client-visible cookie; when set, OAuth callback will not redirect to `/product/claim`. */
export const SKIP_PRODUCT_CLAIM_COOKIE = 'atstore_skip_product_claim'

export function cookieHeaderSkipsProductClaim(
  cookieHeader: string | null | undefined,
): boolean {
  if (!cookieHeader) return false
  return /(?:^|;\s*)atstore_skip_product_claim=1(?:;|$)/.test(cookieHeader)
}

/**
 * Listings still on the AT Store repo whose product account DID matches `productAccountDid`
 * (user can claim them onto their PDS).
 */
export async function findEligibleProductClaimsForDid(
  db: Database,
  productAccountDid: string,
): Promise<
  {
    id: string
    name: string
    slug: string
    tagline: string | null
    iconUrl: string | null
    heroImageUrl: string | null
  }[]
> {
  const atstoreDid = await getAtstoreRepoDid()
  const t = schema.storeListings
  return db
    .select({
      id: t.id,
      name: t.name,
      slug: t.slug,
      tagline: t.tagline,
      iconUrl: t.iconUrl,
      heroImageUrl: t.heroImageUrl,
    })
    .from(t)
    .where(
      and(
        eq(t.verificationStatus, 'verified'),
        eq(t.productAccountDid, productAccountDid),
        eq(t.repoDid, atstoreDid),
        isNotNull(t.atUri),
        isNotNull(t.rkey),
        not(sqlCategorySlugsHasProtocolBrowseableSegment(t.categorySlugs)),
      ),
    )
    .orderBy(asc(t.name))
}

export async function countEligibleProductClaimsForDid(
  db: Database,
  productAccountDid: string,
): Promise<number> {
  const rows = await findEligibleProductClaimsForDid(db, productAccountDid)
  return rows.length
}
