import { integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const worldSettings = pgTable(
  "world_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("world_settings_project_section_name_unique").on(table.projectId, table.section, table.name)],
);

export const worldStates = pgTable(
  "world_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    inStoryDate: varchar("in_story_date", { length: 100 }),
    season: varchar("season", { length: 50 }),
    weather: varchar("weather", { length: 100 }),
    timeOfDay: varchar("time_of_day", { length: 50 }),
    majorWorldEvents: text("major_world_events"),
    environmentNotes: text("environment_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("world_states_project_chapter_unique").on(table.projectId, table.chapterNumber)],
);
