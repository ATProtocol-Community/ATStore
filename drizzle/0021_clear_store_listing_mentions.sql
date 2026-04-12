-- One-time: clear Jetstream mention rows and reset mention-derived listing fields.
-- Recompute scores after migrate: `pnpm backfill:trending`
TRUNCATE TABLE "store_listing_mentions" RESTART IDENTITY;
--> statement-breakpoint
UPDATE "store_listings"
SET
  "mention_count_24h" = 0,
  "mention_count_7d" = 0,
  "trending_score" = NULL,
  "trending_updated_at" = NULL;
