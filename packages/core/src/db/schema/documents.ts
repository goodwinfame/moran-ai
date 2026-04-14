import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { documentCategoryEnum } from "./enums.js";
import { projects } from "./projects.js";

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: documentCategoryEnum("category"),
    title: varchar("title", { length: 500 }),
    content: text("content").notNull(),
    version: integer("version").default(1),
    isPinned: boolean("is_pinned").default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("project_documents_project_id_idx").on(table.projectId)],
);
