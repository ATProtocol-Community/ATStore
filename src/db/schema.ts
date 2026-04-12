import { relations, sql } from 'drizzle-orm'
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
} from 'drizzle-orm/pg-core'

// Update this to match the embedding model you actually store.
export const EMBEDDING_DIMENSIONS = 1536 as const

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/** ATProto OAuth / app identity (Better Auth–shaped rows). */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  did: text('did').unique(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

/** KV store for OAuth state and ATProto OAuth session blobs (atcute). */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    embeddingModel: text('embedding_model').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceLookupIdx: uniqueIndex('embeddings_source_lookup_idx').on(
      table.sourceType,
      table.sourceId,
      table.embeddingModel,
    ),
    embeddingCosineIdx: index('embeddings_embedding_cosine_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
)

/** Tap-sync mirror of `fyi.atstore.listing.detail` — public listing read model. */
export const storeListings = pgTable(
  'store_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceUrl: text('source_url').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    externalUrl: text('external_url'),
    iconUrl: text('icon_url'),
    screenshotUrls: text('screenshot_urls').array().notNull().default(sql`'{}'::text[]`),
    tagline: text('tagline'),
    fullDescription: text('full_description'),
    categorySlugs: text('category_slugs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    appTags: text('app_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    atUri: text('at_uri'),
    repoDid: text('repo_did'),
    rkey: text('rkey'),
    heroImageUrl: text('hero_image_url'),
    verificationStatus: text('verification_status')
      .notNull()
      .default('verified'),
    sourceAccountDid: text('source_account_did'),
    claimedByDid: text('claimed_by_did'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /** Official Bluesky account for the product (from `fyi.atstore.listing.detail`). */
    productAccountDid: text('product_account_did'),
    /** Resolved via public API at Tap ingest; not stored on the ATProto record. */
    productAccountHandle: text('product_account_handle'),
    /** Dev tooling override: hide listings that intentionally have no product handle. */
    productAccountHandleIgnoredAt: timestamp('product_account_handle_ignored_at', {
      withTimezone: true,
    }),
    /**
     * Mirror of `fyi.atstore.listing.detail.migratedFromAtUri` — prior listing detail AT URI after a PDS claim.
     * Used with `at_uri` so review ingest can resolve `subject` before and after migration.
     */
    migratedFromAtUri: text('migrated_from_at_uri'),
    /**
     * Mirror of `fyi.atstore.listing.detail.claimKey` from Tap (AT Store repo only). Nulled on successful claim (one-time).
     */
    claimKey: text('claim_key'),
    /** Denormalized from `store_listing_reviews` (Tap ingest). */
    reviewCount: integer('review_count').notNull().default(0),
    /** Null when `reviewCount` is 0; else mean of star ratings (1–5). */
    averageRating: doublePrecision('average_rating'),
    /** Denormalized from `store_listing_favorites` (Tap ingest). */
    favoriteCount: integer('favorite_count').notNull().default(0),
    /** Bluesky posts in last 24h (Jetstream); denormalized for cards/admin. */
    mentionCount24h: integer('mention_count_24h').notNull().default(0),
    mentionCount7d: integer('mention_count_7d').notNull().default(0),
    /** Cached decayed trending score; null until first compute/backfill. */
    trendingScore: doublePrecision('trending_score'),
    trendingUpdatedAt: timestamp('trending_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex('store_listings_source_url_idx').on(table.sourceUrl),
    slugIdx: uniqueIndex('store_listings_slug_idx').on(table.slug),
    externalUrlIdx: index('store_listings_external_url_idx').on(table.externalUrl),
    categorySlugsIdx: index('store_listings_category_slugs_idx').using(
      'gin',
      table.categorySlugs,
    ),
    atUriIdx: uniqueIndex('store_listings_at_uri_idx').on(table.atUri),
    verificationIdx: index('store_listings_verification_status_idx').on(
      table.verificationStatus,
    ),
    migratedFromAtUriIdx: index('store_listings_migrated_from_at_uri_idx').on(
      table.migratedFromAtUri,
    ),
    repoRkeyIdx: uniqueIndex('store_listings_repo_did_rkey_idx').on(
      table.repoDid,
      table.rkey,
    ),
    trendingScoreIdx: index('store_listings_trending_score_idx').on(
      table.trendingScore,
    ),
  }),
)

/** Ordered homepage hero slots managed from admin. */
export const homePageHeroListings = pgTable(
  'home_page_hero_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    position: integer('position').notNull(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    positionUniqueIdx: uniqueIndex('home_page_hero_listings_position_idx').on(
      table.position,
    ),
    listingUniqueIdx: uniqueIndex('home_page_hero_listings_listing_idx').on(
      table.storeListingId,
    ),
  }),
)

/** Queued Bluesky account candidates for manual verification (dev tooling + discovery script). */
export const storeListingProductAccountCandidates = pgTable(
  'store_listing_product_account_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    candidateDid: text('candidate_did').notNull(),
    candidateHandle: text('candidate_handle'),
    status: text('status').notNull().default('pending'),
    /** `url_heuristic` | `google_search` | `llm` | `manual` | `import_json` */
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    listingDidUnique: uniqueIndex(
      'store_listing_product_account_candidates_listing_did_idx',
    ).on(table.storeListingId, table.candidateDid),
    statusCreatedIdx: index(
      'store_listing_product_account_candidates_status_created_idx',
    ).on(table.status, table.createdAt),
    listingIdx: index(
      'store_listing_product_account_candidates_store_listing_id_idx',
    ).on(table.storeListingId),
  }),
)

