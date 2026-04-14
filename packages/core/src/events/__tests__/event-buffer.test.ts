import { describe, it, expect, beforeEach } from "vitest";
import { EventBuffer } from "../event-buffer.js";

describe("EventBuffer", () => {
  let buffer: EventBuffer;

  beforeEach(() => {
    buffer = new EventBuffer(5); // 小容量便于测试
  });

  describe("push", () => {
    it("assigns incrementing IDs", () => {
      const id1 = buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = buffer.push("p1", { type: "heartbeat", data: { ts: 2 } });
      const id3 = buffer.push("p2", { type: "heartbeat", data: { ts: 3 } });
      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it("IDs are globally unique across projects", () => {
      const id1 = buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = buffer.push("p2", { type: "heartbeat", data: { ts: 2 } });
      expect(id2).toBe(id1 + 1);
    });
  });

  describe("getAfter", () => {
    it("returns empty array for unknown project", () => {
      expect(buffer.getAfter("unknown", 0)).toEqual([]);
    });

    it("returns all events after given ID", () => {
      buffer.push("p1", { type: "writing", data: { chunk: "a", wordCount: 1 } });
      const id2 = buffer.push("p1", { type: "writing", data: { chunk: "b", wordCount: 2 } });
      buffer.push("p1", { type: "writing", data: { chunk: "c", wordCount: 3 } });

      const after = buffer.getAfter("p1", id2);
      expect(after).not.toBeNull();
      expect(after!).toHaveLength(1);
      expect(after![0]!.event.data).toEqual({ chunk: "c", wordCount: 3 });
    });

    it("returns all events when afterId is 0", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      buffer.push("p1", { type: "heartbeat", data: { ts: 2 } });

      const result = buffer.getAfter("p1", 0);
      expect(result).toHaveLength(2);
    });

    it("returns empty when afterId is the latest", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = buffer.push("p1", { type: "heartbeat", data: { ts: 2 } });

      expect(buffer.getAfter("p1", id2)).toEqual([]);
    });

    it("returns null when afterId is expired (ring buffer wrapped)", () => {
      // 容量为 5，推入 8 条事件
      for (let i = 1; i <= 8; i++) {
        buffer.push("p1", { type: "heartbeat", data: { ts: i } });
      }
      // ID 1-3 已被淘汰（只剩 4-8）
      // afterId=1 时，oldest=4，1 < 4-1=3，所以返回 null
      expect(buffer.getAfter("p1", 1)).toBeNull();
    });

    it("handles afterId just at boundary correctly", () => {
      for (let i = 1; i <= 8; i++) {
        buffer.push("p1", { type: "heartbeat", data: { ts: i } });
      }
      // afterId=3，oldest=4，3 < 4-1=3 为 false（3 === 3），所以不是 null
      const result = buffer.getAfter("p1", 3);
      expect(result).not.toBeNull();
      expect(result!).toHaveLength(5); // IDs 4-8
    });

    it("isolates events between projects", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      buffer.push("p2", { type: "heartbeat", data: { ts: 2 } });

      const p1Events = buffer.getAfter("p1", 0);
      expect(p1Events).toHaveLength(1);
      const p2Events = buffer.getAfter("p2", 0);
      expect(p2Events).toHaveLength(1);
    });

    it("returns events in ID order", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 10 } });
      buffer.push("p1", { type: "writing", data: { chunk: "x", wordCount: 1 } });
      buffer.push("p1", { type: "heartbeat", data: { ts: 20 } });

      const result = buffer.getAfter("p1", 0);
      expect(result).toHaveLength(3);
      expect(result![0]!.id).toBeLessThan(result![1]!.id);
      expect(result![1]!.id).toBeLessThan(result![2]!.id);
    });
  });

  describe("getLatestId", () => {
    it("returns 0 for empty project", () => {
      expect(buffer.getLatestId("p1")).toBe(0);
    });

    it("returns latest event ID", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      const id = buffer.push("p1", { type: "heartbeat", data: { ts: 2 } });
      expect(buffer.getLatestId("p1")).toBe(id);
    });

    it("returns correct ID after ring buffer wraps", () => {
      for (let i = 0; i < 7; i++) {
        buffer.push("p1", { type: "heartbeat", data: { ts: i } });
      }
      const lastId = buffer.push("p1", { type: "heartbeat", data: { ts: 99 } });
      expect(buffer.getLatestId("p1")).toBe(lastId);
    });
  });

  describe("size", () => {
    it("returns 0 for unknown project", () => {
      expect(buffer.size("p1")).toBe(0);
    });

    it("tracks event count", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      buffer.push("p1", { type: "heartbeat", data: { ts: 2 } });
      expect(buffer.size("p1")).toBe(2);
    });

    it("caps at capacity after wrap", () => {
      for (let i = 0; i < 10; i++) {
        buffer.push("p1", { type: "heartbeat", data: { ts: i } });
      }
      expect(buffer.size("p1")).toBe(5); // capacity = 5
    });
  });

  describe("clear", () => {
    it("removes project buffer", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      buffer.clear("p1");
      expect(buffer.size("p1")).toBe(0);
      expect(buffer.getAfter("p1", 0)).toEqual([]);
    });
  });

  describe("dispose", () => {
    it("clears all buffers and resets sequence", () => {
      buffer.push("p1", { type: "heartbeat", data: { ts: 1 } });
      buffer.push("p2", { type: "heartbeat", data: { ts: 2 } });
      buffer.dispose();
      expect(buffer.size("p1")).toBe(0);
      expect(buffer.size("p2")).toBe(0);
      // After dispose, IDs restart from 1
      const newId = buffer.push("p1", { type: "heartbeat", data: { ts: 3 } });
      expect(newId).toBe(1);
    });
  });
});
