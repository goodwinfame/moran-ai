/**
 * Unit tests for review tools.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

import { registerReviewTools } from "../../tools/review.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

describe("review tools", () => {
  const { server, handlers } = createMockServer();
  registerReviewTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // review_execute
  // ---------------------------------------------------------------------------
  describe("review_execute", () => {
    it("returns NOT_IMPLEMENTED error", async () => {
      const result = await handlers.get("review_execute")!({
        projectId: PROJECT_ID,
        chapterNumber: 1,
        round: 1,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
    });

    it("returns NOT_IMPLEMENTED for any round number", async () => {
      for (const round of [1, 2, 3, 4] as const) {
        const result = await handlers.get("review_execute")!({
          projectId: PROJECT_ID,
          chapterNumber: 3,
          round,
        });

        const payload = parseResponse(result);
        expect(payload.ok).toBe(false);
        expect((payload.error as { code: string }).code).toBe("NOT_IMPLEMENTED");
      }
    });
  });
});
