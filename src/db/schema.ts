import type { ListingLink } from "#/lib/atproto/listing-record";
import type { OAuthAuthProbeReport } from "#/lib/oauth-listing-auth-probe";

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// Update this to match the embedding model you actually store.
export const EMBEDDING_DIMENSIONS = 1536 as const;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** ATProto OAuth / app identity (Better Auth–shaped rows). */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  did: text("did").unique(),
  image: text("image"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  /** User's preferred color scheme: `'light' | 'dark' | null` (null = follow system). */
  themeMode: text("theme_mode"),
  /**
   * When the user last cleared the notifications inbox (mark all read).
   * Used instead of browser localStorage so counts stay correct across devices.
   */
  notificationsReadAt: timestamp("notifications_read_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

/** KV store for OAuth state and ATProto OAuth session blobs (atcute). */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceLookupIdx: uniqueIndex("embeddings_source_lookup_idx").on(
      table.sourceType,
      table.sourceId,
      table.embeddingModel,
    ),
    embeddingCosineIdx: index("embeddings_embedding_cosine_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);

/** Tap-sync mirror of `fyi.atstore.listing.detail` — public listing read model. */
export const storeListings = pgTable(
  "store_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceUrl: text("source_url").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    externalUrl: text("external_url"),
    iconUrl: text("icon_url"),
    screenshotUrls: text("screenshot_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tagline: text("tagline"),
    fullDescription: text("full_description"),
    categorySlugs: text("category_slugs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    appTags: text("app_tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /**
     * Mirror of `fyi.atstore.listing.detail#main.properties.links` —
     * trust/compliance/support/project links shown as chips on the detail page.
     */
    links: jsonb("links")
      .$type<Array<ListingLink>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    atUri: text("at_uri"),
    repoDid: text("repo_did"),
    rkey: text("rkey"),
    heroImageUrl: text("hero_image_url"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("verified"),
    sourceAccountDid: text("source_account_did"),
    claimedByDid: text("claimed_by_did"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /** Official Bluesky account for the product (from `fyi.atstore.listing.detail`). */
    productAccountDid: text("product_account_did"),
    /** Resolved via public API at Tap ingest; not stored on the ATProto record. */
    productAccountHandle: text("product_account_handle"),
    /** Dev tooling override: hide listings that intentionally have no product handle. */
    productAccountHandleIgnoredAt: timestamp(
      "product_account_handle_ignored_at",
      {
        withTimezone: true,
      },
    ),
    /**
     * Mirror of `fyi.atstore.listing.detail.migratedFromAtUri` — prior listing detail AT URI after a PDS claim.
     * Used with `at_uri` so review ingest can resolve `subject` before and after migration.
     */
    migratedFromAtUri: text("migrated_from_at_uri"),
    /**
     * DID expected to publish the post-claim record. Set when the user starts a claim (server fn);
     * Tap ingest verifies any incoming listing record's repo DID against this value (combined with
     * `migratedFromAtUri` lineage) before marking `verified`. Cleared on successful verification or
     * rollback.
     */
    claimPendingForDid: text("claim_pending_for_did"),
    /** Denormalized from `store_listing_reviews` (Tap ingest). */
    reviewCount: integer("review_count").notNull().default(0),
    /** Null when `reviewCount` is 0; else mean of star ratings (1–5). */
    averageRating: doublePrecision("average_rating"),
    /** Denormalized from `store_listing_favorites` (Tap ingest). */
    favoriteCount: integer("favorite_count").notNull().default(0),
    /** Bluesky posts in last 24h (Jetstream); denormalized for cards/admin. */
    mentionCount24h: integer("mention_count_24h").notNull().default(0),
    mentionCount7d: integer("mention_count_7d").notNull().default(0),
    /** Cached decayed trending score; null until first compute/backfill. */
    trendingScore: doublePrecision("trending_score"),
    trendingUpdatedAt: timestamp("trending_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex("store_listings_source_url_idx").on(
      table.sourceUrl,
    ),
    slugIdx: uniqueIndex("store_listings_slug_idx").on(table.slug),
    externalUrlIdx: index("store_listings_external_url_idx").on(
      table.externalUrl,
    ),
    categorySlugsIdx: index("store_listings_category_slugs_idx").using(
      "gin",
      table.categorySlugs,
    ),
    atUriIdx: uniqueIndex("store_listings_at_uri_idx").on(table.atUri),
    verificationIdx: index("store_listings_verification_status_idx").on(
      table.verificationStatus,
    ),
    migratedFromAtUriIdx: index("store_listings_migrated_from_at_uri_idx").on(
      table.migratedFromAtUri,
    ),
    repoRkeyIdx: uniqueIndex("store_listings_repo_did_rkey_idx").on(
      table.repoDid,
      table.rkey,
    ),
    trendingScoreIdx: index("store_listings_trending_score_idx").on(
      table.trendingScore,
    ),
  }),
);

/**
 * Tap / backfill mirror of `site.standard.publication` for product repos (`store_listings.product_account_did`).
 * One row per publication record; canonical permalink uses `baseUrl` + document `path`.
 */
export const productSitePublications = pgTable(
  "product_site_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoDid: text("repo_did").notNull(),
    rkey: text("rkey").notNull(),
    atUri: text("at_uri").notNull(),
    baseUrl: text("base_url").notNull(),
    publicationName: text("publication_name"),
    recordJson: jsonb("record_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    atUriIdx: uniqueIndex("product_site_publications_at_uri_idx").on(
      table.atUri,
    ),
    repoRkeyIdx: uniqueIndex("product_site_publications_repo_did_rkey_idx").on(
      table.repoDid,
      table.rkey,
    ),
    repoDidIdx: index("product_site_publications_repo_did_idx").on(
      table.repoDid,
    ),
  }),
);

/**
 * Tap / backfill mirror of `site.standard.document` for product repos.
 */
export const productSiteDocuments = pgTable(
  "product_site_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repoDid: text("repo_did").notNull(),
    rkey: text("rkey").notNull(),
    atUri: text("at_uri").notNull(),
    publicationAtUri: text("publication_at_uri"),
    title: text("title"),
    description: text("description"),
    path: text("path").notNull(),
    documentPublishedAt: timestamp("document_published_at", {
      withTimezone: true,
    }).notNull(),
    /** Bluesky CDN URL from `site.standard.document#coverImage` (see `blobLikeToBskyCdnUrl`). */
    coverImageUrl: text("cover_image_url"),
    recordJson: jsonb("record_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    atUriIdx: uniqueIndex("product_site_documents_at_uri_idx").on(table.atUri),
    repoRkeyIdx: uniqueIndex("product_site_documents_repo_did_rkey_idx").on(
      table.repoDid,
      table.rkey,
    ),
    repoPublishedIdx: index("product_site_documents_repo_published_idx").on(
      table.repoDid,
      table.documentPublishedAt,
    ),
  }),
);

/**
 * Append-only moderation log: each row is one admin rejection with a human-readable reason.
 * Not touched by Tap ingest. Cleared from the active UX by moving status off `rejected`, not by DELETE.
 */
export const storeListingRejectionEvents = pgTable(
  "store_listing_rejection_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    reviewerDid: text("reviewer_did"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index("store_listing_rejection_events_store_listing_id_idx").on(
      table.storeListingId,
    ),
    listingCreatedIdx: index(
      "store_listing_rejection_events_listing_created_idx",
    ).on(table.storeListingId, table.createdAt),
  }),
);

