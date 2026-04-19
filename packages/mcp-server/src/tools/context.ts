/**
 * Context tools (1 tool).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fail } from "../utils/response.js";

export function registerContextTools(server: McpServer) {
  server.registerTool("context_assemble", {
    description: "为执笔组装写作上下文（UNM 引擎，尚未实现）",
    inputSchema: {
      projectId: z.string().uuid(),
      chapterNumber: z.number().int().positive(),
      mode: z.enum(["write", "revise", "rewrite"]).optional(),
    },
  }, async () => fail("NOT_IMPLEMENTED", "context_assemble 尚未实现，需要 ContextService"));
}
