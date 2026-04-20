/**
 * Context tools (1 tool).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { contextService } from "@moran/core/services";
import { checkPrerequisites, toGateDetails } from "../gates/checker.js";
import { fail, fromService } from "../utils/response.js";

export function registerContextTools(server: McpServer) {
  server.registerTool("context_assemble", {
    description: "为执笔组装写作上下文（UNM 引擎）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      mode: z.enum(["write", "revise", "rewrite"]).optional(),
    },
  }, async ({ projectId, chapterNumber, mode }) => {
    const prereqs = await checkPrerequisites(projectId, "chapter_write", { chapterNumber });
    if (!prereqs.passed) {
      return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
    }
    const result = await contextService.assemble(projectId, chapterNumber, mode ?? "write");
    return fromService(result);
  });
}
