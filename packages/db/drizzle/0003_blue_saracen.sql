ALTER TABLE "generated_posts" ADD COLUMN "trigger_keyword" text;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD COLUMN "automation_status" text DEFAULT 'not_provisioned' NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD COLUMN "automation_id" text;