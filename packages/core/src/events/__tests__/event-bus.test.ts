import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../event-bus.js";
import type { SSEEvent } from "../types.js";

describe("EventBus", () => {
  describe("subscribe / emit", () => {
    it("delivers events to subscribers of the same project", () => {
      const bus = new EventBus();
      const received: SSEEvent[] = [];

      bus.subscribe("proj-1", (event) => received.push(event));
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });

      expect(received).toHaveLength(1);
      expect(received[0]?.type).toBe("heartbeat");
    });

    it("does not deliver events to other projects", () => {
      const bus = new EventBus();
      const received: SSEEvent[] = [];

      bus.subscribe("proj-1", (event) => received.push(event));
      bus.emit("proj-2", { type: "heartbeat", data: { ts: 1000 } });

      expect(received).toHaveLength(0);
    });

    it("delivers to multiple subscribers of the same project", () => {
      const bus = new EventBus();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bus.subscribe("proj-1", listener1);
      bus.subscribe("proj-1", listener2);
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops event delivery", () => {
      const bus = new EventBus();
      const received: SSEEvent[] = [];

      const unsubscribe = bus.subscribe("proj-1", (event) => received.push(event));
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });
      expect(received).toHaveLength(1);

      unsubscribe();
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 2000 } });
      expect(received).toHaveLength(1);
    });

    it("cleans up channel when last subscriber unsubscribes", () => {
      const bus = new EventBus();
      const unsub = bus.subscribe("proj-1", () => {});
      expect(bus.subscriberCount("proj-1")).toBe(1);

      unsub();
      expect(bus.subscriberCount("proj-1")).toBe(0);
    });
  });

  describe("subscribeType", () => {
    it("only receives events of the specified type", () => {
      const bus = new EventBus();
      const received: number[] = [];

      bus.subscribeType("proj-1", "reviewing", (data) => received.push(data.round));

      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });
      bus.emit("proj-1", { type: "reviewing", data: { round: 1 } });
      bus.emit("proj-1", { type: "reviewing", data: { round: 2 } });
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 2000 } });

      expect(received).toEqual([1, 2]);
    });
  });

  describe("emit returns event ID", () => {
    it("returns incrementing event IDs", () => {
      const bus = new EventBus();
      const id1 = bus.emit("proj-1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = bus.emit("proj-1", { type: "heartbeat", data: { ts: 2 } });
      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it("IDs are unique across projects", () => {
      const bus = new EventBus();
      const id1 = bus.emit("proj-1", { type: "heartbeat", data: { ts: 1 } });
      const id2 = bus.emit("proj-2", { type: "heartbeat", data: { ts: 2 } });
      expect(id2).toBe(id1 + 1);
    });
  });

  describe("subscribeWithId", () => {
    it("delivers events with their assigned IDs", () => {
      const bus = new EventBus();
      const received: Array<{ event: SSEEvent; id: number }> = [];

      bus.subscribeWithId("proj-1", (event, id) => received.push({ event, id }));
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });
      bus.emit("proj-1", { type: "writing", data: { chunk: "hi", wordCount: 1 } });

      expect(received).toHaveLength(2);
      expect(received[0]!.id).toBe(1);
      expect(received[1]!.id).toBe(2);
      expect(received[0]!.event.type).toBe("heartbeat");
      expect(received[1]!.event.type).toBe("writing");
    });
  });

  describe("buffer integration", () => {
    it("buffers emitted events", () => {
      const bus = new EventBus();
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1 } });
      bus.emit("proj-1", { type: "writing", data: { chunk: "x", wordCount: 1 } });

      const buffered = bus.buffer.getAfter("proj-1", 0);
      expect(buffered).toHaveLength(2);
    });

    it("can replay missed events from buffer", () => {
      const bus = new EventBus();
      const id1 = bus.emit("proj-1", { type: "heartbeat", data: { ts: 1 } });
      bus.emit("proj-1", { type: "writing", data: { chunk: "a", wordCount: 1 } });
      bus.emit("proj-1", { type: "writing", data: { chunk: "b", wordCount: 2 } });

      // Simulate reconnect — get events after id1
      const missed = bus.buffer.getAfter("proj-1", id1);
      expect(missed).toHaveLength(2);
      expect(missed![0]!.event.type).toBe("writing");
    });
  });

  describe("error isolation", () => {
    it("continues delivering to other listeners when one throws", () => {
      const bus = new EventBus();
      const received: SSEEvent[] = [];

      bus.subscribe("proj-1", () => {
        throw new Error("boom");
      });
      bus.subscribe("proj-1", (event) => received.push(event));

      // Should not throw
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1000 } });
      expect(received).toHaveLength(1);
    });
  });

  describe("subscriberCount / removeAll / dispose", () => {
    it("subscriberCount returns correct count", () => {
      const bus = new EventBus();
      expect(bus.subscriberCount("proj-1")).toBe(0);

      bus.subscribe("proj-1", () => {});
      bus.subscribe("proj-1", () => {});
      expect(bus.subscriberCount("proj-1")).toBe(2);
    });

    it("removeAll clears all subscribers for a project", () => {
      const bus = new EventBus();
      bus.subscribe("proj-1", () => {});
      bus.subscribe("proj-1", () => {});
      bus.subscribe("proj-2", () => {});

      bus.removeAll("proj-1");
      expect(bus.subscriberCount("proj-1")).toBe(0);
      expect(bus.subscriberCount("proj-2")).toBe(1);
    });

    it("dispose clears all channels and buffers", () => {
      const bus = new EventBus();
      bus.subscribe("proj-1", () => {});
      bus.subscribe("proj-2", () => {});
      bus.emit("proj-1", { type: "heartbeat", data: { ts: 1 } });

      bus.dispose();
      expect(bus.subscriberCount("proj-1")).toBe(0);
      expect(bus.subscriberCount("proj-2")).toBe(0);
      expect(bus.buffer.size("proj-1")).toBe(0);
    });
  });
});
