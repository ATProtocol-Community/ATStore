CREATE TABLE "home_page_promo_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_page_promo_listing_store_listing_id_unique" UNIQUE("store_listing_id")
);
--> statement-breakpoint
ALTER TABLE "home_page_promo_listing" ADD CONSTRAINT "home_page_promo_listing_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
