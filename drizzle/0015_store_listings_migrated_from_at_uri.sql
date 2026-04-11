ALTER TABLE "store_listings" ADD COLUMN "migrated_from_at_uri" text;--> statement-breakpoint
CREATE INDEX "store_listings_migrated_from_at_uri_idx" ON "store_listings" USING btree ("migrated_from_at_uri");
