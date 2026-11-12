ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "prior_at_uris" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "transfer_offered_to_did" text;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "transfer_offered_to_handle" text;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN IF NOT EXISTS "transfer_offered_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "store_listings" SET "prior_at_uris" = ARRAY["migrated_from_at_uri"] WHERE "migrated_from_at_uri" IS NOT NULL AND cardinality("prior_at_uris") = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listings_prior_at_uris_idx" ON "store_listings" USING gin ("prior_at_uris");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_listings_transfer_offered_to_did_idx" ON "store_listings" USING btree ("transfer_offered_to_did");
