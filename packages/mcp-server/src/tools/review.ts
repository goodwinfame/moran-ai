/**
 * Review tools (1 tool).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fail } from "../utils/response.js";

export function registerReviewTools(server: McpServer) {
  server.registerTool("review_execute", {
    description: "执行审校（四轮，尚未实现）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      round: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    },
  }, async () => fail("NOT_IMPLEMENTED", "review_execute 尚未实现，需要 ReviewService"));
}
