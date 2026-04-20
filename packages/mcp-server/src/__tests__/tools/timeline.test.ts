import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockServer, parseResponse } from "../helpers.js";

const { mockCreate, mockList } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@moran/core/services", () => ({
  timelineService: {
    create: mockCreate,
    list: mockList,
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

import { registerTimelineTools } from "../../tools/timeline.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const CHAR_ID_1 = "00000000-0000-0000-0000-000000000031";
const CHAR_ID_2 = "00000000-0000-0000-0000-000000000032";
const LOC_ID = "00000000-0000-0000-0000-000000000041";
const EVENT_ID_1 = "00000000-0000-0000-0000-000000000051";
const EVENT_ID_2 = "00000000-0000-0000-0000-000000000052";

describe("timeline tools", () => {
  const { server, handlers } = createMockServer();
  registerTimelineTools(server);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPrerequisites.mockResolvedValue({ passed: true, conditions: [] });
  });

  describe("timeline_create", () => {
    it("creates batch of events and returns all ids", async () => {
      mockCreate
        .mockResolvedValueOnce({ ok: true, data: { id: EVENT_ID_1 } })
        .mockResolvedValueOnce({ ok: true, data: { id: EVENT_ID_2 } });

      const result = await handlers.get("timeline_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
        events: [
          {
            storyTimestamp: "第三天 傍晚",
            description: "主角抵达城门",
            characterIds: [CHAR_ID_1],
            locationId: LOC_ID,
          },
          {
            storyTimestamp: "第三天 夜晚",
            description: "主角入住客栈",
            characterIds: [CHAR_ID_1, CHAR_ID_2],
          },
        ],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as { ids: string[] };
      expect(data.ids).toEqual([EVENT_ID_1, EVENT_ID_2]);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("passes correct fields to service for each event", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { id: EVENT_ID_1 } });

      await handlers.get("timeline_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 5,
        events: [
          {
            storyTimestamp: "第五天 清晨",
            description: "战斗开始",
            characterIds: [CHAR_ID_1],
            locationId: LOC_ID,
          },
        ],
      });

      expect(mockCreate).toHaveBeenCalledWith(PROJECT_ID, {
        chapterNumber: 5,
        storyTimestamp: "第五天 清晨",
        description: "战斗开始",
        characterIds: [CHAR_ID_1],
        locationId: LOC_ID,
      });
    });

    it("returns error on partial failure (first event fails)", async () => {
      mockCreate.mockResolvedValueOnce({
        ok: false,
        error: { code: "INTERNAL", message: "创建失败" },
      });

      const result = await handlers.get("timeline_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
        events: [
          {
            storyTimestamp: "第三天",
            description: "事件1",
            characterIds: [CHAR_ID_1],
          },
          {
            storyTimestamp: "第三天 晚",
            description: "事件2",
            characterIds: [CHAR_ID_2],
          },
        ],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
      // Second event should not be created after failure
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("returns error on partial failure (second event fails)", async () => {
      mockCreate
        .mockResolvedValueOnce({ ok: true, data: { id: EVENT_ID_1 } })
        .mockResolvedValueOnce({
          ok: false,
          error: { code: "VALIDATION", message: "验证失败" },
        });

      const result = await handlers.get("timeline_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
        events: [
          { storyTimestamp: "第三天", description: "事件1", characterIds: [CHAR_ID_1] },
          { storyTimestamp: "第三天 晚", description: "事件2", characterIds: [CHAR_ID_2] },
        ],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("VALIDATION");
    });

    it("blocks when review gate not met", async () => {
      mockCheckPrerequisites.mockResolvedValue({
        passed: false,
        conditions: [{ description: "第3章审校已通过", level: "HARD", met: false }],
      });
      mockToGateDetails.mockReturnValue({
        passed: [],
        failed: ["第3章审校已通过"],
        suggestions: ["该章节审校尚未通过，请先完成四轮审校"],
      });

      const result = await handlers.get("timeline_create")!({
        projectId: PROJECT_ID,
        chapterNumber: 3,
        events: [
          { storyTimestamp: "第三天", description: "事件1", characterIds: [CHAR_ID_1] },
        ],
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("GATE_FAILED");
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("timeline_read", () => {
    const SAMPLE_EVENTS = [
      { id: "e1", chapterNumber: 1, characterIds: [CHAR_ID_1], locationId: LOC_ID },
      { id: "e2", chapterNumber: 3, characterIds: [CHAR_ID_2], locationId: LOC_ID },
      { id: "e3", chapterNumber: 5, characterIds: [CHAR_ID_1], locationId: "other-loc" },
      { id: "e4", chapterNumber: 8, characterIds: [CHAR_ID_1, CHAR_ID_2], locationId: LOC_ID },
    ];

    it("returns all events when no filters", async () => {
      mockList.mockResolvedValue({ ok: true, data: SAMPLE_EVENTS });

      const result = await handlers.get("timeline_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as unknown[];
      expect(data).toHaveLength(4);
    });

    it("filters by chapterRange", async () => {
      mockList.mockResolvedValue({ ok: true, data: SAMPLE_EVENTS });

      const result = await handlers.get("timeline_read")!({
        projectId: PROJECT_ID,
        chapterRange: { from: 2, to: 6 },
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      expect(data.map((e) => e.id)).toEqual(["e2", "e3"]);
    });

    it("filters by characterId", async () => {
      mockList.mockResolvedValue({ ok: true, data: SAMPLE_EVENTS });

      const result = await handlers.get("timeline_read")!({
        projectId: PROJECT_ID,
        characterId: CHAR_ID_2,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      // e2 has CHAR_ID_2, e4 has both
      expect(data.map((e) => e.id)).toEqual(["e2", "e4"]);
    });

    it("filters by locationId", async () => {
      mockList.mockResolvedValue({ ok: true, data: SAMPLE_EVENTS });

      const result = await handlers.get("timeline_read")!({
        projectId: PROJECT_ID,
        locationId: LOC_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      expect(data.map((e) => e.id)).toEqual(["e1", "e2", "e4"]);
    });

    it("combines multiple filters", async () => {
      mockList.mockResolvedValue({ ok: true, data: SAMPLE_EVENTS });

      const result = await handlers.get("timeline_read")!({
        projectId: PROJECT_ID,
        chapterRange: { from: 1, to: 5 },
        characterId: CHAR_ID_1,
        locationId: LOC_ID,
      });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Array<{ id: string }>;
      // e1: ch1, CHAR_ID_1, LOC_ID ✓
      // e2: ch3, CHAR_ID_2 only ✗
      // e3: ch5, CHAR_ID_1, other-loc ✗
      expect(data.map((e) => e.id)).toEqual(["e1"]);
    });

    it("propagates service error", async () => {
      mockList.mockResolvedValue({
        ok: false,
        error: { code: "INTERNAL", message: "查询失败" },
      });

      const result = await handlers.get("timeline_read")!({ projectId: PROJECT_ID });

      const payload = parseResponse(result);
      expect(payload.ok).toBe(false);
      expect(payload.error?.code).toBe("INTERNAL");
    });
  });
});
