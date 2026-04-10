ALTER TABLE "store_listings" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN "average_rating" double precision;
--> statement-breakpoint
CREATE TABLE "store_listing_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"author_did" text NOT NULL,
	"rkey" text NOT NULL,
	"at_uri" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"review_created_at" timestamp with time zone NOT NULL,
	"author_display_name" text,
	"author_avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_listing_reviews" ADD CONSTRAINT "store_listing_reviews_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "store_listing_reviews_store_listing_id_idx" ON "store_listing_reviews" USING btree ("store_listing_id");
--> statement-breakpoint
CREATE INDEX "store_listing_reviews_author_listing_idx" ON "store_listing_reviews" USING btree ("author_did","store_listing_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_reviews_at_uri_idx" ON "store_listing_reviews" USING btree ("at_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_reviews_repo_rkey_idx" ON "store_listing_reviews" USING btree ("author_did","rkey");
