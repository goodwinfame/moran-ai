/**
 * MCP Tool response types.
 *
 * All tools return MCPToolResponse via ok()/fail() helpers.
 * The MCP protocol wraps responses as { content: [{ type: "text", text: JSON }] }.
 */

export type ErrorCode =
  | "GATE_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "PATCH_NO_MATCH"
  | "INTERNAL"
  | "NOT_IMPLEMENTED";

export interface GateDetails {
  passed: string[];
  failed: string[];
  suggestions: string[];
}

export interface MCPErrorPayload {
  code: ErrorCode | string;
  message: string;
  details?: GateDetails | Record<string, unknown>;
}

export interface MCPSuccessResponse {
  ok: true;
  data: unknown;
}

export interface MCPFailResponse {
  ok: false;
  error: MCPErrorPayload;
}

export type MCPPayload = MCPSuccessResponse | MCPFailResponse;

/** The shape returned by server.registerTool() handlers */
export interface MCPToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
