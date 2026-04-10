CREATE TABLE "listing_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"directory_listing_id" uuid NOT NULL,
	"claimant_did" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "at_uri" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "repo_did" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "rkey" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "verification_status" text DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "source_account_did" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "claimed_by_did" text;--> statement-breakpoint
ALTER TABLE "directory_listings" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listing_claims" ADD CONSTRAINT "listing_claims_directory_listing_id_directory_listings_id_fk" FOREIGN KEY ("directory_listing_id") REFERENCES "public"."directory_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_claims_directory_listing_id_idx" ON "listing_claims" USING btree ("directory_listing_id");--> statement-breakpoint
CREATE INDEX "listing_claims_status_idx" ON "listing_claims" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "directory_listings_at_uri_idx" ON "directory_listings" USING btree ("at_uri");--> statement-breakpoint
CREATE INDEX "directory_listings_verification_status_idx" ON "directory_listings" USING btree ("verification_status");