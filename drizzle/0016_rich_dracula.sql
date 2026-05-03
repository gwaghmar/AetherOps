CREATE TABLE "access_review_campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_review_item" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"request_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_review_campaign" ADD CONSTRAINT "access_review_campaign_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_review_item" ADD CONSTRAINT "access_review_item_campaign_id_access_review_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."access_review_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_review_item" ADD CONSTRAINT "access_review_item_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_review_item" ADD CONSTRAINT "access_review_item_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;