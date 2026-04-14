import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "@moran/core";

/**
 * SSE Events Route — 断线重连测试
 *
 * 因为 Hono streamSSE 在 testClient 中无法模拟完整 SSE 流，
 * 这里测试 EventBus + EventBuffer 的集成逻辑，确保断线重连的核心机制正确。
 *
 * 完整的 SSE 端到端测试将在 M4 E2E 阶段通过 Playwright 覆盖。
 */
describe("SSE Events — EventBus + Buffer Integration", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus(50);
  });

  describe("event ID assignment", () => {
    it("emit returns incrementing IDs", () => {
      const id1 = eventBus.emit("p1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = eventBus.emit("p1", { type: "writing", data: { chunk: "a", wordCount: 1 } });
      const id3 = eventBus.emit("p1", { type: "reviewing", data: { round: 1 } });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);
    });

    it("subscribeWithId receives event IDs", () => {
      const received: Array<{ type: string; id: number }> = [];

      eventBus.subscribeWithId("p1", (event, id) => {
        received.push({ type: event.type, id });
      });

      eventBus.emit("p1", { type: "context", data: { budget: [] } });
      eventBus.emit("p1", { type: "writing", data: { chunk: "x", wordCount: 1 } });

      expect(received).toHaveLength(2);
      expect(received[0]!.id).toBe(1);
      expect(received[1]!.id).toBe(2);
    });
  });

  describe("Last-Event-ID replay", () => {
    it("replays all events after a given ID", () => {
      // Simulate: client was connected, received events 1-3
      eventBus.emit("p1", { type: "context", data: { budget: [] } });
      eventBus.emit("p1", { type: "writing", data: { chunk: "hello", wordCount: 1 } });
      const lastReceived = eventBus.emit("p1", { type: "writing", data: { chunk: " world", wordCount: 2 } });

      // Client disconnected, more events happened
      eventBus.emit("p1", { type: "reviewing", data: { round: 1 } });
      eventBus.emit("p1", {
        type: "review",
        data: { passed: true, report: { round: 1, passed: true, score: 85, issues: [] } },
      });
      eventBus.emit("p1", { type: "done", data: { chapterNumber: 1, wordCount: 3000 } });

      // Client reconnects with Last-Event-ID = lastReceived
      const missed = eventBus.buffer.getAfter("p1", lastReceived);
      expect(missed).not.toBeNull();
      expect(missed!).toHaveLength(3);
      expect(missed![0]!.event.type).toBe("reviewing");
      expect(missed![1]!.event.type).toBe("review");
      expect(missed![2]!.event.type).toBe("done");
    });

    it("returns empty when client is up to date", () => {
      eventBus.emit("p1", { type: "heartbeat", data: { ts: 1 } });
      const latest = eventBus.emit("p1", { type: "heartbeat", data: { ts: 2 } });

      const missed = eventBus.buffer.getAfter("p1", latest);
      expect(missed).toEqual([]);
    });

    it("returns null when events are expired (buffer overflow)", () => {
      // Buffer capacity = 50, push 60 events
      for (let i = 0; i < 60; i++) {
        eventBus.emit("p1", { type: "heartbeat", data: { ts: i } });
      }

      // Try to replay from ID 1 (long gone)
      const missed = eventBus.buffer.getAfter("p1", 1);
      expect(missed).toBeNull();
    });

    it("replays from buffer even with no active subscribers", () => {
      // Events emitted with no subscribers
      eventBus.emit("p1", { type: "writing", data: { chunk: "a", wordCount: 1 } });
      eventBus.emit("p1", { type: "writing", data: { chunk: "b", wordCount: 2 } });

      // New client connects, asks for replay from 0
      const missed = eventBus.buffer.getAfter("p1", 0);
      expect(missed).toHaveLength(2);
    });
  });

  describe("multi-project isolation", () => {
    it("events from different projects do not mix in replay", () => {
      eventBus.emit("p1", { type: "heartbeat", data: { ts: 1 } });
      eventBus.emit("p2", { type: "heartbeat", data: { ts: 2 } });
      eventBus.emit("p1", { type: "writing", data: { chunk: "p1", wordCount: 1 } });
      eventBus.emit("p2", { type: "writing", data: { chunk: "p2", wordCount: 1 } });

      const p1Events = eventBus.buffer.getAfter("p1", 0);
      const p2Events = eventBus.buffer.getAfter("p2", 0);

      expect(p1Events).toHaveLength(2);
      expect(p2Events).toHaveLength(2);
      expect(p1Events![0]!.event.type).toBe("heartbeat");
      expect(p1Events![1]!.event.type).toBe("writing");
    });
  });

  describe("heartbeat buffering", () => {
    it("heartbeats are buffered like any other event", () => {
      const id = eventBus.emit("p1", { type: "heartbeat", data: { ts: 12345 } });
      const buffered = eventBus.buffer.getAfter("p1", id - 1);
      expect(buffered).toHaveLength(1);
      expect(buffered![0]!.event.type).toBe("heartbeat");
    });
  });

  describe("typical write session reconnect scenario", () => {
    it("full write→disconnect→reconnect→done flow", () => {
      const clientEvents: Array<{ type: string; id: number }> = [];

      // Phase 1: Client connected, receives context + initial writing chunks
      const unsub = eventBus.subscribeWithId("p1", (event, id) => {
        clientEvents.push({ type: event.type, id });
      });

      eventBus.emit("p1", { type: "context", data: { budget: [] } });
      eventBus.emit("p1", { type: "writing", data: { chunk: "第一章", wordCount: 3 } });
      const lastKnown = eventBus.emit("p1", { type: "writing", data: { chunk: " 天气", wordCount: 5 } });

      expect(clientEvents).toHaveLength(3);

      // Phase 2: Client disconnects
      unsub();

      // More events happen while disconnected
      eventBus.emit("p1", { type: "writing", data: { chunk: "晴朗", wordCount: 7 } });
      eventBus.emit("p1", { type: "reviewing", data: { round: 1 } });
      eventBus.emit("p1", {
        type: "review",
        data: { passed: true, report: { round: 1, passed: true, score: 90, issues: [] } },
      });
      eventBus.emit("p1", { type: "archiving", data: { chapterNumber: 1 } });
      eventBus.emit("p1", { type: "done", data: { chapterNumber: 1, wordCount: 3000 } });

      // Phase 3: Client reconnects with Last-Event-ID
      const missed = eventBus.buffer.getAfter("p1", lastKnown);
      expect(missed).not.toBeNull();
      expect(missed!).toHaveLength(5);

      const types = missed!.map((e) => e.event.type);
      expect(types).toEqual(["writing", "reviewing", "review", "archiving", "done"]);

      // Phase 4: Client re-subscribes and continues receiving new events
      const newClientEvents: Array<{ type: string; id: number }> = [];
      eventBus.subscribeWithId("p1", (event, id) => {
        newClientEvents.push({ type: event.type, id });
      });

      eventBus.emit("p1", { type: "heartbeat", data: { ts: 9999 } });
      expect(newClientEvents).toHaveLength(1);
    });
  });
});
