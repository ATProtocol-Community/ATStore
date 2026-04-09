ALTER TABLE "directory_listings" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "directory_listings"
SET "slug" = CASE
  WHEN "source_url" = 'https://blueskydirectory.com/utilities/byesky'
    THEN 'byesky'
  WHEN "source_url" = 'https://blueskydirectory.com/utilities/byesky-6884fa611293d'
    THEN 'byesky-github'
  ELSE coalesce(
    nullif(
      trim(
        both '-'
        from regexp_replace(
          replace(replace(lower("name"), '&', ' and '), '''', ''),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'product'
  )
END;--> statement-breakpoint
ALTER TABLE "directory_listings" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "directory_listings_slug_idx" ON "directory_listings" USING btree ("slug");