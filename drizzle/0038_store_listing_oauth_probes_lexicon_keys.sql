ALTER TABLE "store_listing_oauth_probes" ADD COLUMN "oauth_lexicon_keys" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
CREATE INDEX "store_listing_oauth_probes_oauth_lexicon_keys_idx" ON "store_listing_oauth_probes" USING gin ("oauth_lexicon_keys");
