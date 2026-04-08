ALTER TABLE "directory_listings" ADD COLUMN "category_slug" text;--> statement-breakpoint
CREATE INDEX "directory_listings_category_slug_idx" ON "directory_listings" USING btree ("category_slug");