import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    website: text("website"),
    domain: text("domain").unique(),
    logoUrl: text("logo_url"),
    trustLevel: integer("trust_level").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("companies_name_idx").on(table.name)],
);
