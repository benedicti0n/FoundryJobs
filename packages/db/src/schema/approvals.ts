import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobPosts } from "./job-posts";

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    notes: text("notes"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("approvals_job_post_id_idx").on(table.jobPostId),
    index("approvals_decision_idx").on(table.decision),
    index("approvals_decided_at_idx").on(table.decidedAt),
  ],
);
