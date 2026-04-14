import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { briefStatusEnum, briefTypeEnum, chapterStatusEnum } from "./enums.js";
import { projects } from "./projects.js";

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    title: varchar("title", { length: 500 }),
    content: text("content"),
    wordCount: integer("word_count"),
    writerStyle: varchar("writer_style", { length: 100 }),
    status: chapterStatusEnum("status").default("draft"),
    currentVersion: integer("current_version").default(1),
    archivedVersion: integer("archived_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("chapters_project_chapter_unique").on(table.projectId, table.chapterNumber),
    index("chapters_project_id_idx").on(table.projectId),
    index("chapters_project_chapter_idx").on(table.projectId, table.chapterNumber),
  ],
);

export const chapterVersions = pgTable(
  "chapter_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content"),
    wordCount: integer("word_count"),
    writerName: varchar("writer_name", { length: 100 }),
    reason: varchar("reason", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("chapter_versions_chapter_version_unique").on(table.chapterId, table.version)],
);

export const chapterBriefs = pgTable(
  "chapter_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    arcIndex: integer("arc_index"),
    type: briefTypeEnum("type"),
    hardConstraints: jsonb("hard_constraints"),
    softGuidance: jsonb("soft_guidance"),
    freeZone: text("free_zone").array(),
    emotionalLandmine: text("emotional_landmine"),
    scenesSequelStructure: jsonb("scenes_sequel_structure"),
    status: briefStatusEnum("status").default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("chapter_briefs_project_chapter_unique").on(table.projectId, table.chapterNumber)],
);
