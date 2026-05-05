CREATE TABLE "oauth_lexicon_hub_snapshot" (
	"singleton_key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
