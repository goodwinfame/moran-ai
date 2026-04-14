import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { lessonSeverityEnum, lessonStatusEnum } from "./enums.js";
import { projects } from "./projects.js";

/**
 * lessons — 写作教训自学习表
 *
 * 来源:
 *   - 明镜审校发现的 MAJOR/CRITICAL 问题 → status='pending' (候选)
 *   - 用户确认后 → status='active' (生效)
 *   - 连续 N 章未触发 → status='archived' (可能已内化)
 *   - 用户拒绝 → status='cancelled'
 */
export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: lessonStatusEnum("status").notNull().default("pending"),
    severity: lessonSeverityEnum("severity").notNull().default("major"),
    /** 教训标题 (简短概括) */
    title: varchar("title", { length: 500 }).notNull(),
    /** 教训详细描述 */
    description: text("description").notNull(),
    /** 来源章节号 */
    sourceChapter: integer("source_chapter"),
    /** 来源 Agent (通常是 mingjing) */
    sourceAgent: varchar("source_agent", { length: 100 }),
    /** 关联的审校 issue 类型 (如 'ai_flavor', 'logic', 'quality') */
    issueType: varchar("issue_type", { length: 100 }),
    /** 关联标签，用于按相关性匹配加载 */
    tags: text("tags").array(),
    /** 最后一次匹配触发的章节号 */
    lastTriggeredChapter: integer("last_triggered_chapter"),
    /** 总触发次数 */
    triggerCount: integer("trigger_count").default(0),
    /** 连续未触发章节计数 (用于过期淘汰) */
    inactiveChapters: integer("inactive_chapters").default(0),
    /** 过期淘汰阈值 (默认20章) */
    expiryThreshold: integer("expiry_threshold").default(20),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("lessons_project_id_idx").on(table.projectId),
    index("lessons_project_status_idx").on(table.projectId, table.status),
  ],
);