/** Append-only: admin verified a listing — drives owner notifications alongside rejection events. */
export const storeListingVerificationApprovalEvents = pgTable(
  "store_listing_verification_approval_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    reviewerDid: text("reviewer_did"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index(
      "store_listing_verification_approval_events_store_listing_id_idx",
    ).on(table.storeListingId),
    listingCreatedIdx: index(
      "store_listing_verification_approval_events_listing_created_idx",
    ).on(table.storeListingId, table.createdAt),
  }),
);

/**
 * Periodic OAuth / auth-metadata probe keyed by storefront `external_url` (see
 * `scripts/sync-listing-oauth-probes.ts`). Intended for dashboards (issue #19) and alerting.
 */
export const storeListingOAuthProbes = pgTable(
  "store_listing_oauth_probes",
  {
    /** One persisted snapshot per listing. */
    storeListingId: uuid("store_listing_id")
      .primaryKey()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    /**
     * `completed`: probe ran
     * `skipped_no_url`: listing has no usable `external_url`
     * `error`: threw before completing (see `probeError`)
     */
    status: text("status").notNull(),
    probeError: text("probe_error"),
    probedUrl: text("probed_url"),
    probedAt: timestamp("probed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    oauthScopesDistinct: text("oauth_scopes_distinct")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    transitionalScopes: text("transitional_scopes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    publishesAtprotoScope: boolean("publishes_atproto_scope"),

    clientScopeRawLine: text("client_scope_raw_line"),
    clientScopeSyntaxOk: boolean("client_scope_syntax_ok"),

    hasProtectedResourceMetadata: boolean(
      "has_protected_resource_metadata",
    ).notNull(),
    hasAuthorizationServerMetadata: boolean(
      "has_authorization_server_metadata",
    ).notNull(),
    successfulClientMetadataUrl: text("successful_client_metadata_url"),

    reportJson: jsonb("report_json").$type<OAuthAuthProbeReport>(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("store_listing_oauth_probes_probed_at_idx").on(table.probedAt),
    index("store_listing_oauth_probes_slug_idx").on(table.slug),
  ],
);

/** Ordered homepage hero slots managed from admin. */
export const homePageHeroListings = pgTable(
  "home_page_hero_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    position: integer("position").notNull(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    positionUniqueIdx: uniqueIndex("home_page_hero_listings_position_idx").on(
      table.position,
    ),
    listingUniqueIdx: uniqueIndex("home_page_hero_listings_listing_idx").on(
      table.storeListingId,
    ),
  }),
);

