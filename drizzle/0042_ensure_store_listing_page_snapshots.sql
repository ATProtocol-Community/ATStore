CREATE TABLE IF NOT EXISTS "store_listing_page_snapshots" (
	"store_listing_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_listing_page_snapshots" ADD CONSTRAINT "store_listing_page_snapshots_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
