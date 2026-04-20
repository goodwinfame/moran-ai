/**
 * Analysis tools (2 tools).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analysisService } from "@moran/core/services";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";
import { fail, fromService } from "../utils/response.js";

type AnalysisResult = Parameters<typeof analysisService.save>[1];

const ANALYSIS_SCOPE = z.enum(["chapter", "arc", "full"]);

const ANALYSIS_RANGE = z.object({
  start: z.number().int(),
  end: z.number().int(),
});

export function registerAnalysisTools(server: McpServer) {
  server.registerTool("analysis_execute", {
    description: "保存析典九维分析结果（由析典 Agent 调用，传入 AnalysisResult JSON）",
    inputSchema: {
      projectId: z.string().uuid(),
      scope: ANALYSIS_SCOPE,
      range: ANALYSIS_RANGE.optional(),
      data: z.string().describe("AnalysisResult JSON 字符串"),
    },
  }, async ({ projectId, data }) => {
    const prereqs = await checkPrerequisites(projectId, "analysis");
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }

    let parsedData: AnalysisResult;
    try {
      parsedData = JSON.parse(data) as AnalysisResult;
    } catch {
      return fail("VALIDATION_ERROR", "data 不是有效的 JSON 字符串");
    }

    const result = await analysisService.save(projectId, parsedData);
    return fromService(result);
  });

  server.registerTool("analysis_read", {
    description: "读取历史分析报告（可按 scope 过滤，latest=true 只返回最新）",
    inputSchema: {
      projectId: z.string().uuid(),
      scope: ANALYSIS_SCOPE.optional(),
      range: ANALYSIS_RANGE.optional(),
      latest: z.boolean().optional(),
    },
  }, async ({ projectId, scope, latest }) => {
    const result = await analysisService.list(projectId, { scope, latest });
    return fromService(result);
  });
}
