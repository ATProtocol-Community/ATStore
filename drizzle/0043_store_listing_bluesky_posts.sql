CREATE TABLE IF NOT EXISTS "store_listing_bluesky_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"post_uri" text NOT NULL,
	"post_cid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_listing_bluesky_posts" ADD CONSTRAINT "store_listing_bluesky_posts_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_listing_bluesky_posts_store_listing_id_idx" ON "store_listing_bluesky_posts" USING btree ("store_listing_id");
