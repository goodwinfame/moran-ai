/**
 * SSEBroadcaster — Unit Tests
 *
 * Tests: connection management, buffering, broadcasting, replay, cleanup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SSEBroadcaster } from "../../sse/broadcaster.js";
import type { SSEConnection, SSEEvent } from "../../sse/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(id: number, type: SSEEvent["type"] = "text"): SSEEvent {
  return {
    id,
    type,
    data: { content: `event-${id}` },
    timestamp: Date.now(),
  };
}

function makeConn(connId = "conn-1"): { conn: SSEConnection; writes: SSEEvent[] } {
  const writes: SSEEvent[] = [];
  const conn: SSEConnection = {
    connId,
    write: vi.fn(async (event: SSEEvent) => {
      writes.push(event);
    }),
  };
  return { conn, writes };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SSEBroadcaster", () => {
  let bc: SSEBroadcaster;

  beforeEach(() => {
    bc = new SSEBroadcaster();
  });

  // ── Connection management ─────────────────────────────────────────────────

  describe("addConnection / removeConnection", () => {
    it("adds a connection and increments count", () => {
      const { conn } = makeConn("c1");
      bc.addConnection("session-1", conn);
      expect(bc.connectionCount("session-1")).toBe(1);
    });

    it("supports multiple connections per session", () => {
      const { conn: c1 } = makeConn("c1");
      const { conn: c2 } = makeConn("c2");
      bc.addConnection("session-1", c1);
      bc.addConnection("session-1", c2);
      expect(bc.connectionCount("session-1")).toBe(2);
    });

    it("removes a connection and decrements count", () => {
      const { conn } = makeConn("c1");
      bc.addConnection("session-1", conn);
      bc.removeConnection("session-1", conn);
      expect(bc.connectionCount("session-1")).toBe(0);
    });

    it("removing a connection from unknown session does not throw", () => {
      const { conn } = makeConn("c1");
      expect(() => bc.removeConnection("nonexistent", conn)).not.toThrow();
    });

    it("returns 0 for sessions with no connections", () => {
      expect(bc.connectionCount("no-such-session")).toBe(0);
    });

    it("supports connections across different sessions independently", () => {
      const { conn: c1 } = makeConn("c1");
      const { conn: c2 } = makeConn("c2");
      bc.addConnection("session-A", c1);
      bc.addConnection("session-B", c2);
      expect(bc.connectionCount("session-A")).toBe(1);
      expect(bc.connectionCount("session-B")).toBe(1);
    });
  });

  // ── buffer() ─────────────────────────────────────────────────────────────

  describe("buffer()", () => {
    it("stores events in the ring buffer", () => {
      bc.buffer("session-1", makeEvent(1));
      bc.buffer("session-1", makeEvent(2));
      expect(bc.bufferSize("session-1")).toBe(2);
    });

    it("does NOT write to active connections", async () => {
      const { conn } = makeConn("c1");
      bc.addConnection("session-1", conn);
      bc.buffer("session-1", makeEvent(1));
      expect(conn.write).not.toHaveBeenCalled();
    });

    it("returns 0 buffer size for unknown session", () => {
      expect(bc.bufferSize("nonexistent")).toBe(0);
    });

    it("wraps around when buffer exceeds capacity", () => {
      const smallBc = new SSEBroadcaster(5);
      for (let i = 1; i <= 7; i++) smallBc.buffer("s", makeEvent(i));
      // capacity is 5, so bufferSize returns 5
      expect(smallBc.bufferSize("s")).toBe(5);
    });
  });

  // ── broadcast() ──────────────────────────────────────────────────────────

  describe("broadcast()", () => {
    it("writes event to all active connections", async () => {
      const { conn: c1, writes: w1 } = makeConn("c1");
      const { conn: c2, writes: w2 } = makeConn("c2");
      bc.addConnection("session-1", c1);
      bc.addConnection("session-1", c2);

      const event = makeEvent(1);
      await bc.broadcast("session-1", event);

      expect(w1).toHaveLength(1);
      expect(w1[0]).toEqual(event);
      expect(w2).toHaveLength(1);
      expect(w2[0]).toEqual(event);
    });

    it("also buffers the event", async () => {
      const { conn } = makeConn("c1");
      bc.addConnection("session-1", conn);

      await bc.broadcast("session-1", makeEvent(1));
      expect(bc.bufferSize("session-1")).toBe(1);
    });

    it("buffers even when no connections are active", async () => {
      await bc.broadcast("session-1", makeEvent(1));
      expect(bc.bufferSize("session-1")).toBe(1);
    });

    it("removes a connection that throws on write", async () => {
      const failConn: SSEConnection = {
        connId: "failing",
        write: vi.fn().mockRejectedValue(new Error("stream closed")),
      };
      bc.addConnection("session-1", failConn);
      expect(bc.connectionCount("session-1")).toBe(1);

      await bc.broadcast("session-1", makeEvent(1));

      // Failed connection should be auto-removed
      expect(bc.connectionCount("session-1")).toBe(0);
    });

    it("still writes to healthy connections even if one fails", async () => {
      const { conn: goodConn, writes } = makeConn("good");
      const failConn: SSEConnection = {
        connId: "fail",
        write: vi.fn().mockRejectedValue(new Error("closed")),
      };
      bc.addConnection("session-1", goodConn);
      bc.addConnection("session-1", failConn);

      await bc.broadcast("session-1", makeEvent(1));

      expect(writes).toHaveLength(1);
    });
  });

  // ── replay() ─────────────────────────────────────────────────────────────

  describe("replay()", () => {
    it("returns empty array for unknown session", () => {
      expect(bc.replay("nonexistent", 0)).toEqual([]);
    });

    it("returns all events after the given event ID", () => {
      bc.buffer("s", makeEvent(1));
      bc.buffer("s", makeEvent(2));
      bc.buffer("s", makeEvent(3));

      const result = bc.replay("s", 1);
      expect(result).not.toBeNull();
      expect(result?.map((e) => e.id)).toEqual([2, 3]);
    });

    it("returns empty array when afterEventId equals latest", () => {
      bc.buffer("s", makeEvent(1));
      bc.buffer("s", makeEvent(2));

      const result = bc.replay("s", 2);
      expect(result).toEqual([]);
    });

    it("returns all events when afterEventId is 0", () => {
      bc.buffer("s", makeEvent(1));
      bc.buffer("s", makeEvent(2));

      const result = bc.replay("s", 0);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it("returns null when afterEventId is too old (evicted from ring buffer)", () => {
      const smallBc = new SSEBroadcaster(3); // capacity 3
      // Fill past capacity: events 1-4, oldest (1) evicted
      smallBc.buffer("s", makeEvent(1));
      smallBc.buffer("s", makeEvent(2));
      smallBc.buffer("s", makeEvent(3));
      smallBc.buffer("s", makeEvent(4)); // evicts event 1

      // afterEventId=0 is older than oldest buffered (2), so null
      const result = smallBc.replay("s", 0);
      expect(result).toBeNull();
    });

    it("returns events sorted by id (ascending)", () => {
      // Buffer events out of order
      bc.buffer("s", makeEvent(3));
      bc.buffer("s", makeEvent(1));
      bc.buffer("s", makeEvent(2));

      const result = bc.replay("s", 0);
      expect(result?.map((e) => e.id)).toEqual([1, 2, 3]);
    });

    it("handles broadcasted events in replay correctly", async () => {
      const { conn } = makeConn("c1");
      bc.addConnection("s", conn);
      await bc.broadcast("s", makeEvent(10));
      await bc.broadcast("s", makeEvent(11));

      const result = bc.replay("s", 10);
      expect(result?.map((e) => e.id)).toEqual([11]);
    });
  });

  // ── cleanup() ─────────────────────────────────────────────────────────────

  describe("cleanup()", () => {
    it("removes buffers older than maxAgeMs", async () => {
      bc.buffer("old-session", makeEvent(1));

      // Use 0ms max age → everything is stale
      bc.cleanup(0);

      expect(bc.bufferSize("old-session")).toBe(0);
    });

    it("keeps recently active buffers", () => {
      bc.buffer("fresh-session", makeEvent(1));

      // Use very large max age → nothing is stale
      bc.cleanup(60 * 60 * 1000);

      expect(bc.bufferSize("fresh-session")).toBe(1);
    });

    it("also removes connections for cleaned-up sessions", () => {
      const { conn } = makeConn("c1");
      bc.addConnection("old-session", conn);
      bc.buffer("old-session", makeEvent(1));

      bc.cleanup(0);

      expect(bc.connectionCount("old-session")).toBe(0);
    });
  });

  // ── Singleton export ──────────────────────────────────────────────────────

  describe("singleton export", () => {
    it("exports a broadcaster singleton instance", async () => {
      const { broadcaster } = await import("../../sse/broadcaster.js");
      expect(broadcaster).toBeInstanceOf(SSEBroadcaster);
    });
  });
});
