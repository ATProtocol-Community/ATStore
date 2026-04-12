/** AT Store lexicon NSIDs (`fyi.atstore.*`). */
export const NSID = {
  authBasic: 'fyi.atstore.authBasic',
  profile: 'fyi.atstore.profile',
  listingDetail: 'fyi.atstore.listing.detail',
  listingReview: 'fyi.atstore.listing.review',
  listingFavorite: 'fyi.atstore.listing.favorite',
  lexiconSchema: 'com.atproto.lexicon.schema',
} as const

export const COLLECTION = {
  authBasic: NSID.authBasic,
  profile: NSID.profile,
  listingDetail: NSID.listingDetail,
  listingReview: NSID.listingReview,
  listingFavorite: NSID.listingFavorite,
  lexiconSchema: NSID.lexiconSchema,
} as const
