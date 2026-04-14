import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { decisionLevelEnum } from "./enums.js";
import { projects } from "./projects.js";

export const decisionLogs = pgTable(
  "decision_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    level: decisionLevelEnum("level"),
    agentId: varchar("agent_id", { length: 100 }),
    action: varchar("action", { length: 255 }),
    details: text("details"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("decision_logs_project_id_idx").on(table.projectId), index("decision_logs_project_agent_idx").on(table.projectId, table.agentId)],
);
