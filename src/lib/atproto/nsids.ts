/** AT Store lexicon NSIDs (`fyi.atstore.*`). */
export const NSID = {
  authBasic: "fyi.atstore.authBasic",
  profile: "fyi.atstore.profile",
  listingDetail: "fyi.atstore.listing.detail",
  listingReview: "fyi.atstore.listing.review",
  listingReviewReply: "fyi.atstore.listing.reviewReply",
  listingFavorite: "fyi.atstore.listing.favorite",
  lexiconSchema: "com.atproto.lexicon.schema",
} as const;

/** Standard.site (product updates / permalinks). */
export const STANDARD_SITE_NSID = {
  document: "site.standard.document",
  publication: "site.standard.publication",
} as const;

export const COLLECTION = {
  authBasic: NSID.authBasic,
  profile: NSID.profile,
  listingDetail: NSID.listingDetail,
  listingReview: NSID.listingReview,
  listingReviewReply: NSID.listingReviewReply,
  listingFavorite: NSID.listingFavorite,
  lexiconSchema: NSID.lexiconSchema,
  standardDocument: STANDARD_SITE_NSID.document,
  standardPublication: STANDARD_SITE_NSID.publication,
} as const;
