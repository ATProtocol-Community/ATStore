import type { DirectoryListingCard } from '../integrations/tanstack-query/api-directory-listings.functions'
import { getEcosystemHeroAssetPathForCategory } from './ecosystem-hero-art'

export function getListingsForCategoryBranch(
  categoryId: string,
  listings: DirectoryListingCard[],
): DirectoryListingCard[] {
  return listings.filter((listing) => {
    const slug = listing.categorySlug
    if (!slug) {
      return false
    }

    return slug === categoryId || slug.startsWith(`${categoryId}/`)
  })
}

/**
 * Picks a hero image for a category branch from listings that belong to that branch
 * (`categorySlug` equals the branch id or is nested under it).
 */
export function pickListingImageForCategoryBranch(
  categoryId: string,
  listings: DirectoryListingCard[],
): string | null {
  const bespokeAssetPath = getEcosystemHeroAssetPathForCategory(categoryId)
  if (bespokeAssetPath) {
    return bespokeAssetPath
  }

  const inBranch = getListingsForCategoryBranch(categoryId, listings)

  const withScreenshot = inBranch.find((listing) => listing.imageUrl)
  if (withScreenshot?.imageUrl) {
    return withScreenshot.imageUrl
  }

  const withIcon = inBranch.find((listing) => listing.iconUrl)
  return withIcon?.iconUrl ?? null
}

export function formatEcosystemListingCount(count: number): string {
  return `${count} ${count === 1 ? 'listing' : 'listings'}`
}
