import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { rawPosts } from "./raw-posts";

export const jobPosts = pgTable(
  "job_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawPostId: uuid("raw_post_id").references(() => rawPosts.id, { onDelete: "set null" }),
    companyName: text("company_name"),
    roleTitle: text("role_title").notNull(),
    roleCategory: text("role_category"),
    location: text("location"),
    workMode: text("work_mode").notNull().default("unknown"),
    employmentType: text("employment_type").notNull().default("unknown"),
    experienceMin: integer("experience_min"),
    experienceMax: integer("experience_max"),
    qualification: text("qualification"),
    batchYears: text("batch_years")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    salaryText: text("salary_text"),
    applyUrl: text("apply_url"),
    applyEmail: text("apply_email"),
    sourceUrl: text("source_url"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_posts_company_name_idx").on(table.companyName),
    index("job_posts_role_title_idx").on(table.roleTitle),
    index("job_posts_work_mode_idx").on(table.workMode),
    index("job_posts_employment_type_idx").on(table.employmentType),
    index("job_posts_status_idx").on(table.status),
    index("job_posts_posted_at_idx").on(table.postedAt),
    index("job_posts_experience_max_idx").on(table.experienceMax),
  ],
);
