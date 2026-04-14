import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

/**
 * 章节摘要 — 载史归档产出，每章审校通过后由 Sonnet 生成
 * 500-800 字 Markdown 格式
 */
export const chapterSummaries = pgTable(
  "chapter_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    content: text("content").notNull(),
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("chapter_summaries_project_chapter_unique").on(table.projectId, table.chapterNumber),
    index("chapter_summaries_project_id_idx").on(table.projectId),
  ],
);

/**
 * 弧段摘要 — 弧段末章归档时由 Sonnet 生成
 * 综合该弧段所有章节摘要，生成弧段级别的概要
 */
export const arcSummaries = pgTable(
  "arc_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    arcIndex: integer("arc_index").notNull(),
    content: text("content").notNull(),
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("arc_summaries_project_arc_unique").on(table.projectId, table.arcIndex),
    index("arc_summaries_project_id_idx").on(table.projectId),
  ],
);
