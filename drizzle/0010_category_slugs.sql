ALTER TABLE "directory_listings" ADD COLUMN "category_slugs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "directory_listings" SET "category_slugs" = CASE WHEN "category_slug" IS NOT NULL AND trim("category_slug") <> '' THEN ARRAY["category_slug"]::text[] ELSE '{}'::text[] END;--> statement-breakpoint
DROP INDEX IF EXISTS "directory_listings_category_slug_idx";--> statement-breakpoint
ALTER TABLE "directory_listings" DROP COLUMN "category_slug";--> statement-breakpoint
CREATE INDEX "directory_listings_category_slugs_idx" ON "directory_listings" USING gin ("category_slugs");
