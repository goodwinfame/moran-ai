import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { styleSourceEnum } from "./enums.js";
import { projects } from "./projects.js";

/**
 * style_configs — 风格配置表
 *
 * 存储用户自定义风格。内置风格（builtin）随代码发布，
 * 用户可 fork 内置风格后修改，或从零创建新风格。
 *
 * 字段分为三大区：
 * - 结构化约束（constraints）：YAML 中的机器可执行部分
 * - 散文描述（proseGuide）：风格感觉、语调气质
 * - 示例段落（examples）：few-shot teaching
 */
export const styleConfigs = pgTable(
  "style_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 所属项目（null = 全局风格） */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    /** 风格唯一标识 (如 "剑心", "云墨", 用户自定义) */
    styleId: varchar("style_id", { length: 100 }).notNull(),
    /** 显示名 (如 "执笔·剑心") */
    displayName: varchar("display_name", { length: 200 }).notNull(),
    /** 适用题材 */
    genre: varchar("genre", { length: 100 }),
    /** 风格描述 */
    description: text("description"),
    /** 来源：builtin / user / fork */
    source: styleSourceEnum("source").notNull().default("user"),
    /** fork 来源（如果 source='fork'，记录原 builtin 的 styleId） */
    forkedFrom: varchar("forked_from", { length: 100 }),
    /** 版本号 */
    version: integer("version").default(1),

    // ── 结构化约束 (config.yaml 对应内容) ──
    /** 必选专项模块 ID 列表 */
    modules: jsonb("modules").$type<string[]>(),
    /** 审校特别关注点 */
    reviewerFocus: jsonb("reviewer_focus").$type<string[]>(),
    /** 上下文权重加成 */
    contextWeights: jsonb("context_weights").$type<Record<string, number>>(),
    /** 基调控制 (0-1 连续值) */
    tone: jsonb("tone").$type<Record<string, number>>(),
    /** 禁忌词/表达 */
    forbidden: jsonb("forbidden").$type<{ words?: string[]; patterns?: string[] }>(),
    /** 鼓励的表达方式 */
    encouraged: jsonb("encouraged").$type<string[]>(),

    // ── 散文风格描述 ──
    /** 散文风格指引 (prose.md 内容) */
    proseGuide: text("prose_guide"),

    // ── 示例段落 ──
    /** 示例段落 (examples.md 内容) */
    examples: text("examples"),

    /** 是否启用 */
    isActive: boolean("is_active").default(true),
    /** 所属用户 */
    userId: text("user_id").default("local"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("style_configs_project_style_id_unique").on(table.projectId, table.styleId),
    index("style_configs_project_id_idx").on(table.projectId),
    index("style_configs_style_id_idx").on(table.styleId),
  ],
);
