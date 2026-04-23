ALTER TABLE "store_listings" DROP COLUMN IF EXISTS "claim_key";--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN "claim_pending_for_did" text;
