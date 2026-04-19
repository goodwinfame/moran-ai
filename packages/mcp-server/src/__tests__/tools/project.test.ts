import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockProjectRead, mockProjectUpdate } = vi.hoisted(() => ({
  mockProjectRead: vi.fn(),
  mockProjectUpdate: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  projectService: {
    read: mockProjectRead,
    update: mockProjectUpdate,
  },
}));

const { mockCheckPrerequisites, mockToGateDetails } = vi.hoisted(() => ({
  mockCheckPrerequisites: vi.fn(),
  mockToGateDetails: vi.fn(),
}));
vi.mock("../../gates/checker.js", () => ({
  checkPrerequisites: mockCheckPrerequisites,
  toGateDetails: mockToGateDetails,
}));

import { registerProjectTools } from "../../tools/project.js";

describe("project tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerProjectTools(server);

  describe("project_read", () => {
    it("returns project data on success", async () => {
      const project = { id: "proj-1", title: "Test Novel", status: "brainstorm" };
      mockProjectRead.mockResolvedValue({ ok: true, data: project });

      const result = await handlers.get("project_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(project);
      expect(mockProjectRead).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
    });

    it("returns error when project not found", async () => {
      mockProjectRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Project not found" },
      });

      const result = await handlers.get("project_read")!({
        projectId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("project_update", () => {
    it("updates project fields and returns updated data", async () => {
      const updated = { id: "proj-1", title: "New Title", genre: "fantasy" };
      mockProjectUpdate.mockResolvedValue({ ok: true, data: updated });

      const result = await handlers.get("project_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "New Title",
        genre: "fantasy",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(updated);
      expect(mockProjectUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        { title: "New Title", genre: "fantasy" },
      );
    });

    it("returns error when update fails", async () => {
      mockProjectUpdate.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("project_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "Bad",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });

    it("passes only provided fields to service", async () => {
      mockProjectUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("project_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        targetWordCount: 100000,
      });

      expect(mockProjectUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        { targetWordCount: 100000 },
      );
    });
  });

  describe("gate_check", () => {
    it("returns gate check result when prerequisites pass", async () => {
      const prereqResult = { passed: true, checks: [] };
      mockCheckPrerequisites.mockResolvedValue(prereqResult);

      const result = await handlers.get("gate_check")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        action: "brainstorm",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(prereqResult);
      expect(mockCheckPrerequisites).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "brainstorm",
        undefined,
      );
    });

    it("passes chapterNumber param when provided", async () => {
      const prereqResult = { passed: true, checks: [] };
      mockCheckPrerequisites.mockResolvedValue(prereqResult);

      await handlers.get("gate_check")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        action: "chapter_write",
        chapterNumber: 5,
      });

      expect(mockCheckPrerequisites).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "chapter_write",
        { chapterNumber: 5 },
      );
    });

    it("returns gate result even when prerequisites fail", async () => {
      const prereqResult = { passed: false, checks: [{ name: "brief", passed: false }] };
      mockCheckPrerequisites.mockResolvedValue(prereqResult);

      const result = await handlers.get("gate_check")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        action: "world_design",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(prereqResult);
    });
  });
});
