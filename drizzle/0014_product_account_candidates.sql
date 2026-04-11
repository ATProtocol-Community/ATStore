ALTER TABLE "store_listings" ADD COLUMN "product_account_did" text;--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN "product_account_handle" text;--> statement-breakpoint
CREATE TABLE "store_listing_product_account_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"candidate_did" text NOT NULL,
	"candidate_handle" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "store_listing_product_account_candidates" ADD CONSTRAINT "store_listing_product_account_candidates_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_product_account_candidates_listing_did_idx" ON "store_listing_product_account_candidates" USING btree ("store_listing_id","candidate_did");--> statement-breakpoint
CREATE INDEX "store_listing_product_account_candidates_status_created_idx" ON "store_listing_product_account_candidates" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "store_listing_product_account_candidates_store_listing_id_idx" ON "store_listing_product_account_candidates" USING btree ("store_listing_id");
