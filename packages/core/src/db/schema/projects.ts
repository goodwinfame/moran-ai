import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { projectStatusEnum } from "./enums.js";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  genre: varchar("genre", { length: 100 }),
  subGenre: varchar("sub_genre", { length: 100 }),
  language: varchar("language", { length: 10 }).default("zh-CN"),
  targetWordCount: integer("target_word_count").default(500000),
  chapterCount: integer("chapter_count").default(200),
  wordsPerChapter: integer("words_per_chapter"),
  pov: varchar("pov", { length: 50 }),
  tense: varchar("tense", { length: 20 }),
  toneDescription: text("tone_description"),
  writingStrategy: varchar("writing_strategy", { length: 50 }),
  styleId: varchar("style_id", { length: 100 }),
  status: projectStatusEnum("status").default("brainstorm"),
  currentChapter: integer("current_chapter").default(0),
  currentArc: integer("current_arc").default(0),
  totalWordCount: integer("total_word_count").default(0),
  userId: text("user_id").default("local"),
  currentSessionId: text("current_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
