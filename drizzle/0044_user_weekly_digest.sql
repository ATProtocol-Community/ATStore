ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" boolean;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "weekly_digest_last_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "weekly_digest_welcome_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "weekly_digest_prompt_dismissed" boolean;
