import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    platform: text("platform"),
    url: text("url").notNull().unique(),
    atsType: text("ats_type"),
    trustLevel: integer("trust_level").notNull().default(50),
    fetchIntervalMinutes: integer("fetch_interval_minutes").notNull().default(60),
    isActive: boolean("is_active").notNull().default(true),
    category: text("category").notNull().default("general"),
    region: text("region").notNull().default("global"),
    priority: text("priority").notNull().default("normal"),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sources_type_idx").on(table.type),
    index("sources_platform_idx").on(table.platform),
    index("sources_is_active_idx").on(table.isActive),
  ],
);
