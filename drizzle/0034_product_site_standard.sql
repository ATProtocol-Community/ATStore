CREATE TABLE "product_site_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_did" text NOT NULL,
	"rkey" text NOT NULL,
	"at_uri" text NOT NULL,
	"base_url" text NOT NULL,
	"publication_name" text,
	"record_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_site_publications_at_uri_idx" ON "product_site_publications" USING btree ("at_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_site_publications_repo_did_rkey_idx" ON "product_site_publications" USING btree ("repo_did","rkey");
--> statement-breakpoint
CREATE INDEX "product_site_publications_repo_did_idx" ON "product_site_publications" USING btree ("repo_did");
--> statement-breakpoint
CREATE TABLE "product_site_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_did" text NOT NULL,
	"rkey" text NOT NULL,
	"at_uri" text NOT NULL,
	"publication_at_uri" text,
	"title" text,
	"description" text,
	"path" text NOT NULL,
	"document_published_at" timestamp with time zone NOT NULL,
	"record_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "product_site_documents_at_uri_idx" ON "product_site_documents" USING btree ("at_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_site_documents_repo_did_rkey_idx" ON "product_site_documents" USING btree ("repo_did","rkey");
--> statement-breakpoint
CREATE INDEX "product_site_documents_repo_published_idx" ON "product_site_documents" USING btree ("repo_did","document_published_at");
