/**
 * Persisted beside `store_listing_oauth_discovery.detail_json` for debugging and follow-up.
 */
export type StoreListingOauthDiscoveryDetail = {
  wellKnown?: {
    inputUrl: string;
    clientMetadataAttempts: Array<{ url: string; ok: boolean; error?: string }>;
  };
  playwright?: {
    startUrl: string;
    loginCandidates: Array<{ href: string; text: string }>;
    visitedUrls?: Array<string>;
    capturedClientMetadataUrls: Array<string>;
    classification?: {
      appPasswordMentioned: boolean;
      oauthMentioned: boolean;
    };
    attemptedAutomatedLogin?: boolean;
  };
  manual?: {
    choice: string;
    pageUrlWhenResolved?: string;
    authorizationPageProbe?: {
      hintTargets: Array<string>;
      firstH3?: { rawText: string; extractedUrl: string | null };
      attempts: Array<{
        target: string;
        clientMetadataFoundUrl: string | null;
        error?: string;
      }>;
    };
  };
};
