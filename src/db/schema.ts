import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
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
    repoRkeyIdx: uniqueIndex('store_listings_repo_did_rkey_idx').on(
      table.repoDid,
      table.rkey,
    ),
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
export type ListingClaim = typeof listingClaims.$inferSelect
export type NewListingClaim = typeof listingClaims.$inferInsert
