/**
 * Shared test helpers for MCP server tests.
 *
 * Provides a mock McpServer that captures tool handlers for direct testing.
 */

import { vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPToolResponse } from "../types.js";

export type ToolHandler = (args: Record<string, unknown>) => Promise<MCPToolResponse>;

/**
 * Create a mock McpServer that captures registered tool handlers.
 * Returns the mock server and a map of tool name → handler function.
 *
 * Usage:
 * ```ts
 * const { server, handlers } = createMockServer();
 * registerProjectTools(server);
 * const result = await handlers.get("project_read")!({ projectId: "..." });
 * ```
 */
export function createMockServer() {
  const handlers = new Map<string, ToolHandler>();

  const server = {
    registerTool: vi.fn(
      (name: string, _schema: unknown, handler: ToolHandler) => {
        handlers.set(name, handler);
      },
    ),
  } as unknown as McpServer;

  return { server, handlers };
}

/**
 * Parse the JSON payload from an MCPToolResponse.
 */
export function parseResponse(response: MCPToolResponse): {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
} {
  const text = response.content[0]?.text;
  if (!text) throw new Error("Empty response content");
  return JSON.parse(text) as {
    ok: boolean;
    data?: unknown;
    error?: { code: string; message: string; details?: unknown };
  };
}
