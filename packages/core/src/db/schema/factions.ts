import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { factionStatusEnum } from "./enums.js";
import { characters } from "./characters.js";
import { projects } from "./projects.js";

export const factions = pgTable(
  "factions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    status: factionStatusEnum("status").default("active"),
    leaderId: uuid("leader_id").references(() => characters.id, { onDelete: "set null" }),
    keyMemberIds: uuid("key_member_ids").array(),
    territory: text("territory"),
    changes: text("changes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("factions_project_id_idx").on(table.projectId)],
);
