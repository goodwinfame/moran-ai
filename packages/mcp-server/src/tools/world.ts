/**
 * World tools (6 tools).
 *
 * - world_create: 创建世界观条目（设定/子系统/地点/术语）
 * - world_read:   读取世界观条目
 * - world_update: 更新世界观条目
 * - world_delete: 删除世界观条目
 * - world_check:  世界观一致性检查（规则引擎检测）
 * - world_patch:  局部编辑世界设定内容（find/replace）
 *
 * Spec type → DB section 映射:
 *   "setting" + section → section (default "base")
 *   "subsystem" → "subsystem"
 *   "location"  → "location"
 *   "glossary"  → "glossary"
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { worldService, consistencyService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

const WORLD_TYPE = ["setting", "subsystem", "location", "glossary"] as const;

function resolveSection(type: string, section?: string): string {
  if (type === "setting") return section ?? "base";
  return type;
}

export function registerWorldTools(server: McpServer) {
  server.registerTool("world_create", {
    description: "创建世界观条目（设定/子系统/地点/术语）",
    inputSchema: {
      projectId: z.string().uuid(),
      type: z.enum(WORLD_TYPE),
      name: z.string(),
      content: z.string().describe("JSON 字符串，结构按 type 不同"),
      section: z.enum(["base", "custom"]).optional().describe("type=setting 时使用"),
    },
  }, async ({ projectId, type, name, content, section }) => {
    // Gate: 创意简报已存在
    const prereqs = await checkPrerequisites(projectId, "world_design");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    const result = await worldService.createSetting(projectId, {
      section: resolveSection(type, section),
      name,
      content,
    });
    if (!result.ok) return fromService(result);
    return ok({ id: result.data.id, type });
  });

  server.registerTool("world_read", {
    description: "读取世界观条目：传 worldId 读单个，不传读列表（可按 type/section 过滤）",
    inputSchema: {
      projectId: z.string().uuid(),
      worldId: z.string().uuid().optional(),
      type: z.enum(WORLD_TYPE).optional(),
      section: z.enum(["base", "custom"]).optional(),
    },
  }, async ({ projectId, worldId, type, section }) => {
    if (worldId) {
      const result = await worldService.readSetting(projectId, worldId);
      return fromService(result);
    }
    const filterSection = type ? resolveSection(type, section) : section;
    const result = await worldService.listSettings(projectId, filterSection);
    return fromService(result);
  });

  server.registerTool("world_update", {
    description: "更新世界观条目（全量替换指定字段）",
    inputSchema: {
      projectId: z.string().uuid(),
      worldId: z.string().uuid(),
      name: z.string().optional(),
      content: z.string().optional(),
      section: z.string().optional(),
    },
  }, async ({ worldId, name, content, section }) => {
    // content is required by service — supply empty if not provided
    const result = await worldService.updateSetting(worldId, {
      name,
      content: content ?? "",
      section,
    });
    return fromService(result);
  });

  server.registerTool("world_delete", {
    description: "删除世界观条目",
    inputSchema: {
      projectId: z.string().uuid(),
      worldId: z.string().uuid(),
    },
  }, async ({ worldId }) => {
    const result = await worldService.removeSetting(worldId);
    if (!result.ok) return fromService(result);
    return ok({ id: worldId });
  });

  server.registerTool("world_check", {
    description: "世界观一致性检查（检测矛盾/缺失/循环引用/孤立条目）",
    inputSchema: {
      projectId: z.string().uuid(),
    },
  }, async ({ projectId }) => {
    const result = await consistencyService.check(projectId);
    return fromService(result);
  });

  server.registerTool("world_patch", {
    description: "局部编辑世界设定内容（find/replace 替换）",
    inputSchema: {
      projectId: z.string().uuid(),
      worldId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ projectId, worldId, patches }) => {
    const readResult = await worldService.readSetting(projectId, worldId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const { content, applied, failed: failedPatches } = applyPatches(readResult.data.content, patches);
    if (applied === 0) return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });

    const updateResult = await worldService.updateSetting(worldId, { content });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: worldId,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}
