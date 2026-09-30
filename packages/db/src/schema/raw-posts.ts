import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sources } from "./sources";

export const rawPosts = pgTable(
  "raw_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    rawUrl: text("raw_url").notNull(),
    rawTitle: text("raw_title"),
    rawText: text("raw_text").notNull(),
    rawHtml: text("raw_html"),
    contentHash: text("content_hash").notNull().unique(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("new"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("raw_posts_source_id_idx").on(table.sourceId),
    index("raw_posts_status_idx").on(table.status),
    index("raw_posts_fetched_at_idx").on(table.fetchedAt),
  ],
);
