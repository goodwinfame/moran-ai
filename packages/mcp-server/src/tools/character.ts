/**
 * Character tools (5 tools).
 *
 * - character_create: 创建角色（核心层须完整五维心理模型）
 * - character_read:   读取角色（列表或详情，可按 role/designDepth 过滤）
 * - character_update: 更新角色信息
 * - character_delete: 删除角色
 * - character_patch:  局部编辑角色资料（find/replace）
 *
 * Spec field mapping:
 *   designDepth → DB designTier
 *   profile (JSON) → DB profileContent
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { characterService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

const CHARACTER_ROLE = ["protagonist", "deuteragonist", "antagonist", "supporting", "minor"] as const;
const DESIGN_DEPTH = ["core", "important", "supporting", "decoration"] as const;

export function registerCharacterTools(server: McpServer) {
  server.registerTool("character_create", {
    description: "创建角色（核心层须完整五维心理模型 GHOST/WOUND/LIE/WANT/NEED）",
    inputSchema: {
      projectId: z.string().uuid(),
      name: z.string(),
      role: z.enum(CHARACTER_ROLE),
      designDepth: z.enum(DESIGN_DEPTH),
      profile: z.string().describe(
        "JSON：{ ghost?, wound?, lie?, want?, need?, personality, background, appearance?, speechPattern?, goals: string[] }",
      ),
    },
  }, async ({ projectId, name, role, designDepth, profile }) => {
    const prereqs = await checkPrerequisites(projectId, "character_design");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    const result = await characterService.create(projectId, {
      name,
      role,
      designTier: designDepth,
      profileContent: profile,
    });
    return fromService(result);
  });

  server.registerTool("character_read", {
    description: "读取角色：传 characterId 读单个，不传读列表（可按 role/designDepth 过滤）",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid().optional(),
      role: z.enum(CHARACTER_ROLE).optional(),
      designDepth: z.enum(DESIGN_DEPTH).optional(),
    },
  }, async ({ projectId, characterId, role, designDepth }) => {
    if (characterId) {
      const result = await characterService.read(projectId, characterId);
      return fromService(result);
    }
    const result = await characterService.list(projectId);
    if (!result.ok) return fromService(result);
    let chars = result.data;
    if (role) chars = chars.filter((c) => c.role === role);
    if (designDepth) chars = chars.filter((c) => c.designTier === designDepth);
    return ok(chars);
  });

  server.registerTool("character_update", {
    description: "更新角色信息（全量替换指定字段）",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid(),
      name: z.string().optional(),
      role: z.enum(CHARACTER_ROLE).optional(),
      designDepth: z.enum(DESIGN_DEPTH).optional(),
      profile: z.string().optional(),
    },
  }, async ({ characterId, name, role, designDepth, profile }) => {
    const result = await characterService.update(characterId, {
      name,
      role,
      designTier: designDepth,
      profileContent: profile,
    });
    return fromService(result);
  });

  server.registerTool("character_delete", {
    description: "删除角色",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid(),
    },
  }, async ({ projectId, characterId }) => {
    // SOFT gate — warn if character appears in archived chapters, but still execute
    const prereqs = await checkPrerequisites(projectId, "character_remove", { characterId });
    const result = await characterService.remove(characterId);
    if (!result.ok) return fromService(result);
    const warnings = prereqs.conditions
      .filter((c) => !c.met && c.level === "SOFT")
      .map((c) => c.suggestion)
      .filter(Boolean) as string[];
    return ok({ id: characterId, warnings: warnings.length > 0 ? warnings : undefined });
  });

  server.registerTool("character_patch", {
    description: "局部编辑角色资料（find/replace 替换 profile 内容）",
    inputSchema: {
      projectId: z.string().uuid(),
      characterId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ projectId, characterId, patches }) => {
    const readResult = await characterService.read(projectId, characterId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const original = readResult.data.profileContent ?? "";
    const { content, applied, failed: failedPatches } = applyPatches(original, patches);
    if (applied === 0) {
      return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });
    }

    const updateResult = await characterService.patch(characterId, { profileContent: content });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: characterId,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}
