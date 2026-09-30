import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generatedPosts } from "./generated-posts";
import { jobPosts } from "./job-posts";

export const publishEvents = pgTable(
  "publish_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    generatedPostId: uuid("generated_post_id").references(() => generatedPosts.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull(),
    externalPostId: text("external_post_id"),
    publishedUrl: text("published_url"),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("publish_events_job_post_id_idx").on(table.jobPostId),
    index("publish_events_generated_post_id_idx").on(table.generatedPostId),
    index("publish_events_platform_idx").on(table.platform),
    index("publish_events_status_idx").on(table.status),
    index("publish_events_published_at_idx").on(table.publishedAt),
  ],
);
