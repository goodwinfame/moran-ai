/**
 * MCP Server factory.
 *
 * Creates and configures the McpServer instance with all 54 tools registered.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "moran-mcp",
    version: "2.0.0",
  });

  registerAllTools(server);

  return server;
}
