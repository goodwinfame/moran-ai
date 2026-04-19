/**
 * Lesson (写作教训) tools (3 tools).
 *
 * - lesson_create: 创建教训条目
 * - lesson_read:   读取教训（单个或列表，可按分类/活跃状态过滤）
 * - lesson_update: 更新教训（修正内容或标记废弃）
 *
 * Gate: 无
 *
 * Field mapping (spec → DB):
 *   spec.source     → DB title
 *   spec.pattern    → DB description (first section)
 *   spec.correction → DB description (second section, after "---")
 *   spec.category   → DB issueType
 *   spec.severity   → DB severity (high→critical, medium→major, low→minor)
 *   spec.active     → DB status (true→"active", false→"archived")
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lessonService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";

const LESSON_CATEGORY = [
  "anti_ai", "consistency", "style", "pacing", "character", "worldbuilding",
] as const;

const SEVERITY_TO_DB: Record<string, string> = {
  high: "critical",
  medium: "major",
  low: "minor",
};

const DESC_SEPARATOR = "\n\n---\n\n修正方式：";

function buildDescription(pattern: string, correction: string): string {
  return pattern + DESC_SEPARATOR + correction;
}

function parseDescription(desc: string): { pattern: string; correction: string } {
  const idx = desc.indexOf(DESC_SEPARATOR);
  if (idx === -1) return { pattern: desc, correction: "" };
  return {
    pattern: desc.slice(0, idx),
    correction: desc.slice(idx + DESC_SEPARATOR.length),
  };
}

export function registerLessonTools(server: McpServer) {
  server.registerTool("lesson_create", {
    description: "从用户修正或审校反馈中提取教训",
    inputSchema: {
      projectId: z.string().uuid(),
      source: z.string().describe('来源描述（如"第12章用户修改"、"审校反馈"）'),
      pattern: z.string().describe("问题模式描述"),
      correction: z.string().describe("修正方式"),
      category: z.enum(LESSON_CATEGORY),
      severity: z.enum(["high", "medium", "low"]).optional(),
    },
  }, async ({ projectId, source, pattern, correction, category, severity }) => {
    const result = await lessonService.create(projectId, {
      title: source,
      description: buildDescription(pattern, correction),
      issueType: category,
      severity: (severity ? SEVERITY_TO_DB[severity] : "major") as "critical" | "major" | "minor",
      status: "active",
    });
    return fromService(result);
  });

  server.registerTool("lesson_read", {
    description: "读取教训条目：传 lessonId 读单个，不传读列表（可按分类/活跃状态过滤）",
    inputSchema: {
      projectId: z.string().uuid(),
      lessonId: z.string().uuid().optional(),
      category: z.enum(LESSON_CATEGORY).optional(),
      active: z.boolean().optional().describe("是否只读活跃的，默认 true"),
    },
  }, async ({ projectId, lessonId, category, active }) => {
    // Single lesson
    if (lessonId) {
      const result = await lessonService.read(projectId, lessonId);
      return fromService(result);
    }

    // List with status filter: active=true (default) → only active; active=false → all
    const statusFilter = (active ?? true) ? "active" as const : undefined;
    const result = await lessonService.list(projectId, statusFilter);
    if (!result.ok) return fromService(result);

    // In-memory category filter (match issueType)
    let entries = result.data;
    if (category) {
      entries = entries.filter((e) => e.issueType === category);
    }

    return ok(entries);
  });

  server.registerTool("lesson_update", {
    description: "更新教训（修正内容或标记为废弃）",
    inputSchema: {
      projectId: z.string().uuid(),
      lessonId: z.string().uuid(),
      pattern: z.string().optional(),
      correction: z.string().optional(),
      category: z.enum(LESSON_CATEGORY).optional(),
      active: z.boolean().optional().describe("false = 废弃"),
    },
  }, async ({ projectId, lessonId, pattern, correction, category, active }) => {
    const updates: Record<string, unknown> = {};

    // Handle pattern / correction: need to read existing to merge
    if (pattern !== undefined || correction !== undefined) {
      const readResult = await lessonService.read(projectId, lessonId);
      if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

      const existing = parseDescription(readResult.data.description);
      updates.description = buildDescription(
        pattern ?? existing.pattern,
        correction ?? existing.correction,
      );
    }

    if (category !== undefined) updates.issueType = category;
    if (active !== undefined) updates.status = active ? "active" : "archived";

    if (Object.keys(updates).length === 0) {
      return fail("NO_FIELDS", "至少提供一个需要更新的字段");
    }

    const result = await lessonService.update(lessonId, updates);
    if (!result.ok) return fromService(result);
    return ok({ id: lessonId });
  });
}
