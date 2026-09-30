import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const blacklistRules = pgTable(
  "blacklist_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    value: text("value").notNull(),
    reason: text("reason"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("blacklist_rules_type_idx").on(table.type),
    index("blacklist_rules_value_idx").on(table.value),
    index("blacklist_rules_is_active_idx").on(table.isActive),
    unique("blacklist_rules_type_value_unique").on(table.type, table.value),
  ],
);
