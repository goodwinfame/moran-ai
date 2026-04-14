import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { plotThreadStatusEnum, significanceEnum } from "./enums.js";
import { locations } from "./locations.js";
import { projects } from "./projects.js";

export const outlines = pgTable(
  "outlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    synopsis: text("synopsis"),
    structureType: varchar("structure_type", { length: 50 }),
    themes: text("themes").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("outlines_project_id_unique").on(table.projectId)],
);

export const arcs = pgTable(
  "arcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    arcIndex: integer("arc_index").notNull(),
    title: varchar("title", { length: 500 }),
    description: text("description"),
    startChapter: integer("start_chapter"),
    endChapter: integer("end_chapter"),
    detailedPlan: text("detailed_plan"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("arcs_project_arc_index_unique").on(table.projectId, table.arcIndex)],
);

export const plotThreads = pgTable(
  "plot_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: plotThreadStatusEnum("status").default("planted"),
    introducedChapter: integer("introduced_chapter"),
    resolvedChapter: integer("resolved_chapter"),
    relatedCharacterIds: uuid("related_character_ids").array(),
    keyMoments: jsonb("key_moments"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("plot_threads_project_id_idx").on(table.projectId)],
);

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number"),
    storyTimestamp: varchar("story_timestamp", { length: 255 }),
    description: text("description").notNull(),
    characterIds: uuid("character_ids").array(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    significance: significanceEnum("significance"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("timeline_events_project_id_idx").on(table.projectId)],
);
