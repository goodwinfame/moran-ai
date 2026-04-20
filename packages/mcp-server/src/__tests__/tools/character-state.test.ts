import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCharacterCreateState, mockCharacterReadState, mockCharacterListStates, mockCharacterList } = vi.hoisted(() => ({
  mockCharacterCreateState: vi.fn(),
  mockCharacterReadState: vi.fn(),
  mockCharacterListStates: vi.fn(),
  mockCharacterList: vi.fn(),
}));
vi.mock("@moran/core/services", () => ({
  characterService: {
    createState: mockCharacterCreateState,
    readState: mockCharacterReadState,
    listStates: mockCharacterListStates,
    list: mockCharacterList,
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

import { registerCharacterStateTools } from "../../tools/character-state.js";

describe("character-state tools", () => {
  const { server, handlers } = createMockServer();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
  });

  registerCharacterStateTools(server);

  describe("character_state_create", () => {
    it("creates state snapshot with full field mapping", async () => {
      const state = { id: "s-1", chapterNumber: 3 };
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: state });

      const stateJson = JSON.stringify({
        location: "Forest",
        mood: "anxious",
        knowledgeGained: ["secret revealed"],
        lieProgress: 0.5,
        injuries: ["cut arm", "bruised ribs"],
        inventory: ["sword"],
        notes: "turning point",
      });

      const result = await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 3,
        state: stateJson,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({
          chapterNumber: 3,
          location: "Forest",
          emotionalState: "anxious",
          knownInformation: ["secret revealed"],
          inventory: ["sword"],
          physicalCondition: "cut arm; bruised ribs",
          changes: expect.arrayContaining(["lieProgress:0.5", "turning point"]),
        }),
      );
    });

    it("maps mood to emotionalState", async () => {
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: { id: "s-1" } });

      await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: JSON.stringify({ mood: "happy" }),
      });

      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ emotionalState: "happy" }),
      );
    });

    it("maps knowledgeGained to knownInformation", async () => {
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: { id: "s-1" } });

      await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: JSON.stringify({ knowledgeGained: ["fact A", "fact B"] }),
      });

      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ knownInformation: ["fact A", "fact B"] }),
      );
    });

    it("joins injuries array with semicolon for physicalCondition", async () => {
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: { id: "s-1" } });

      await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: JSON.stringify({ injuries: ["broken leg", "concussion"] }),
      });

      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ physicalCondition: "broken leg; concussion" }),
      );
    });

    it("puts lieProgress and notes into changes array", async () => {
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: { id: "s-1" } });

      await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: JSON.stringify({ lieProgress: 0.8, notes: "important note" }),
      });

      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ changes: ["lieProgress:0.8", "important note"] }),
      );
    });

    it("omits changes when neither lieProgress nor notes provided", async () => {
      mockCharacterCreateState.mockResolvedValue({ ok: true, data: { id: "s-1" } });

      await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: JSON.stringify({ location: "City" }),
      });

      expect(mockCharacterCreateState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        expect.objectContaining({ changes: undefined }),
      );
    });

    it("returns INVALID_INPUT for invalid JSON", async () => {
      const result = await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: "not valid json {",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INVALID_INPUT");
    });

    it("returns INVALID_INPUT when state is not an object", async () => {
      const result = await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: '"just a string"',
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INVALID_INPUT");
    });

    it("returns error when service fails", async () => {
      mockCharacterCreateState.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "State already exists" },
      });

      const result = await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("CONFLICT");
    });

    it("blocks when chapter does not exist (gate not met)", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ description: "第1章内容已存在", level: "HARD", met: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["第1章内容已存在"],
        suggestions: ["请先写作该章节"],
      });

      const result = await handlers.get("character_state_create")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 1,
        state: "{}",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockCharacterCreateState).not.toHaveBeenCalled();
    });
  });

  describe("character_state_read", () => {
    it("reads single state when characterId and chapterNumber provided", async () => {
      const state = { id: "s-1", chapterNumber: 3 };
      mockCharacterReadState.mockResolvedValue({ ok: true, data: state });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 3,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(state);
      expect(mockCharacterReadState).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000002",
        3,
      );
    });

    it("lists all states for a character when only characterId provided", async () => {
      const states = [
        { id: "s-1", chapterNumber: 1 },
        { id: "s-2", chapterNumber: 5 },
      ];
      mockCharacterListStates.mockResolvedValue({ ok: true, data: states });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual(states);
    });

    it("filters by range when characterId and range provided", async () => {
      const states = [
        { id: "s-1", chapterNumber: 1 },
        { id: "s-2", chapterNumber: 5 },
        { id: "s-3", chapterNumber: 10 },
      ];
      mockCharacterListStates.mockResolvedValue({ ok: true, data: states });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        range: { from: 3, to: 8 },
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      expect(payload.data).toEqual([{ id: "s-2", chapterNumber: 5 }]);
    });

    it("aggregates states across all characters when no characterId", async () => {
      const chars = [
        { id: "c-1", name: "Hero" },
        { id: "c-2", name: "Villain" },
      ];
      mockCharacterList.mockResolvedValue({ ok: true, data: chars });
      mockCharacterListStates
        .mockResolvedValueOnce({ ok: true, data: [{ id: "s-1", chapterNumber: 1 }] })
        .mockResolvedValueOnce({ ok: true, data: [{ id: "s-2", chapterNumber: 2 }] });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      const data = payload.data as Array<Record<string, unknown>>;
      expect(data).toHaveLength(2);
      expect(data[0]!.characterName).toBe("Hero");
      expect(data[1]!.characterName).toBe("Villain");
    });

    it("filters aggregate by chapterNumber", async () => {
      const chars = [{ id: "c-1", name: "Hero" }];
      mockCharacterList.mockResolvedValue({ ok: true, data: chars });
      mockCharacterListStates.mockResolvedValue({
        ok: true,
        data: [
          { id: "s-1", chapterNumber: 1 },
          { id: "s-2", chapterNumber: 3 },
        ],
      });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        chapterNumber: 3,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(true);
      const data = payload.data as Array<Record<string, unknown>>;
      expect(data).toHaveLength(1);
      expect(data[0]!.id).toBe("s-2");
    });

    it("returns error when character list fails in aggregate mode", async () => {
      mockCharacterList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "DB error" },
      });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });

    it("returns error when single state read fails", async () => {
      mockCharacterReadState.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Not found" },
      });

      const result = await handlers.get("character_state_read")!({
        projectId: "00000000-0000-0000-0000-000000000001",
        characterId: "00000000-0000-0000-0000-000000000002",
        chapterNumber: 99,
      });
      const payload = parseResponse(result);

      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("NOT_FOUND");
    });
  });
});
