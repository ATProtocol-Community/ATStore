ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "listing_type" text DEFAULT 'app' NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "game_define_at_uri" text;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "game_define_prior_at_uris" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "game_details" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listings_listing_type_idx" ON "store_listings" USING btree ("listing_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_listings_game_define_at_uri_idx" ON "store_listings" USING btree ("game_define_at_uri");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listings_game_define_prior_at_uris_idx" ON "store_listings" USING gin ("game_define_prior_at_uris");
