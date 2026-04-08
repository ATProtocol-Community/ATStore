CREATE TABLE "directory_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"name" text NOT NULL,
	"visit_out_url" text NOT NULL,
	"external_url" text,
	"icon_url" text,
	"screenshot_urls" text[] NOT NULL,
	"tagline" text,
	"full_description" text,
	"raw_category_hint" text,
	"scope" text,
	"product_type" text,
	"domain" text,
	"vertical" text,
	"classification_reason" text,
	"scrape_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "directory_listings_source_url_idx" ON "directory_listings" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "directory_listings_external_url_idx" ON "directory_listings" USING btree ("external_url");--> statement-breakpoint
CREATE INDEX "directory_listings_taxonomy_idx" ON "directory_listings" USING btree ("scope","product_type","domain");