/**
 * Singleton table holding the listing shown in the homepage promo card slot.
 * Empty when no promo is configured (homepage falls back to auto-pick).
 */
export const homePagePromoListing = pgTable("home_page_promo_listing", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeListingId: uuid("store_listing_id")
    .notNull()
    .references(() => storeListings.id, { onDelete: "cascade" })
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Queued Bluesky account candidates for manual verification (dev tooling + discovery script). */
export const storeListingProductAccountCandidates = pgTable(
  "store_listing_product_account_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    candidateDid: text("candidate_did").notNull(),
    candidateHandle: text("candidate_handle"),
    status: text("status").notNull().default("pending"),
    /** `url_heuristic` | `google_search` | `llm` | `manual` | `import_json` */
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    listingDidUnique: uniqueIndex(
      "store_listing_product_account_candidates_listing_did_idx",
    ).on(table.storeListingId, table.candidateDid),
    statusCreatedIdx: index(
      "store_listing_product_account_candidates_status_created_idx",
    ).on(table.status, table.createdAt),
    listingIdx: index(
      "store_listing_product_account_candidates_store_listing_id_idx",
    ).on(table.storeListingId),
  }),
);

/** Tap-sync mirror of `fyi.atstore.listing.review` — one row per review record. */
export const storeListingReviews = pgTable(
  "store_listing_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    /** Repo DID of the reviewer (event `did`). */
    authorDid: text("author_did").notNull(),
    rkey: text("rkey").notNull(),
    atUri: text("at_uri").notNull(),
    rating: integer("rating").notNull(),
    text: text("text"),
    /** From record `createdAt` (ISO string → timestamp). */
    reviewCreatedAt: timestamp("review_created_at", {
      withTimezone: true,
    }).notNull(),
    authorDisplayName: text("author_display_name"),
    authorAvatarUrl: text("author_avatar_url"),
    /** Mirrors count of mirrored `fyi.atstore.listing.reviewReply` rows (recomputed on ingest). */
    replyCount: integer("reply_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index("store_listing_reviews_store_listing_id_idx").on(
      table.storeListingId,
    ),
    atUriIdx: uniqueIndex("store_listing_reviews_at_uri_idx").on(table.atUri),
    repoRkeyIdx: uniqueIndex("store_listing_reviews_repo_rkey_idx").on(
      table.authorDid,
      table.rkey,
    ),
  }),
);

/** Tap-sync mirror of `fyi.atstore.listing.reviewReply` — one row per reply record. */
export const storeListingReviewReplies = pgTable(
  "store_listing_review_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => storeListingReviews.id, { onDelete: "cascade" }),
    /** Repo DID of the replier (`RecordEvent.did`). */
    authorDid: text("author_did").notNull(),
    rkey: text("rkey").notNull(),
    atUri: text("at_uri").notNull(),
    /** Lexicon record `subject` (review AT URI). */
    subjectUri: text("subject_uri").notNull(),
    text: text("text").notNull(),
    replyCreatedAt: timestamp("reply_created_at", {
      withTimezone: true,
    }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index("store_listing_review_replies_store_listing_id_idx").on(
      table.storeListingId,
    ),
    reviewIdx: index("store_listing_review_replies_review_id_idx").on(
      table.reviewId,
    ),
    reviewCreatedIdx: index(
      "store_listing_review_replies_review_created_idx",
    ).on(table.reviewId, table.replyCreatedAt),
    authorDidIdx: index("store_listing_review_replies_author_did_idx").on(
      table.authorDid,
    ),
    atUriIdx: uniqueIndex("store_listing_review_replies_at_uri_idx").on(
      table.atUri,
    ),
    repoRkeyIdx: uniqueIndex("store_listing_review_replies_repo_rkey_idx").on(
      table.authorDid,
      table.rkey,
    ),
  }),
);

/** Tap-sync mirror of `fyi.atstore.listing.favorite` — one row per favorite record. */
export const storeListingFavorites = pgTable(
  "store_listing_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    /** Repo DID of the user who favorited this listing (event `did`). */
    authorDid: text("author_did").notNull(),
    rkey: text("rkey").notNull(),
    atUri: text("at_uri").notNull(),
    /** From record `createdAt` (ISO string -> timestamp). */
    favoriteCreatedAt: timestamp("favorite_created_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index("store_listing_favorites_store_listing_id_idx").on(
      table.storeListingId,
    ),
    authorCreatedIdx: index("store_listing_favorites_author_created_idx").on(
      table.authorDid,
      table.favoriteCreatedAt,
    ),
    atUriIdx: uniqueIndex("store_listing_favorites_at_uri_idx").on(table.atUri),
    repoRkeyIdx: uniqueIndex("store_listing_favorites_repo_rkey_idx").on(
      table.authorDid,
      table.rkey,
    ),
  }),
);

