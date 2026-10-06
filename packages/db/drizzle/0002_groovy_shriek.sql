ALTER TABLE "sources" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "region" text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;