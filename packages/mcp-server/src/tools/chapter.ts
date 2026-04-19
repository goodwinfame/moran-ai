/**
 * Chapter tools (5 tools).
 *
 * - chapter_create:  创建章节（首次写入）
 * - chapter_read:    读取章节（列表或单章，支持版本查询）
 * - chapter_update:  基于审校反馈修订章节
 * - chapter_archive: 归档章节（冻结版本）
 * - chapter_patch:   局部编辑章节内容（find/replace）
 *
 * Spec field mapping:
 *   writerPreset → DB writerStyle
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chapterService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { applyPatches } from "../utils/patch.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function registerChapterTools(server: McpServer) {
  server.registerTool("chapter_create", {
    description: "创建章节（首次写入或创建新版本）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      title: z.string(),
      content: z.string(),
      wordCount: z.number().int().positive().optional().describe("不传则自动计算"),
      writerPreset: z.string().optional().describe("使用的子写手预设名"),
    },
  }, async ({ projectId, chapterNumber, title, content, wordCount, writerPreset }) => {
    const prereqs = await checkPrerequisites(projectId, "chapter_write");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    // Check if archived version exists (prevent overwrite)
    const existing = await chapterService.read(projectId, chapterNumber);
    if (existing.ok && existing.data.status === "archived") {
      return fail("GATE_FAILED", "该章节已归档，不能覆盖已归档版本");
    }

    const wc = wordCount ?? countWords(content);
    const result = await chapterService.create(projectId, {
      chapterNumber,
      title,
      content,
      wordCount: wc,
      writerStyle: writerPreset,
    });
    if (!result.ok) return fromService(result);
    return ok({ id: result.data.id, version: 1 });
  });

  server.registerTool("chapter_read", {
    description: "读取章节：不传 chapterNumber 读列表（不含正文），传则读单章（可指定版本）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive().optional(),
      version: z.number().int().positive().optional(),
      includeContent: z.boolean().optional().describe("列表模式下是否包含正文，默认 false"),
    },
  }, async ({ projectId, chapterNumber, version, includeContent }) => {
    // List mode
    if (chapterNumber === undefined) {
      const result = await chapterService.list(projectId);
      if (!result.ok) return fromService(result);
      if (includeContent) return ok(result.data);
      // Strip content for summary list
      return ok(result.data.map(({ content: _content, ...rest }) => rest));
    }

    // Single chapter
    const chapterResult = await chapterService.read(projectId, chapterNumber);
    if (!chapterResult.ok) return fromService(chapterResult);

    // Specific version
    if (version !== undefined) {
      const versionsResult = await chapterService.listVersions(chapterResult.data.id);
      if (!versionsResult.ok) return fromService(versionsResult);
      const target = versionsResult.data.find((v) => v.version === version);
      if (!target) return fail("NOT_FOUND", `版本 ${version} 不存在`);
      return ok({
        ...chapterResult.data,
        content: target.content,
        wordCount: target.wordCount,
        currentVersion: target.version,
      });
    }

    return ok(chapterResult.data);
  });

  server.registerTool("chapter_update", {
    description: "基于审校反馈修订章节（保存旧版本快照后更新）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      feedback: z.array(z.object({
        issue: z.string(),
        severity: z.enum(["critical", "major", "minor", "suggestion"]),
        suggestion: z.string(),
        lineRange: z.tuple([z.number(), z.number()]).optional(),
      })),
      revisedContent: z.string(),
    },
  }, async ({ projectId, chapterNumber, feedback, revisedContent }) => {
    // TODO: HARD gate — 有对应的审校报告（需 ReviewService 集成）
    const chapterResult = await chapterService.read(projectId, chapterNumber);
    if (!chapterResult.ok) return fail("NOT_FOUND", "章节不存在");

    const chapter = chapterResult.data;

    // Save current content as version snapshot before overwriting
    if (chapter.content) {
      await chapterService.createVersion(chapter.id, {
        version: chapter.currentVersion ?? 1,
        content: chapter.content,
        wordCount: chapter.wordCount,
        reason: `revision: ${feedback.length} issues`,
      });
    }

    const wc = countWords(revisedContent);
    const result = await chapterService.update(chapter.id, {
      content: revisedContent,
      wordCount: wc,
    });
    if (!result.ok) return fromService(result);

    return ok({ id: result.data.id, version: result.data.currentVersion });
  });

  server.registerTool("chapter_archive", {
    description: "归档章节（标记为 archived，冻结版本）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
    },
  }, async ({ projectId, chapterNumber }) => {
    const prereqs = await checkPrerequisites(projectId, "archive");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    const chapterResult = await chapterService.read(projectId, chapterNumber);
    if (!chapterResult.ok) return fail("NOT_FOUND", "章节不存在");

    const result = await chapterService.archive(chapterResult.data.id);
    if (!result.ok) return fromService(result);

    return ok({ id: result.data.id, version: result.data.archivedVersion });
  });

  server.registerTool("chapter_patch", {
    description: "局部编辑章节内容（find/replace 替换，审校后改段落最高频场景）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterId: z.string().uuid(),
      patches: z.array(z.object({ find: z.string(), replace: z.string() })).min(1).max(20),
    },
  }, async ({ chapterId, patches }) => {
    const readResult = await chapterService.readById(chapterId);
    if (!readResult.ok) return fail("NOT_FOUND", readResult.error.message);

    const original = readResult.data.content ?? "";
    const { content, applied, failed: failedPatches } = applyPatches(original, patches);
    if (applied === 0) {
      return fail("PATCH_NO_MATCH", "没有匹配的替换目标", { failed: failedPatches });
    }

    const wc = countWords(content);
    const updateResult = await chapterService.patch(chapterId, { content, wordCount: wc });
    if (!updateResult.ok) return fail(updateResult.error.code, updateResult.error.message);

    return ok({
      id: chapterId,
      appliedCount: applied,
      failedPatches: failedPatches.length > 0 ? failedPatches : undefined,
    });
  });
}
