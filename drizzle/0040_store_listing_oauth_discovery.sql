CREATE TABLE "store_listing_oauth_discovery" (
	"store_listing_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"client_metadata_url" text,
	"auth_method" text DEFAULT 'unknown' NOT NULL,
	"resolution" text NOT NULL,
	"login_page_url" text,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_listing_oauth_discovery_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "store_listing_oauth_discovery_slug_idx" ON "store_listing_oauth_discovery" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "store_listing_oauth_discovery_resolution_idx" ON "store_listing_oauth_discovery" USING btree ("resolution");
