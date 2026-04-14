import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { glossaryCategoryEnum } from "./enums.js";
import { projects } from "./projects.js";

export const glossaryEntries = pgTable(
  "glossary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 255 }).notNull(),
    aliases: text("aliases").array(),
    category: glossaryCategoryEnum("category"),
    definition: text("definition"),
    firstAppearance: integer("first_appearance"),
    constraints: text("constraints"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("glossary_entries_project_id_idx").on(table.projectId)],
);
