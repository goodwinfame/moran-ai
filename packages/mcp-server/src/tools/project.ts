/**
 * Project & Gate tools (3 tools).
 *
 * - project_read:   读取项目基本信息与当前阶段
 * - project_update: 更新项目基本信息或配置
 * - gate_check:     通用门禁预检
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectService } from "@moran/core/services";
import { ok, fromService } from "../utils/response.js";
import { checkPrerequisites } from "../gates/checker.js";

const PROJECT_STATUS = ["brainstorm", "world", "character", "outline", "writing", "completed"] as const;

const GATE_ACTIONS = [
  "brainstorm",
  "world_design",
  "character_design",
  "outline_design",
  "style_design",
  "chapter_write",
  "review",
  "archive",
  "analysis",
] as const;

export function registerProjectTools(server: McpServer) {
  server.registerTool("project_read", {
    description: "读取项目基本信息与当前阶段",
    inputSchema: {
      projectId: z.string().uuid(),
    },
  }, async ({ projectId }) => {
    const result = await projectService.read(projectId);
    return fromService(result);
  });

  server.registerTool("project_update", {
    description: "更新项目基本信息或配置（名称、类型、阶段等）",
    inputSchema: {
      projectId: z.string().uuid(),
      title: z.string().optional(),
      genre: z.string().optional(),
      subGenre: z.string().optional(),
      status: z.enum(PROJECT_STATUS).optional(),
      targetWordCount: z.number().int().positive().optional(),
      styleId: z.string().optional(),
    },
  }, async ({ projectId, ...data }) => {
    const result = await projectService.update(projectId, data);
    return fromService(result);
  });

  server.registerTool("gate_check", {
    description: "通用门禁预检：检查目标操作的前置条件是否满足，返回每条前置条件的状态与建议",
    inputSchema: {
      projectId: z.string().uuid(),
      action: z.enum(GATE_ACTIONS),
      chapterNumber: z.number().int().positive().optional(),
    },
  }, async ({ projectId, action, chapterNumber }) => {
    const params = chapterNumber !== undefined ? { chapterNumber } : undefined;
    const result = await checkPrerequisites(projectId, action, params);
    return ok(result);
  });
}
