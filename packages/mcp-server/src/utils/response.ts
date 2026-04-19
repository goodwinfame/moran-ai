/**
 * Unified MCP response helpers.
 *
 * All tools return either ok(data) or fail(code, message, details?).
 * The JSON payload is wrapped in MCP's content array format.
 */

import type { MCPToolResponse, ErrorCode, GateDetails } from "../types.js";

export function ok(data: unknown): MCPToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }) }],
  };
}

export function fail(
  code: ErrorCode | string,
  message: string,
  details?: GateDetails | Record<string, unknown>,
): MCPToolResponse {
  const error: Record<string, unknown> = { code, message };
  if (details) error.details = details;
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error }) }],
    isError: true,
  };
}

/**
 * Bridge a ServiceResult into an MCP response.
 * Handles the common pattern: if service returned error, fail(); else ok().
 */
export function fromService<T>(
  result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } },
): MCPToolResponse {
  if (!result.ok) return fail(result.error.code, result.error.message);
  return ok(result.data);
}
