CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"embedding_model" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_source_lookup_idx" ON "embeddings" USING btree ("source_type","source_id","embedding_model");--> statement-breakpoint
CREATE INDEX "embeddings_embedding_cosine_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);