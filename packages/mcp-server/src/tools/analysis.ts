/**
 * Analysis tools (2 tools).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fail } from "../utils/response.js";

const ANALYSIS_SCOPE = z.enum(["chapter", "arc", "full"]);

const ANALYSIS_RANGE = z.object({
  start: z.number().int(),
  end: z.number().int(),
});

export function registerAnalysisTools(server: McpServer) {
  server.registerTool("analysis_execute", {
    description: "执行析典九维分析（尚未实现）",
    inputSchema: {
      projectId: z.string().uuid(),
      scope: ANALYSIS_SCOPE,
      range: ANALYSIS_RANGE.optional(),
    },
  }, async () => fail("NOT_IMPLEMENTED", "analysis_execute 尚未实现，需要 AnalysisService"));

  server.registerTool("analysis_read", {
    description: "读取历史分析报告（尚未实现）",
    inputSchema: {
      projectId: z.string().uuid(),
      scope: ANALYSIS_SCOPE.optional(),
      range: ANALYSIS_RANGE.optional(),
      latest: z.boolean().optional(),
    },
  }, async () => fail("NOT_IMPLEMENTED", "analysis_read 尚未实现，需要 AnalysisService"));
}
