/** AT Store lexicon NSIDs (`fyi.atstore.*`). */
export const NSID = {
  profile: 'fyi.atstore.profile',
  listingDetail: 'fyi.atstore.listing.detail',
  listingReview: 'fyi.atstore.listing.review',
  lexiconSchema: 'com.atproto.lexicon.schema',
} as const

export const COLLECTION = {
  profile: NSID.profile,
  listingDetail: NSID.listingDetail,
  listingReview: NSID.listingReview,
  lexiconSchema: NSID.lexiconSchema,
} as const
