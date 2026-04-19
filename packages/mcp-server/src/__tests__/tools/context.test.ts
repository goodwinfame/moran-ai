/**
 * Unit tests for context tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

import { registerContextTools } from "../../tools/context.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

describe("context tools", () => {
  const { server, handlers } = createMockServer();
  registerContextTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // context_assemble
  // ---------------------------------------------------------------------------
  describe("context_assemble", () => {
    it("returns NOT_IMPLEMENTED error", async () => {
      const result = await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED regardless of mode", async () => {
      const result = await handlers.get("context_assemble")!({
        projectId: PROJECT_ID,
        chapterNumber: 5,
        mode: "revise",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });
  });
});
