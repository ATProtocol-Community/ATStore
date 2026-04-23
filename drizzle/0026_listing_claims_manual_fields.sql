ALTER TABLE "listing_claims" ADD COLUMN IF NOT EXISTS "message" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "listing_claims" ADD COLUMN IF NOT EXISTS "claimant_handle" text;
--> statement-breakpoint
ALTER TABLE "listing_claims" ADD COLUMN IF NOT EXISTS "decided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "listing_claims" ADD COLUMN IF NOT EXISTS "decided_by_did" text;
--> statement-breakpoint
ALTER TABLE "listing_claims" ADD COLUMN IF NOT EXISTS "decision_notes" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "listing_claims_store_listing_claimant_pending_uidx" ON "listing_claims" ("store_listing_id","claimant_did") WHERE "status" = 'pending';