/** Jetstream consumer cursor (microseconds `time_us` from last processed event). */
export const jetstreamConsumerState = pgTable("jetstream_consumer_state", {
  id: text("id").primaryKey(),
  timeUs: bigint("time_us", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Bluesky posts that mention a directory listing (handle / URL / name / standard.site).
 * One row per (listing, post).
 */
export const storeListingMentions = pgTable(
  "store_listing_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    postUri: text("post_uri").notNull(),
    postCid: text("post_cid"),
    authorDid: text("author_did").notNull(),
    authorHandle: text("author_handle"),
    postText: text("post_text"),
    postCreatedAt: timestamp("post_created_at", {
      withTimezone: true,
    }).notNull(),
    /** Primary match: handle | url | standard_site_doc (legacy rows may be `name`) */
    matchType: text("match_type").notNull(),
    matchConfidence: doublePrecision("match_confidence").notNull().default(1),
    matchEvidence: jsonb("match_evidence").$type<
      Record<string, unknown> | unknown[]
    >(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingPostUnique: uniqueIndex(
      "store_listing_mentions_listing_post_uri_idx",
    ).on(table.storeListingId, table.postUri),
    listingCreatedIdx: index("store_listing_mentions_listing_created_idx").on(
      table.storeListingId,
      table.postCreatedAt,
    ),
    postUriIdx: index("store_listing_mentions_post_uri_idx").on(table.postUri),
  }),
);

/** App-side claim workflow against @store-hosted listings (protocol layer is separate). */
export const listingClaims = pgTable(
  "listing_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeListingId: uuid("store_listing_id")
      .notNull()
      .references(() => storeListings.id, { onDelete: "cascade" }),
    claimantDid: text("claimant_did").notNull(),
    /** Proof of ownership / context for admins (manual claim path). */
    message: text("message").notNull().default(""),
    /** Bluesky handle snapshot at submit time (for admin display). */
    claimantHandle: text("claimant_handle"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedByDid: text("decided_by_did"),
    decisionNotes: text("decision_notes"),
  },
  (table) => ({
    listingIdx: index("listing_claims_store_listing_id_idx").on(
      table.storeListingId,
    ),
    statusIdx: index("listing_claims_status_idx").on(table.status),
    listingClaimantPendingUnique: uniqueIndex(
      "listing_claims_store_listing_claimant_pending_uidx",
    )
      .on(table.storeListingId, table.claimantDid)
      .where(sql`${table.status} = 'pending'`),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthUser = typeof user.$inferSelect;
export type NewAuthUser = typeof user.$inferInsert;
export type AuthSession = typeof session.$inferSelect;
export type AuthAccount = typeof account.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
export type StoreListing = typeof storeListings.$inferSelect;
export type NewStoreListing = typeof storeListings.$inferInsert;
export type HomePageHeroListing = typeof homePageHeroListings.$inferSelect;
export type NewHomePageHeroListing = typeof homePageHeroListings.$inferInsert;
export type HomePagePromoListing = typeof homePagePromoListing.$inferSelect;
export type NewHomePagePromoListing = typeof homePagePromoListing.$inferInsert;
export type StoreListingReview = typeof storeListingReviews.$inferSelect;
export type NewStoreListingReview = typeof storeListingReviews.$inferInsert;
export type StoreListingReviewReply =
  typeof storeListingReviewReplies.$inferSelect;
export type NewStoreListingReviewReply =
  typeof storeListingReviewReplies.$inferInsert;
export type StoreListingFavorite = typeof storeListingFavorites.$inferSelect;
export type NewStoreListingFavorite = typeof storeListingFavorites.$inferInsert;
export type JetstreamConsumerState = typeof jetstreamConsumerState.$inferSelect;
export type NewJetstreamConsumerState =
  typeof jetstreamConsumerState.$inferInsert;
export type StoreListingMention = typeof storeListingMentions.$inferSelect;
export type NewStoreListingMention = typeof storeListingMentions.$inferInsert;
export type ListingClaim = typeof listingClaims.$inferSelect;
export type NewListingClaim = typeof listingClaims.$inferInsert;
export type StoreListingProductAccountCandidate =
  typeof storeListingProductAccountCandidates.$inferSelect;
export type NewStoreListingProductAccountCandidate =
  typeof storeListingProductAccountCandidates.$inferInsert;
