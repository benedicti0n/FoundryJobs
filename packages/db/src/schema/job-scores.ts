import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { jobPosts } from "./job-posts";

export const jobScores = pgTable(
  "job_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostId: uuid("job_post_id")
      .notNull()
      .references(() => jobPosts.id, { onDelete: "cascade" }),
    freshnessScore: integer("freshness_score").notNull().default(0),
    fresherFitScore: integer("fresher_fit_score").notNull().default(0),
    techRelevanceScore: integer("tech_relevance_score").notNull().default(0),
    trustScore: integer("trust_score").notNull().default(0),
    remoteBonus: integer("remote_bonus").notNull().default(0),
    clarityScore: integer("clarity_score").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    spamRisk: text("spam_risk").notNull().default("unknown"),
    shouldPost: boolean("should_post").notNull().default(false),
    aiReason: text("ai_reason"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_scores_job_post_id_idx").on(table.jobPostId),
    index("job_scores_total_score_idx").on(table.totalScore),
    index("job_scores_should_post_idx").on(table.shouldPost),
    index("job_scores_spam_risk_idx").on(table.spamRisk),
  ],
);
