/**
 * Summary tools (2 tools).
 *
 * - summary_create: 创建摘要（章节摘要或弧段摘要）
 * - summary_read:   读取摘要（按类型/章节/弧段/范围查询）
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { summaryService } from "@moran/core/services";
import { ok, fail, fromService } from "../utils/response.js";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";

const SUMMARY_TYPE = ["chapter", "arc"] as const;

export function registerSummaryTools(server: McpServer) {
  server.registerTool("summary_create", {
    description: "创建摘要（章节摘要或弧段摘要）",
    inputSchema: {
      projectId: z.string().uuid(),
      type: z.enum(SUMMARY_TYPE),
      chapterNumber: z.number().int().positive().optional().describe("type=chapter 时必传"),
      arcIndex: z.number().int().nonnegative().optional().describe("type=arc 时必传"),
      content: z.string(),
    },
  }, async ({ projectId, type, chapterNumber, arcIndex, content }) => {
    if (type === "chapter") {
      if (chapterNumber === undefined) {
        return fail("INVALID_INPUT", "type=chapter 时 chapterNumber 为必填");
      }
      const prereqs = await checkPrerequisites(projectId, "summary_chapter", { chapterNumber });
      if (!prereqs.passed) {
        return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
      }
      const result = await summaryService.createChapterSummary(projectId, { chapterNumber, content });
      return fromService(result);
    }

    if (arcIndex === undefined) {
      return fail("INVALID_INPUT", "type=arc 时 arcIndex 为必填");
    }
    const prereqs = await checkPrerequisites(projectId, "summary_arc", { arcIndex });
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }
    const result = await summaryService.createArcSummary(projectId, { arcIndex, content });
    return fromService(result);
  });

  server.registerTool("summary_read", {
    description: "读取摘要：按类型、章节、弧段或范围查询",
    inputSchema: {
      projectId: z.string().uuid(),
      type: z.enum(SUMMARY_TYPE).optional(),
      chapterNumber: z.number().int().positive().optional(),
      arcIndex: z.number().int().nonnegative().optional(),
      range: z.object({
        from: z.number().int().positive(),
        to: z.number().int().positive(),
      }).optional(),
    },
  }, async ({ projectId, type, chapterNumber, arcIndex, range }) => {
    // Specific chapter summary
    if (chapterNumber !== undefined) {
      const result = await summaryService.readChapterSummary(projectId, chapterNumber);
      return fromService(result);
    }

    // Specific arc summary
    if (arcIndex !== undefined) {
      const result = await summaryService.readArcSummary(projectId, arcIndex);
      return fromService(result);
    }

    // List by type or all
    if (type === "chapter" || type === undefined) {
      const chapterResult = await summaryService.listChapterSummaries(projectId);
      if (!chapterResult.ok) return fromService(chapterResult);
      let chapters = chapterResult.data;
      if (range) {
        chapters = chapters.filter(
          (s) => s.chapterNumber >= range.from && s.chapterNumber <= range.to,
        );
      }
      if (type === "chapter") return ok(chapters);

      // type === undefined → return both chapter and arc summaries
      const arcResult = await summaryService.listArcSummaries(projectId);
      const arcs = arcResult.ok ? arcResult.data : [];
      return ok({ chapters, arcs });
    }

    // type === "arc"
    const result = await summaryService.listArcSummaries(projectId);
    return fromService(result);
  });
}
