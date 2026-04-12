ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "favorite_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "mention_count_24h" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "mention_count_7d" integer DEFAULT 0 NOT NULL;
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "trending_score" double precision;
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "trending_updated_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "store_listings" sl
SET "favorite_count" = COALESCE(fc.c, 0)
FROM (
  SELECT "store_listing_id", count(*)::int AS c
  FROM "store_listing_favorites"
  GROUP BY "store_listing_id"
) fc
WHERE sl.id = fc.store_listing_id;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listings_trending_score_idx" ON "store_listings" USING btree ("trending_score");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jetstream_consumer_state" (
	"id" text PRIMARY KEY NOT NULL,
	"time_us" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_listing_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"source" text NOT NULL,
	"post_uri" text NOT NULL,
	"post_cid" text,
	"author_did" text NOT NULL,
	"author_handle" text,
	"post_text" text,
	"post_created_at" timestamp with time zone NOT NULL,
	"match_type" text NOT NULL,
	"match_confidence" double precision DEFAULT 1 NOT NULL,
	"match_evidence" jsonb,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_listing_mentions_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_listing_mentions_listing_post_uri_idx" ON "store_listing_mentions" USING btree ("store_listing_id","post_uri");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listing_mentions_listing_created_idx" ON "store_listing_mentions" USING btree ("store_listing_id","post_created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listing_mentions_post_uri_idx" ON "store_listing_mentions" USING btree ("post_uri");
