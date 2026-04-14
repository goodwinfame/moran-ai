import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { locationSignificanceEnum, locationStatusEnum } from "./enums.js";
import { projects } from "./projects.js";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    aliases: text("aliases").array(),
    type: varchar("type", { length: 100 }),
    description: text("description"),
    sensoryDetails: text("sensory_details"),
    layout: text("layout"),
    significance: locationSignificanceEnum("significance"),
    firstAppearance: integer("first_appearance"),
    parentId: uuid("parent_id").references((): AnyPgColumn => locations.id),
    status: locationStatusEnum("status").default("active"),
    relatedCharacterIds: uuid("related_character_ids").array(),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("locations_project_id_idx").on(table.projectId)],
);

export const locationConnections = pgTable(
  "location_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceLocationId: uuid("source_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    targetLocationId: uuid("target_location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }),
    description: text("description"),
    bidirectional: boolean("bidirectional").default(true),
  },
  (table) => [
    uniqueIndex("location_connections_source_target_type_unique").on(
      table.sourceLocationId,
      table.targetLocationId,
      table.type,
    ),
  ],
);
