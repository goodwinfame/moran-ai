import { index, integer, numeric, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { users } from "./auth.js";

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 }),
    agentName: varchar("agent_name", { length: 100 }),
    toolName: varchar("tool_name", { length: 255 }),
    model: varchar("model", { length: 100 }),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    totalTokens: integer("total_tokens").default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 8 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("usage_records_project_created_idx").on(table.projectId, table.createdAt),
    index("usage_records_user_created_idx").on(table.userId, table.createdAt),
  ],
);
