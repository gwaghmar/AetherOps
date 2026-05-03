CREATE TABLE "scim_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"scim_token" text NOT NULL,
	"organization_id" text,
	CONSTRAINT "scim_provider_provider_id_unique" UNIQUE("provider_id"),
	CONSTRAINT "scim_provider_scim_token_unique" UNIQUE("scim_token")
);
--> statement-breakpoint
CREATE TABLE "sso_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"oidc_config" text,
	"saml_config" text,
	"user_id" text,
	"provider_id" text NOT NULL,
	"organization_id" text,
	"domain" text NOT NULL,
	CONSTRAINT "sso_provider_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
DROP INDEX "fulfillment_job_request_open_unique";--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "allowed_type_slugs" jsonb;--> statement-breakpoint
ALTER TABLE "fulfillment_job" ADD COLUMN "job_type" text DEFAULT 'provision' NOT NULL;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "pre_expiry_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "request_type" ADD COLUMN "connector_id" text;--> statement-breakpoint
ALTER TABLE "sso_provider" ADD CONSTRAINT "sso_provider_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_job_request_open_unique" ON "fulfillment_job" USING btree ("request_id","job_type") WHERE "fulfillment_job"."status" in ('pending', 'processing');