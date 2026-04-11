import { and, asc, eq, isNotNull } from 'drizzle-orm'

import type { Database } from '#/db/index.server'
import * as schema from '#/db/schema'
import { getAtstoreRepoDid } from '#/lib/atproto/publish-directory-listing'

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
