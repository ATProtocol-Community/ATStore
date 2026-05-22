import type { FundingDetail } from "#/lib/atproto/load-funding-summaries";
import type { DirectoryCategoryTreeNode } from "#/lib/directory-categories";
import type { SummaryScopeHumanRow } from "#/lib/oauth-listing-auth-probe";

/** Bump when the JSON shape changes; readers should tolerate unknown fields. */
export const LISTING_PAGE_SNAPSHOT_VERSION = 1;

/** Mirrors `DirectoryListingOAuthProbe` without importing the API module. */
export type SnapshotOAuthProbe = {
  status: string;
  probedAt: string | null;
  probedUrl: string | null;
  probeError: string | null;
  oauthScopesDistinct: Array<string>;
  transitionalScopes: Array<string>;
  publishesAtprotoScope: boolean | null;
  clientScopeRawLine: string | null;
  clientScopeSyntaxOk: boolean | null;
  oauthClientScopesDistinct: Array<string>;
  hasProtectedResourceMetadata: boolean;
  hasAuthorizationServerMetadata: boolean;
  successfulClientMetadataUrl: string | null;
  scopeHumanReadable: Array<SummaryScopeHumanRow>;
  oauthLexiconKeys: Array<string>;
};

export type SnapshotListingCard = {
  id: string;
  name: string;
  slug?: string | null;
  tagline: string;
  description: string;
  iconUrl: string | null;
  heroImageUrl: string | null;
  categorySlug: string | null;
  categorySlugs: Array<string>;
  category: string;
  accent: "blue" | "pink" | "purple" | "green";
  rating: number | null;
  reviewCount: number;
  priceLabel: string;
  productAccountHandle: string | null;
  appTags: Array<string>;
};

export type SnapshotReview = {
  id: string;
  authorDid: string;
  rating: number;
  text: string | null;
  reviewCreatedAt: string;
  authorDisplayName: string | null;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  replyCount: number;
  canReply: boolean;
};

export type SnapshotMention = {
  id: string;
  postUri: string;
  bskyPostUrl: string | null;
  authorDid: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  postText: string | null;
  postFacets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{
      $type: string;
      uri?: string;
      did?: string;
      tag?: string;
    }>;
  }> | null;
  postCreatedAt: string;
  matchType: string;
  matchConfidence: number;
  matchEvidence: Record<string, {}> | null;
  postEmbed: {
    type: "external_link";
    uri: string;
    title: string | null;
    description: string | null;
    thumbUrl: string | null;
  } | null;
};

export type SnapshotProductUpdate = {
  id: string;
  atUri: string;
  title: string | null;
  description: string | null;
  path: string;
  publishedAt: string;
  canonicalPostUrl: string | null;
  coverImageUrl: string | null;
};

export type StoreListingPageSnapshotPayload = {
  version: typeof LISTING_PAGE_SNAPSHOT_VERSION;
  isStoreManaged: boolean;
  /** Repo-level Germ DM link when resolvable without a viewer session. */
  germDmHref: string | null;
  oauthProbe: SnapshotOAuthProbe | null;
  fundingDetail: FundingDetail | null;
  reviewPreview: Array<SnapshotReview>;
  mentions: Array<SnapshotMention>;
  mentionTotal: number;
  productUpdates: Array<SnapshotProductUpdate>;
  productUpdatesPublicationUrl: string | null;
  relatedByTag: Array<SnapshotListingCard>;
  relatedInCategory: Array<SnapshotListingCard>;
  relatedByLexicon: Array<SnapshotListingCard>;
  ecosystemChildren: Array<DirectoryCategoryTreeNode> | null;
};
