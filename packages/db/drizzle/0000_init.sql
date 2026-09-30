CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_post_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"notes" text,
	"decided_by" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blacklist_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blacklist_rules_type_value_unique" UNIQUE("type","value")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"domain" text,
	"logo_url" text,
	"trust_level" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "generated_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_post_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"format_type" text DEFAULT 'single_job' NOT NULL,
	"text_content" text NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_post_id" uuid,
	"company_name" text,
	"role_title" text NOT NULL,
	"role_category" text,
	"location" text,
	"work_mode" text DEFAULT 'unknown' NOT NULL,
	"employment_type" text DEFAULT 'unknown' NOT NULL,
	"experience_min" integer,
	"experience_max" integer,
	"qualification" text,
	"batch_years" text[] DEFAULT '{}'::text[] NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_text" text,
	"apply_url" text,
	"apply_email" text,
	"source_url" text,
	"posted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_post_id" uuid NOT NULL,
	"freshness_score" integer DEFAULT 0 NOT NULL,
	"fresher_fit_score" integer DEFAULT 0 NOT NULL,
	"tech_relevance_score" integer DEFAULT 0 NOT NULL,
	"trust_score" integer DEFAULT 0 NOT NULL,
	"remote_bonus" integer DEFAULT 0 NOT NULL,
	"clarity_score" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"spam_risk" text DEFAULT 'unknown' NOT NULL,
	"should_post" boolean DEFAULT false NOT NULL,
	"ai_reason" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_post_id" uuid,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_post_id" uuid NOT NULL,
	"generated_post_id" uuid,
	"platform" text NOT NULL,
	"external_post_id" text,
	"published_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"raw_url" text NOT NULL,
	"raw_title" text,
	"raw_text" text NOT NULL,
	"raw_html" text,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"error_message" text,
	CONSTRAINT "raw_posts_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"platform" text,
	"url" text NOT NULL,
	"ats_type" text,
	"trust_level" integer DEFAULT 50 NOT NULL,
	"fetch_interval_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_posts" ADD CONSTRAINT "generated_posts_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_raw_post_id_raw_posts_id_fk" FOREIGN KEY ("raw_post_id") REFERENCES "public"."raw_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_events" ADD CONSTRAINT "publish_events_job_post_id_job_posts_id_fk" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_events" ADD CONSTRAINT "publish_events_generated_post_id_generated_posts_id_fk" FOREIGN KEY ("generated_post_id") REFERENCES "public"."generated_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_posts" ADD CONSTRAINT "raw_posts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_job_post_id_idx" ON "approvals" USING btree ("job_post_id");--> statement-breakpoint
CREATE INDEX "approvals_decision_idx" ON "approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "approvals_decided_at_idx" ON "approvals" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "blacklist_rules_type_idx" ON "blacklist_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "blacklist_rules_value_idx" ON "blacklist_rules" USING btree ("value");--> statement-breakpoint
CREATE INDEX "blacklist_rules_is_active_idx" ON "blacklist_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "generated_posts_job_post_id_idx" ON "generated_posts" USING btree ("job_post_id");--> statement-breakpoint
CREATE INDEX "generated_posts_platform_idx" ON "generated_posts" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "generated_posts_status_idx" ON "generated_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_posts_company_name_idx" ON "job_posts" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "job_posts_role_title_idx" ON "job_posts" USING btree ("role_title");--> statement-breakpoint
CREATE INDEX "job_posts_work_mode_idx" ON "job_posts" USING btree ("work_mode");--> statement-breakpoint
CREATE INDEX "job_posts_employment_type_idx" ON "job_posts" USING btree ("employment_type");--> statement-breakpoint
CREATE INDEX "job_posts_status_idx" ON "job_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_posts_posted_at_idx" ON "job_posts" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "job_posts_experience_max_idx" ON "job_posts" USING btree ("experience_max");--> statement-breakpoint
CREATE INDEX "job_scores_job_post_id_idx" ON "job_scores" USING btree ("job_post_id");--> statement-breakpoint
CREATE INDEX "job_scores_total_score_idx" ON "job_scores" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "job_scores_should_post_idx" ON "job_scores" USING btree ("should_post");--> statement-breakpoint
CREATE INDEX "job_scores_spam_risk_idx" ON "job_scores" USING btree ("spam_risk");--> statement-breakpoint
CREATE INDEX "prompt_runs_job_post_id_idx" ON "prompt_runs" USING btree ("job_post_id");--> statement-breakpoint
CREATE INDEX "prompt_runs_task_idx" ON "prompt_runs" USING btree ("task");--> statement-breakpoint
CREATE INDEX "prompt_runs_provider_idx" ON "prompt_runs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "prompt_runs_model_idx" ON "prompt_runs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "prompt_runs_created_at_idx" ON "prompt_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "publish_events_job_post_id_idx" ON "publish_events" USING btree ("job_post_id");--> statement-breakpoint
CREATE INDEX "publish_events_generated_post_id_idx" ON "publish_events" USING btree ("generated_post_id");--> statement-breakpoint
CREATE INDEX "publish_events_platform_idx" ON "publish_events" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "publish_events_status_idx" ON "publish_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "publish_events_published_at_idx" ON "publish_events" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "raw_posts_source_id_idx" ON "raw_posts" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "raw_posts_status_idx" ON "raw_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "raw_posts_fetched_at_idx" ON "raw_posts" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sources_platform_idx" ON "sources" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "sources_is_active_idx" ON "sources" USING btree ("is_active");