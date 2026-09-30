import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobPosts } from "./job-posts";

export const generatedPosts = pgTable(
  "generated_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    formatType: text("format_type").notNull().default("single_job"),
    textContent: text("text_content").notNull(),
    imageUrl: text("image_url"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("generated_posts_job_post_id_idx").on(table.jobPostId),
    index("generated_posts_platform_idx").on(table.platform),
    index("generated_posts_status_idx").on(table.status),
  ],
);
