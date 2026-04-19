/**
 * Unit tests for analysis tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

import { registerAnalysisTools } from "../../tools/analysis.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

describe("analysis tools", () => {
  const { server, handlers } = createMockServer();
  registerAnalysisTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // analysis_execute
  // ---------------------------------------------------------------------------
  describe("analysis_execute", () => {
    it("returns NOT_IMPLEMENTED error", async () => {
      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "chapter",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED for any scope", async () => {
      for (const scope of ["chapter", "arc", "full"] as const) {
        const result = await handlers.get("analysis_execute")!({
          projectId: PROJECT_ID,
          scope,
        });

        const payload = parseResponse(result);
        expect(payload.ok).toBe(false);
        expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
      }
    });

    it("returns NOT_IMPLEMENTED when range is provided", async () => {
      const result = await handlers.get("analysis_execute")!({
        projectId: PROJECT_ID,
        scope: "arc",
        range: { start: 1, end: 10 },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });
  });

  // ---------------------------------------------------------------------------
  // analysis_read
  // ---------------------------------------------------------------------------
  describe("analysis_read", () => {
    it("returns NOT_IMPLEMENTED error", async () => {
      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED with scope filter", async () => {
      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
        scope: "full",
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED with latest=true", async () => {
      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
        latest: true,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED with range filter", async () => {
      const result = await handlers.get("analysis_read")!({
        projectId: PROJECT_ID,
        scope: "arc",
        range: { start: 5, end: 15 },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });
  });
});
