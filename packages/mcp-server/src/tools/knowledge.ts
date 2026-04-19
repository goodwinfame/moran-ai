/**
 * Knowledge tools (5 tools).
 *
 * - knowledge_create: 创建知识条目
 * - knowledge_read:   读取知识条目（单个或列表，可按分类/标签/关键词过滤）
 * - knowledge_update: 更新知识条目
 * - knowledge_delete: 删除知识条目
 * - knowledge_patch:  局部编辑知识条目内容（find/replace）
 *
 * Gate: 无（知识库操作始终允许）
 *
 * Scope mapping: spec `projectId` → DB `scope = "project:{projectId}"`
 * Category mapping: spec "technique" → DB "writing_craft"
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { knowledgeService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";

/** Spec category values accepted by agents. */
const SPEC_CATEGORY = ["technique", "genre", "style", "reference"] as const;

/** Spec → DB category mapping. */
const CATEGORY_TO_DB: Record<string, string> = {
  technique: "writing_craft",
  genre: "genre",
  style: "style",
  reference: "reference",
};

function toDbCategory(specCat: string): string {
  return CATEGORY_TO_DB[specCat] ?? specCat;
}

function toProjectScope(projectId: string): string {
  return `project:${projectId}`;
}

export function registerKnowledgeTools(server: McpServer) {
  server.registerTool("knowledge_create", {
    description: "创建知识条目（写作技法、题材技法、风格参考、资料引用）",
    inputSchema: {
      projectId: z.string().uuid(),
      category: z.enum(SPEC_CATEGORY),
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).optional(),
      sourceNote: z.string().optional().describe("来源描述，仅供记录"),
    },
  }, async ({ projectId, category, title, content, tags }) => {
    const result = await knowledgeService.create({
      scope: toProjectScope(projectId),
      category: toDbCategory(category) as "writing_craft" | "genre" | "style" | "reference",
      title,
      content,
      tags: tags ?? [],
      source: "user",
    });
    return fromService(result);
  });

  server.registerTool("knowledge_read", {
    description: "读取知识条目：传 knowledgeId 读单个，不传读列表（可按分类/标签/关键词过滤）",
    inputSchema: {
      projectId: z.string().uuid(),
      knowledgeId: z.string().uuid().optional(),
      category: z.enum(SPEC_CATEGORY).optional(),
      tags: z.array(z.string()).optional().describe("按标签过滤（AND）"),
      query: z.string().optional().describe("全文搜索（标题+内容）"),
    },
  }, async ({ projectId, knowledgeId, category, tags, query }) => {
    // Single entry
    if (knowledgeId) {
      const result = await knowledgeService.read(knowledgeId);
      return fromService(result);
    }

    // List with optional category filter
    const dbCat = category
      ? (toDbCategory(category) as "writing_craft" | "genre" | "style" | "reference")
      : undefined;
    const result = await knowledgeService.list(toProjectScope(projectId), dbCat);
    if (!result.ok) return fromService(result);

    let entries = result.data;

    // In-memory tag filter (AND — entry must contain ALL requested tags)
    if (tags && tags.length > 0) {
      entries = entries.filter((e) => {
        const entryTags = e.tags ?? [];
        return tags.every((t) => entryTags.includes(t));
      });
    }

    // In-memory full-text search (case-insensitive, title + content)
    if (query) {
      const q = query.toLowerCase();
      entries = entries.filter(
        (e) =>
          (e.title?.toLowerCase().includes(q) ?? false) ||
          e.content.toLowerCase().includes(q),
      );
    }

    return ok(entries);
  });

  server.registerTool("knowledge_update", {
    description: "更新知识条目（全量替换指定字段）",
    inputSchema: {
      projectId: z.string().uuid(),
      knowledgeId: z.string().uuid(),
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.enum(SPEC_CATEGORY).optional(),
    },
  }, async ({ knowledgeId, title, content, tags, category }) => {
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (tags !== undefined) data.tags = tags;
    if (category !== undefined) {
      data.category = toDbCategory(category);
    }

    if (Object.keys(data).length === 0) {
      return fail("NO_FIELDS", "至少提供一个需要更新的字段");
    }

    const result = await knowledgeService.update(knowledgeId, data);
    if (!result.ok) return fromService(result);
    return ok({ id: knowledgeId });
  });

  server.registerTool("knowledge_delete", {
    description: "删除知识条目",
    inputSchema: {
      projectId: z.string().uuid(),
      knowledgeId: z.string().uuid(),
    },
  }, async ({ knowledgeId }) => {
    const result = await knowledgeService.remove(knowledgeId);
    if (!result.ok) return fromService(result);
    return ok({ id: knowledgeId });
  });

  server.registerTool("knowledge_patch", {
    description: "局部编辑知识条目内容（find/replace 替换）",
    inputSchema: {
      projectId: z.string().uuid(),
      knowledgeId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ knowledgeId, patches }) => {
    const readResult = await knowledgeService.read(knowledgeId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const { content, applied, failed: failedPatches } = applyPatches(readResult.data.content, patches);
    if (applied === 0) return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });

    const updateResult = await knowledgeService.patch(knowledgeId, { content });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: knowledgeId,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}
