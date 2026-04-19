import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { decisionLevelEnum } from "./enums.js";
import { projects } from "./projects.js";
import { users } from "./auth.js";

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

export const agentLogs = pgTable(
  "agent_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 }),
    level: varchar("level", { length: 20 }).notNull(),
    category: varchar("category", { length: 20 }).notNull(),
    agentName: varchar("agent_name", { length: 100 }),
    toolName: varchar("tool_name", { length: 255 }),
    message: text("message").notNull(),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("agent_logs_project_created_idx").on(table.projectId, table.createdAt),
    index("agent_logs_category_created_idx").on(table.category, table.createdAt),
  ],
);
