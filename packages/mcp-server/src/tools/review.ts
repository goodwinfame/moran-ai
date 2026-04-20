/**
 * Review tools (2 tools).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewService } from "@moran/core/services";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";
import { fail, fromService } from "../utils/response.js";

type ReviewRoundResult = Parameters<typeof reviewService.saveRound>[3];

export function registerReviewTools(server: McpServer) {
  server.registerTool("review_execute", {
    description: "保存审校轮次结果（由明镜 Agent 调用，传入 ReviewRoundResult JSON）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      round: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      result: z.string().describe("ReviewRoundResult JSON 字符串"),
    },
  }, async ({ projectId, chapterNumber, round, result }) => {
    const prereqs = await checkPrerequisites(projectId, "review", { chapterNumber });
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    let parsedResult: ReviewRoundResult;
    try {
      parsedResult = JSON.parse(result) as ReviewRoundResult;
    } catch {
      return fail("VALIDATION_ERROR", "result 不是有效的 JSON 字符串");
    }

    const serviceResult = await reviewService.saveRound(
      projectId,
      chapterNumber,
      round,
      parsedResult,
    );
    return fromService(serviceResult);
  });

  server.registerTool("review_read", {
    description: "读取审校结果：传 round 读单轮，不传读该章节全部轮次",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      round: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    },
  }, async ({ projectId, chapterNumber, round }) => {
    if (round !== undefined) {
      const result = await reviewService.readRound(projectId, chapterNumber, round);
      return fromService(result);
    }
    const result = await reviewService.readByChapter(projectId, chapterNumber);
    return fromService(result);
  });
}
