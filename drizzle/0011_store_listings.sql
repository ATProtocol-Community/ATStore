CREATE TABLE "store_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"external_url" text,
	"icon_url" text,
	"screenshot_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"tagline" text,
	"full_description" text,
	"category_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"app_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"at_uri" text,
	"repo_did" text,
	"rkey" text,
	"hero_image_url" text,
	"verification_status" text DEFAULT 'verified' NOT NULL,
	"source_account_did" text,
	"claimed_by_did" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "store_listings" (
	"id",
	"source_url",
	"name",
	"slug",
	"external_url",
	"icon_url",
	"screenshot_urls",
	"tagline",
	"full_description",
	"category_slugs",
	"app_tags",
	"at_uri",
	"repo_did",
	"rkey",
	"hero_image_url",
	"verification_status",
	"source_account_did",
	"claimed_by_did",
	"claimed_at",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"source_url",
	"name",
	"slug",
	"external_url",
	"icon_url",
	"screenshot_urls",
	"tagline",
	"full_description",
	"category_slugs",
	"app_tags",
	"at_uri",
	"repo_did",
	"rkey",
	"hero_image_url",
	"verification_status",
	"source_account_did",
	"claimed_by_did",
	"claimed_at",
	"created_at",
	"updated_at"
FROM "directory_listings";
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listings_source_url_idx" ON "store_listings" USING btree ("source_url");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listings_slug_idx" ON "store_listings" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "store_listings_external_url_idx" ON "store_listings" USING btree ("external_url");
--> statement-breakpoint
CREATE INDEX "store_listings_category_slugs_idx" ON "store_listings" USING gin ("category_slugs");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listings_at_uri_idx" ON "store_listings" USING btree ("at_uri");
--> statement-breakpoint
CREATE INDEX "store_listings_verification_status_idx" ON "store_listings" USING btree ("verification_status");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listings_repo_did_rkey_idx" ON "store_listings" USING btree ("repo_did","rkey");
