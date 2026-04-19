/**
 * Brainstorm tools (4 tools).
 *
 * - brainstorm_create: 创建脑暴文档（发散/聚焦/创意简报）
 * - brainstorm_read:   读取脑暴文档（单个或列表）
 * - brainstorm_update: 更新脑暴文档
 * - brainstorm_patch:  局部编辑脑暴文档（find/replace）
 *
 * Gate: 无（灵感阶段无前置条件）
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { brainstormService } from "@moran/core/services";
import { ok, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";
import { fail } from "../utils/response.js";

const BRAINSTORM_TYPE = ["diverge", "focus", "brief"] as const;

export function registerBrainstormTools(server: McpServer) {
  server.registerTool("brainstorm_create", {
    description: "创建脑暴文档（发散记录、聚焦分析或创意简报）",
    inputSchema: {
      projectId: z.string().uuid(),
      type: z.enum(BRAINSTORM_TYPE),
      content: z.string().describe("JSON 字符串，结构按 type 不同"),
    },
  }, async ({ projectId, type, content }) => {
    const result = await brainstormService.create(projectId, {
      title: type,
      content,
      metadata: { type },
    });
    return fromService(result);
  });

  server.registerTool("brainstorm_read", {
    description: "读取脑暴文档：传 brainstormId 读单个，不传读列表（可按 type 过滤）",
    inputSchema: {
      projectId: z.string().uuid(),
      brainstormId: z.string().uuid().optional(),
      type: z.enum(BRAINSTORM_TYPE).optional(),
    },
  }, async ({ projectId, brainstormId, type }) => {
    if (brainstormId) {
      const result = await brainstormService.read(projectId, brainstormId);
      return fromService(result);
    }
    const result = await brainstormService.list(projectId);
    if (!result.ok) return fromService(result);
    const docs = type
      ? result.data.filter((d) => (d.metadata as Record<string, unknown> | null)?.type === type)
      : result.data;
    return ok(docs);
  });

  server.registerTool("brainstorm_update", {
    description: "更新脑暴文档内容（全量替换）",
    inputSchema: {
      projectId: z.string().uuid(),
      brainstormId: z.string().uuid(),
      content: z.string(),
    },
  }, async ({ brainstormId, content }) => {
    const result = await brainstormService.update(brainstormId, { content });
    return fromService(result);
  });

  server.registerTool("brainstorm_patch", {
    description: "局部编辑脑暴文档内容（find/replace 替换）",
    inputSchema: {
      projectId: z.string().uuid(),
      brainstormId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ projectId, brainstormId, patches }) => {
    const readResult = await brainstormService.read(projectId, brainstormId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const { content, applied, failed: failedPatches } = applyPatches(readResult.data.content, patches);
    if (applied === 0) return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });

    const updateResult = await brainstormService.patch(brainstormId, { content });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: brainstormId,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}
