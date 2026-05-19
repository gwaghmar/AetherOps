ALTER TABLE "request_type" ADD COLUMN "sla_hours" integer;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "requester_note" text;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "approval_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "sla_breached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "sla_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "approval_request_terminal_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "approval_request_approver_terminal_unique" ON "approval" USING btree ("request_id","approver_id") WHERE "approval"."decision" in ('approved', 'denied');--> statement-breakpoint
CREATE TABLE "intake_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel" text NOT NULL,
	"channel_user_id" text NOT NULL,
	"channel_thread_id" text,
	"resolved_user_id" text,
	"resolved_request_id" text REFERENCES "request"("id") ON DELETE SET NULL,
	"state" text NOT NULL,
	"detected_request_type_slug" text,
	"detected_payload" jsonb,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_conversation" ADD CONSTRAINT "intake_conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_conversation" ADD CONSTRAINT "intake_conversation_resolved_user_id_user_id_fk" FOREIGN KEY ("resolved_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_conversation_org_idx" ON "intake_conversation" ("organization_id");--> statement-breakpoint
CREATE INDEX "intake_conversation_channel_user_idx" ON "intake_conversation" USING btree ("channel","channel_user_id") WHERE "intake_conversation"."state" in ('awaiting_clarification', 'awaiting_confirmation');--> statement-breakpoint
CREATE INDEX "intake_conversation_expires_idx" ON "intake_conversation" USING btree ("expires_at");
