import { pgTable, real, text, timestamp, uniqueIndex, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { characters } from "./characters.js";
import { projects } from "./projects.js";

export const characterRelationships = pgTable(
  "character_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    description: text("description"),
  },
  (table) => [uniqueIndex("character_relationships_source_target_type_unique").on(table.sourceId, table.targetId, table.type)],
);

export const relationshipStates = pgTable("relationship_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  type: varchar("type", { length: 100 }),
  intensity: real("intensity"),
  description: text("description"),
  change: text("change"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
