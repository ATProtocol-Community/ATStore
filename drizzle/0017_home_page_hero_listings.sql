CREATE TABLE "home_page_hero_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" integer NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_page_hero_listings" ADD CONSTRAINT "home_page_hero_listings_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "home_page_hero_listings_position_idx" ON "home_page_hero_listings" USING btree ("position");
--> statement-breakpoint
CREATE UNIQUE INDEX "home_page_hero_listings_listing_idx" ON "home_page_hero_listings" USING btree ("store_listing_id");