/** Tap-sync mirror of `fyi.atstore.listing.review` — one row per review record. */
export const storeListingReviews = pgTable(
  'store_listing_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    /** Repo DID of the reviewer (event `did`). */
    authorDid: text('author_did').notNull(),
    rkey: text('rkey').notNull(),
    atUri: text('at_uri').notNull(),
    rating: integer('rating').notNull(),
    text: text('text'),
    /** From record `createdAt` (ISO string → timestamp). */
    reviewCreatedAt: timestamp('review_created_at', {
      withTimezone: true,
    }).notNull(),
    authorDisplayName: text('author_display_name'),
    authorAvatarUrl: text('author_avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index('store_listing_reviews_store_listing_id_idx').on(
      table.storeListingId,
    ),
    atUriIdx: uniqueIndex('store_listing_reviews_at_uri_idx').on(table.atUri),
    repoRkeyIdx: uniqueIndex('store_listing_reviews_repo_rkey_idx').on(
      table.authorDid,
      table.rkey,
    ),
  }),
)

/** Tap-sync mirror of `fyi.atstore.listing.favorite` — one row per favorite record. */
export const storeListingFavorites = pgTable(
  'store_listing_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    /** Repo DID of the user who favorited this listing (event `did`). */
    authorDid: text('author_did').notNull(),
    rkey: text('rkey').notNull(),
    atUri: text('at_uri').notNull(),
    /** From record `createdAt` (ISO string -> timestamp). */
    favoriteCreatedAt: timestamp('favorite_created_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index('store_listing_favorites_store_listing_id_idx').on(
      table.storeListingId,
    ),
    authorCreatedIdx: index('store_listing_favorites_author_created_idx').on(
      table.authorDid,
      table.favoriteCreatedAt,
    ),
    atUriIdx: uniqueIndex('store_listing_favorites_at_uri_idx').on(table.atUri),
    repoRkeyIdx: uniqueIndex('store_listing_favorites_repo_rkey_idx').on(
      table.authorDid,
      table.rkey,
    ),
  }),
)

/** Jetstream consumer cursor (microseconds `time_us` from last processed event). */
export const jetstreamConsumerState = pgTable('jetstream_consumer_state', {
  id: text('id').primaryKey(),
  timeUs: bigint('time_us', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/**
 * Bluesky posts that mention a directory listing (handle / URL / name / standard.site).
 * One row per (listing, post).
 */
export const storeListingMentions = pgTable(
  'store_listing_mentions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    postUri: text('post_uri').notNull(),
    postCid: text('post_cid'),
    authorDid: text('author_did').notNull(),
    authorHandle: text('author_handle'),
    postText: text('post_text'),
    postCreatedAt: timestamp('post_created_at', { withTimezone: true }).notNull(),
    /** Primary match: handle | url | name | standard_site_doc */
    matchType: text('match_type').notNull(),
    matchConfidence: doublePrecision('match_confidence').notNull().default(1),
    matchEvidence: jsonb('match_evidence').$type<Record<string, unknown> | unknown[]>(),
    indexedAt: timestamp('indexed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingPostUnique: uniqueIndex('store_listing_mentions_listing_post_uri_idx').on(
      table.storeListingId,
      table.postUri,
    ),
    listingCreatedIdx: index('store_listing_mentions_listing_created_idx').on(
      table.storeListingId,
      table.postCreatedAt,
    ),
    postUriIdx: index('store_listing_mentions_post_uri_idx').on(table.postUri),
  }),
)

/** App-side claim workflow against @store-hosted listings (protocol layer is separate). */
export const listingClaims = pgTable(
  'listing_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeListingId: uuid('store_listing_id')
      .notNull()
      .references(() => storeListings.id, { onDelete: 'cascade' }),
    claimantDid: text('claimant_did').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    listingIdx: index('listing_claims_store_listing_id_idx').on(
      table.storeListingId,
    ),
    statusIdx: index('listing_claims_status_idx').on(table.status),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AuthUser = typeof user.$inferSelect
export type NewAuthUser = typeof user.$inferInsert
export type AuthSession = typeof session.$inferSelect
export type AuthAccount = typeof account.$inferSelect
export type Embedding = typeof embeddings.$inferSelect
export type NewEmbedding = typeof embeddings.$inferInsert
export type StoreListing = typeof storeListings.$inferSelect
export type NewStoreListing = typeof storeListings.$inferInsert
export type HomePageHeroListing = typeof homePageHeroListings.$inferSelect
export type NewHomePageHeroListing = typeof homePageHeroListings.$inferInsert
export type StoreListingReview = typeof storeListingReviews.$inferSelect
export type NewStoreListingReview = typeof storeListingReviews.$inferInsert
export type StoreListingFavorite = typeof storeListingFavorites.$inferSelect
export type NewStoreListingFavorite = typeof storeListingFavorites.$inferInsert
export type JetstreamConsumerState = typeof jetstreamConsumerState.$inferSelect
export type NewJetstreamConsumerState = typeof jetstreamConsumerState.$inferInsert
export type StoreListingMention = typeof storeListingMentions.$inferSelect
export type NewStoreListingMention = typeof storeListingMentions.$inferInsert
export type ListingClaim = typeof listingClaims.$inferSelect
export type NewListingClaim = typeof listingClaims.$inferInsert
export type StoreListingProductAccountCandidate =
  typeof storeListingProductAccountCandidates.$inferSelect
export type NewStoreListingProductAccountCandidate =
  typeof storeListingProductAccountCandidates.$inferInsert
