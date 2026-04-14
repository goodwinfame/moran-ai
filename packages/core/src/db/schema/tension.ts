import { integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { lieStatusEnum, tensionPhaseEnum } from "./enums.js";
import { characters } from "./characters.js";
import { projects } from "./projects.js";

export const tensionAccumulators = pgTable(
  "tension_accumulators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    currentScore: real("current_score").default(0),
    peakThisArc: real("peak_this_arc").default(0),
    currentPhase: tensionPhaseEnum("current_phase").default("rising"),
    pendingEvents: jsonb("pending_events"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("tension_accumulators_project_id_unique").on(table.projectId)],
);

export const lieConfrontationTrackers = pgTable(
  "lie_confrontation_trackers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    lieSummary: text("lie_summary"),
    pressureThreshold: integer("pressure_threshold"),
    status: lieStatusEnum("status").default("established"),
  },
  (table) => [uniqueIndex("lie_confrontation_trackers_project_character_unique").on(table.projectId, table.characterId)],
);
