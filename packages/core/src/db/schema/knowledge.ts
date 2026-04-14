import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { knowledgeCategoryEnum } from "./enums.js";

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 255 }).notNull(),
    category: knowledgeCategoryEnum("category"),
    title: varchar("title", { length: 500 }),
    content: text("content").notNull(),
    tags: text("tags").array(),
    consumers: text("consumers").array(),
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("knowledge_entries_scope_idx").on(table.scope)],
);

export const knowledgeVersions = pgTable("knowledge_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeEntryId: uuid("knowledge_entry_id")
    .notNull()
    .references(() => knowledgeEntries.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  updatedBy: varchar("updated_by", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
