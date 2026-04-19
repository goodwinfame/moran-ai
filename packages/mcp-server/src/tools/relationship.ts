/**
 * Relationship tools (3 tools).
 *
 * - relationship_create: 创建角色关系（支持双向）
 * - relationship_read:   读取角色关系
 * - relationship_update: 更新角色关系
 *
 * Spec field mapping:
 *   sourceCharacterId → DB sourceId
 *   targetCharacterId → DB targetId
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { relationshipService } from "@moran/core/services";
import { ok, fromService } from "../utils/response.js";

export function registerRelationshipTools(server: McpServer) {
  server.registerTool("relationship_create", {
    description: "创建角色关系（默认双向）",
    inputSchema: {
      projectId: z.string().uuid(),
      sourceCharacterId: z.string().uuid(),
      targetCharacterId: z.string().uuid(),
      type: z.string().describe("关系类型：ally/enemy/mentor/student/family/rival/lover 或自定义"),
      description: z.string(),
      bidirectional: z.boolean().optional().describe("是否双向关系，默认 true"),
    },
  }, async ({ projectId, sourceCharacterId, targetCharacterId, type, description, bidirectional }) => {
    const result = await relationshipService.create(projectId, {
      sourceId: sourceCharacterId,
      targetId: targetCharacterId,
      type,
      description,
    });
    if (!result.ok) return fromService(result);

    // Create reverse relationship if bidirectional (default: true)
    if (bidirectional !== false) {
      await relationshipService.create(projectId, {
        sourceId: targetCharacterId,
        targetId: sourceCharacterId,
        type,
        description,
      });
    }

    return ok({ id: result.data.id });
  });

  server.registerTool("relationship_read", {
    description: "读取角色关系：传 relationshipId 读单个，传 characterId 读该角色所有关系，都不传读项目全部",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid().optional(),
      relationshipId: z.string().uuid().optional(),
    },
  }, async ({ projectId, characterId, relationshipId }) => {
    if (relationshipId) {
      const result = await relationshipService.read(projectId, relationshipId);
      return fromService(result);
    }
    const result = await relationshipService.list(projectId, characterId);
    return fromService(result);
  });

  server.registerTool("relationship_update", {
    description: "更新角色关系",
    inputSchema: {
      projectId: z.string().uuid(),
      relationshipId: z.string().uuid(),
      type: z.string().optional(),
      description: z.string().optional(),
    },
  }, async ({ relationshipId, type, description }) => {
    const result = await relationshipService.update(relationshipId, {
      type,
      description,
    });
    return fromService(result);
  });
}
