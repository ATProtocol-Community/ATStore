ALTER TABLE "store_listing_reviews" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "store_listing_review_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_listing_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"author_did" text NOT NULL,
	"rkey" text NOT NULL,
	"at_uri" text NOT NULL,
	"subject_uri" text NOT NULL,
	"text" text NOT NULL,
	"reply_created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_listing_review_replies_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "store_listing_review_replies_review_id_store_listing_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."store_listing_reviews"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_review_replies_at_uri_idx" ON "store_listing_review_replies" USING btree ("at_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "store_listing_review_replies_repo_rkey_idx" ON "store_listing_review_replies" USING btree ("author_did","rkey");
--> statement-breakpoint
CREATE INDEX "store_listing_review_replies_review_created_idx" ON "store_listing_review_replies" USING btree ("review_id","reply_created_at");
--> statement-breakpoint
CREATE INDEX "store_listing_review_replies_review_id_idx" ON "store_listing_review_replies" USING btree ("review_id");
--> statement-breakpoint
CREATE INDEX "store_listing_review_replies_author_did_idx" ON "store_listing_review_replies" USING btree ("author_did");
--> statement-breakpoint
CREATE INDEX "store_listing_review_replies_store_listing_id_idx" ON "store_listing_review_replies" USING btree ("store_listing_id");
