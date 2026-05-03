CREATE TABLE "store_listing_oauth_probes" (
	"store_listing_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text NOT NULL,
	"probe_error" text,
	"probed_url" text,
	"probed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"oauth_scopes_distinct" text[] DEFAULT '{}'::text[] NOT NULL,
	"transitional_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"publishes_atproto_scope" boolean,
	"client_scope_raw_line" text,
	"client_scope_syntax_ok" boolean,
	"has_protected_resource_metadata" boolean DEFAULT false NOT NULL,
	"has_authorization_server_metadata" boolean DEFAULT false NOT NULL,
	"successful_client_metadata_url" text,
	"report_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_listing_oauth_probes_store_listing_id_store_listings_id_fk" FOREIGN KEY ("store_listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "store_listing_oauth_probes_probed_at_idx" ON "store_listing_oauth_probes" USING btree ("probed_at");
--> statement-breakpoint
CREATE INDEX "store_listing_oauth_probes_slug_idx" ON "store_listing_oauth_probes" USING btree ("slug");
