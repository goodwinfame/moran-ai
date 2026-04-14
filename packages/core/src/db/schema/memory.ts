import { index, integer, pgTable, real, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { memoryCategoryEnum, memoryStabilityEnum, memoryTierEnum } from "./enums.js";
import { projects } from "./projects.js";

export const memorySlices = pgTable(
  "memory_slices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: memoryCategoryEnum("category").notNull(),
    tier: memoryTierEnum("tier").default("warm"),
    scope: varchar("scope", { length: 50 }),
    stability: memoryStabilityEnum("stability").default("evolving"),
    chapterNumber: integer("chapter_number"),
    content: text("content"),
    charCount: integer("char_count"),
    tokenCount: integer("token_count"),
    importance: real("importance"),
    priorityFloor: integer("priority_floor").default(0),
    freshness: real("freshness").default(1),
    relevanceTags: text("relevance_tags").array(),
    sourceAgent: varchar("source_agent", { length: 100 }),
    sourceChapter: integer("source_chapter"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("memory_slices_project_id_idx").on(table.projectId),
    index("memory_slices_project_category_idx").on(table.projectId, table.category),
    index("memory_slices_project_tier_idx").on(table.projectId, table.tier),
  ],
);
