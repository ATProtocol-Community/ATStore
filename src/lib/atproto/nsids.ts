/** AT Store lexicon NSIDs (`fyi.atstore.*`). */
export const NSID = {
  authBasic: "fyi.atstore.authBasic",
  authThirdPartyReviews: "fyi.atstore.authThirdPartyReviews",
  profile: "fyi.atstore.profile",
  listingDetail: "fyi.atstore.listing.detail",
  listingReview: "fyi.atstore.listing.review",
  listingReviewReply: "fyi.atstore.listing.reviewReply",
  listingFavorite: "fyi.atstore.listing.favorite",
  lexiconSchema: "com.atproto.lexicon.schema",
  directorySearchListings: "fyi.atstore.directory.searchListings",
  directoryGetListing: "fyi.atstore.directory.getListing",
  reviewsListForListing: "fyi.atstore.reviews.listForListing",
  serverDescribe: "fyi.atstore.server.describe",
} as const;

/** Stable strings for `/xrpc/:nsid` routing and docs. */
export const ATSTORE_XRPC_METHOD = {
  directorySearchListings: NSID.directorySearchListings,
  directoryGetListing: NSID.directoryGetListing,
  reviewsListForListing: NSID.reviewsListForListing,
  serverDescribe: NSID.serverDescribe,
} as const;

/** Standard.site (product updates / permalinks). */
export const STANDARD_SITE_NSID = {
  document: "site.standard.document",
  publication: "site.standard.publication",
} as const;

/** Germ Network (encrypted DM declaration on actor repos). */
export const GERMNETWORK_NSID = {
  declaration: "com.germnetwork.declaration",
} as const;

/**
 * at.fund NSIDs — lexicons owned by https://github.com/andyschwab/at.fund.
 * ATStore mirrors these records read-only via the Tap consumer + on-demand backfill;
 * we never publish them ourselves, so they're absent from `atproto:publish-lexicons`.
 */
export const FUND_NSID = {
  actorDeclaration: "fund.at.actor.declaration",
  fundingContribute: "fund.at.funding.contribute",
  fundingChannel: "fund.at.funding.channel",
  fundingPlan: "fund.at.funding.plan",
  graphDependency: "fund.at.graph.dependency",
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
  germnetworkDeclaration: GERMNETWORK_NSID.declaration,
  fundActorDeclaration: FUND_NSID.actorDeclaration,
  fundFundingContribute: FUND_NSID.fundingContribute,
  fundFundingChannel: FUND_NSID.fundingChannel,
  fundFundingPlan: FUND_NSID.fundingPlan,
  fundGraphDependency: FUND_NSID.graphDependency,
} as const;
