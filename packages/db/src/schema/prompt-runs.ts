import { index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobPosts } from "./job-posts";

export const promptRuns = pgTable(
  "prompt_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id").references(() => jobPosts.id, { onDelete: "set null" }),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("prompt_runs_job_post_id_idx").on(table.jobPostId),
    index("prompt_runs_task_idx").on(table.task),
    index("prompt_runs_provider_idx").on(table.provider),
    index("prompt_runs_model_idx").on(table.model),
    index("prompt_runs_created_at_idx").on(table.createdAt),
  ],
);
