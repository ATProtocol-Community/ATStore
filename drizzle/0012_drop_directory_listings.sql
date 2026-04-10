ALTER TABLE "listing_claims" DROP CONSTRAINT "listing_claims_directory_listing_id_directory_listings_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "listing_claims_directory_listing_id_idx";--> statement-breakpoint
ALTER TABLE "listing_claims" RENAME COLUMN "directory_listing_id" TO "store_listing_id";--> statement-breakpoint
CREATE INDEX "listing_claims_store_listing_id_idx" ON "listing_claims" USING btree ("store_listing_id");--> statement-breakpoint
ALTER TABLE "listing_claims" ADD CONSTRAINT "listing_claims_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TABLE "directory_listings";
