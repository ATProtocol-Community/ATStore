CREATE TABLE "store_listing_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"author_did" text NOT NULL,
	"rkey" text NOT NULL,
	"at_uri" text NOT NULL,
	"favorite_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_listing_favorites" ADD CONSTRAINT "store_listing_favorites_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "store_listing_favorites_store_listing_id_idx" ON "store_listing_favorites" USING btree ("store_listing_id");
--> statement-breakpoint
CREATE INDEX "store_listing_favorites_author_created_idx" ON "store_listing_favorites" USING btree ("author_did","favorite_created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_favorites_at_uri_idx" ON "store_listing_favorites" USING btree ("at_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_favorites_repo_rkey_idx" ON "store_listing_favorites" USING btree ("author_did","rkey");
