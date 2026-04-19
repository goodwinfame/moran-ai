import { boolean, index, integer, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { arcTypeEnum, characterRoleEnum } from "./enums.js";
import { projects } from "./projects.js";

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    aliases: text("aliases").array(),
    role: characterRoleEnum("role"),
    description: text("description"),
    personality: text("personality"),
    background: text("background"),
    goals: text("goals").array(),
    firstAppearance: integer("first_appearance"),
    arc: text("arc"),
    profileContent: text("profile_content"),
    wound: text("wound"),
    designTier: text("design_tier"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("characters_project_name_unique").on(table.projectId, table.name),
    index("characters_project_id_idx").on(table.projectId),
  ],
);

export const characterStates = pgTable(
  "character_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    location: varchar("location", { length: 255 }),
    emotionalState: varchar("emotional_state", { length: 255 }),
    knownInformation: text("known_information").array(),
    changes: text("changes").array(),
    isAlive: boolean("is_alive").default(true),
    deathChapter: integer("death_chapter"),
    powerLevel: varchar("power_level", { length: 100 }),
    abilities: text("abilities").array(),
    inventory: text("inventory").array(),
    physicalCondition: text("physical_condition"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("character_states_character_chapter_unique").on(table.characterId, table.chapterNumber)],
);

export const characterDna = pgTable(
  "character_dna",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    ghost: text("ghost"),
    wound: text("wound"),
    lie: text("lie"),
    want: text("want"),
    need: text("need"),
    arcType: arcTypeEnum("arc_type"),
    defaultMode: text("default_mode"),
    stressResponse: text("stress_response"),
    lieDefense: text("lie_defense"),
    tell: text("tell"),
    bStoryCharacterId: uuid("b_story_character_id").references((): AnyPgColumn => characters.id),
    bStoryFunction: text("b_story_function"),
    abnormalFactor: real("abnormal_factor").default(0.5),
    liePressureSensitivity: real("lie_pressure_sensitivity").default(0.5),
    arcProgress: real("arc_progress").default(0),
    lieConfrontationCount: integer("lie_confrontation_count").default(0),
    lastLiePressureChapter: integer("last_lie_pressure_chapter"),
  },
  (table) => [uniqueIndex("character_dna_character_id_unique").on(table.characterId)],
);
