CREATE TABLE "store_listing_rejection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reviewer_did" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_listing_rejection_events_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "store_listing_rejection_events_store_listing_id_idx" ON "store_listing_rejection_events" USING btree ("store_listing_id");

CREATE INDEX IF NOT EXISTS "store_listing_rejection_events_listing_created_idx" ON "store_listing_rejection_events" USING btree ("store_listing_id","created_at");
