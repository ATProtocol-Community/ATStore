ALTER TABLE "store_listings" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;
