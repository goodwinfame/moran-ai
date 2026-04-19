import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockRelationshipCreate, mockRelationshipRead, mockRelationshipList, mockRelationshipUpdate } = vi.hoisted(() => ({
  mockRelationshipCreate: vi.fn(),
  mockRelationshipRead: vi.fn(),
  mockRelationshipList: vi.fn(),
  mockRelationshipUpdate: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  relationshipService: {
    create: mockRelationshipCreate,
    read: mockRelationshipRead,
    list: mockRelationshipList,
    update: mockRelationshipUpdate,
  },
}));

import { registerRelationshipTools } from "../../tools/relationship.js";

describe("relationship tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  registerRelationshipTools(server);

  describe("relationship_create", () => {
    it("creates bidirectional relationship (2 calls) by default", async () => {
      const rel = { id: "r-1" };
      mockRelationshipCreate.mockResolvedValue({ ok: true, data: rel });

      const result = await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "ally",
        description: "They fight together",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect((payload.data as Record<string, unknown>).id).toBe("r-1");
      expect(mockRelationshipCreate).toHaveBeenCalledTimes(2);
    });

    it("creates bidirectional=true creates 2 relationships", async () => {
      mockRelationshipCreate.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "rival",
        description: "Rivals",
        bidirectional: true,
      });

      expect(mockRelationshipCreate).toHaveBeenCalledTimes(2);
    });

    it("creates bidirectional=false creates only 1 relationship", async () => {
      mockRelationshipCreate.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      const result = await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "mentor",
        description: "Mentor relationship",
        bidirectional: false,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockRelationshipCreate).toHaveBeenCalledTimes(1);
    });

    it("maps sourceCharacterId to sourceId and targetCharacterId to targetId", async () => {
      mockRelationshipCreate.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "ally",
        description: "Friends",
        bidirectional: false,
      });

      expect(mockRelationshipCreate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        {
          sourceId: "00000000-0000-0000-0000-000000000002",
          targetId: "00000000-0000-0000-0000-000000000003",
          type: "ally",
          description: "Friends",
        },
      );
    });

    it("creates reverse relationship with swapped source/target when bidirectional", async () => {
      mockRelationshipCreate.mockResolvedValue({ ok: true, data: { id: "r-1" } });

      await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "ally",
        description: "Friends",
      });

      expect(mockRelationshipCreate).toHaveBeenNthCalledWith(
        2,
        "00000000-0000-0000-0000-000000000001",
        {
          sourceId: "00000000-0000-0000-0000-000000000003",
          targetId: "00000000-0000-0000-0000-000000000002",
          type: "ally",
          description: "Friends",
        },
      );
    });

    it("returns error when first create fails", async () => {
      mockRelationshipCreate.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "Already exists" },
      });

      const result = await handlers.get("relationship_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        sourceCharacterId: "00000000-0000-0000-0000-000000000002",
        targetCharacterId: "00000000-0000-0000-0000-000000000003",
        type: "ally",
        description: "Friends",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });
  });

  describe("relationship_read", () => {
    it("reads single relationship when relationshipId is provided", async () => {
      const rel = { id: "r-1", type: "ally" };
      mockRelationshipRead.mockResolvedValue({ ok: true, data: rel });

      const result = await handlers.get("relationship_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        relationshipId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(rel);
      expect(mockRelationshipRead).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      );
      expect(mockRelationshipList).not.toHaveBeenCalled();
    });

    it("lists relationships filtered by characterId when provided", async () => {
      const rels = [{ id: "r-1" }, { id: "r-2" }];
      mockRelationshipList.mockResolvedValue({ ok: true, data: rels });

      const result = await handlers.get("relationship_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(rels);
      expect(mockRelationshipList).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      );
    });

    it("lists all relationships when neither relationshipId nor characterId provided", async () => {
      const rels = [{ id: "r-1" }, { id: "r-2" }, { id: "r-3" }];
      mockRelationshipList.mockResolvedValue({ ok: true, data: rels });

      const result = await handlers.get("relationship_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(rels);
      expect(mockRelationshipList).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        undefined,
      );
    });

    it("returns error when read fails", async () => {
      mockRelationshipRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("relationship_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        relationshipId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("relationship_update", () => {
    it("updates relationship and returns data", async () => {
      const updated = { id: "r-1", type: "enemy" };
      mockRelationshipUpdate.mockResolvedValue({ ok: true, data: updated });

      const result = await handlers.get("relationship_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        relationshipId: "00000000-0000-0000-0000-000000000002",
        type: "enemy",
        description: "Now enemies",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(updated);
      expect(mockRelationshipUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        { type: "enemy", description: "Now enemies" },
      );
    });

    it("returns error when update fails", async () => {
      mockRelationshipUpdate.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("relationship_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        relationshipId: "00000000-0000-0000-0000-000000000002",
        type: "rival",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });

    it("passes only provided fields to service", async () => {
      mockRelationshipUpdate.mockResolvedValue({ ok: true, data: {} });

      await handlers.get("relationship_update")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        relationshipId: "00000000-0000-0000-0000-000000000002",
        description: "Updated description",
      });

      expect(mockRelationshipUpdate).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        { type: undefined, description: "Updated description" },
      );
    });
  });
});
