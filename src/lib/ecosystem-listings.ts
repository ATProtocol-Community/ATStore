import type { DirectoryListingCard } from '../integrations/tanstack-query/api-directory-listings.functions'
import { getEcosystemHeroAssetPathForCategory } from './ecosystem-hero-art'

export function getListingsForCategoryBranch(
  categoryId: string,
  listings: DirectoryListingCard[],
): DirectoryListingCard[] {
  return listings.filter((listing) => {
    const slugs = listing.categorySlugs?.length
      ? listing.categorySlugs
      : listing.categorySlug
        ? [listing.categorySlug]
        : []
    if (slugs.length === 0) {
      return false
    }

    return slugs.some(
      (slug) => slug === categoryId || slug.startsWith(`${categoryId}/`),
    )
  })
}

/**
 * Picks a hero image for a category branch, preferring the bespoke ecosystem
 * hero art generated for the branch. When the branch has no generated hero
 * art we intentionally return `null` so the card/banner renders its gradient
 * fallback instead of borrowing a random listing's app screenshot.
 */
export function pickListingImageForCategoryBranch(
  categoryId: string,
  _listings: DirectoryListingCard[],
): string | null {
  return getEcosystemHeroAssetPathForCategory(categoryId)
}

export function formatEcosystemListingCount(count: number): string {
  return `${count} ${count === 1 ? 'listing' : 'listings'}`
}
