import { sql } from 'drizzle-orm'
import {
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

export const directoryListings = pgTable(
  'directory_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceUrl: text('source_url').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    externalUrl: text('external_url'),
    iconUrl: text('icon_url'),
    screenshotUrls: text('screenshot_urls').array().notNull(),
    tagline: text('tagline'),
    fullDescription: text('full_description'),
    rawCategoryHint: text('raw_category_hint'),
    scope: text('scope'),
    productType: text('product_type'),
    domain: text('domain'),
    categorySlug: text('category_slug'),
    vertical: text('vertical'),
    classificationReason: text('classification_reason'),
    appTags: text('app_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex('directory_listings_source_url_idx').on(
      table.sourceUrl,
    ),
    slugIdx: uniqueIndex('directory_listings_slug_idx').on(table.slug),
    externalUrlIdx: index('directory_listings_external_url_idx').on(
      table.externalUrl,
    ),
    taxonomyIdx: index('directory_listings_taxonomy_idx').on(
      table.scope,
      table.productType,
      table.domain,
    ),
    categorySlugIdx: index('directory_listings_category_slug_idx').on(
      table.categorySlug,
    ),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Embedding = typeof embeddings.$inferSelect
export type NewEmbedding = typeof embeddings.$inferInsert
export type DirectoryListing = typeof directoryListings.$inferSelect
export type NewDirectoryListing = typeof directoryListings.$inferInsert
