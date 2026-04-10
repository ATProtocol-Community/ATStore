/** AT Store lexicon NSIDs (`fyi.atstore.*`). */
export const NSID = {
  profile: 'fyi.atstore.profile',
  listingDetail: 'fyi.atstore.listing.detail',
  lexiconSchema: 'com.atproto.lexicon.schema',
} as const

export const COLLECTION = {
  profile: NSID.profile,
  listingDetail: NSID.listingDetail,
  lexiconSchema: NSID.lexiconSchema,
} as const
