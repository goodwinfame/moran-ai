/**
 * SSEBroadcaster — Connection management + per-session ring buffer + replay.
 *
 * Responsibilities:
 * - Track active SSE connections per session
 * - Maintain a ring buffer (capacity 200) per session for Last-Event-Id replay
 * - Broadcast events to all active connections and buffer them simultaneously
 * - Replay buffered events after a given event ID (reconnection recovery)
 * - Clean up stale buffers to prevent memory leaks
 */

import type { SSEEvent, SSEConnection } from "./types.js";

/** Default ring buffer capacity per session */
const DEFAULT_CAPACITY = 200;

/** Internal ring buffer for one session */
interface RingBuffer {
  events: Array<SSEEvent | undefined>;
  /** Next write index (wraps around at capacity) */
  writePos: number;
  /** Whether the buffer has wrapped at least once */
  full: boolean;
  /** Timestamp of last event written — used for cleanup */
  lastWrittenAt: number;
}

export class SSEBroadcaster {
  private readonly capacity: number;
  /** Active connections keyed by sessionId */
  private readonly connections = new Map<string, Set<SSEConnection>>();
  /** Ring buffers keyed by sessionId */
  private readonly buffers = new Map<string, RingBuffer>();

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
  }

  // ── Connection management ──────────────────────────────────────────────────

  /**
   * Register a new SSE connection for the given session.
   * Multiple connections per session are supported (e.g., multiple browser tabs).
   */
  addConnection(sessionId: string, conn: SSEConnection): void {
    let conns = this.connections.get(sessionId);
    if (!conns) {
      conns = new Set();
      this.connections.set(sessionId, conns);
    }
    conns.add(conn);
  }

  /**
   * Remove an SSE connection (called on client disconnect or stream close).
   */
  removeConnection(sessionId: string, conn: SSEConnection): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;
    conns.delete(conn);
    if (conns.size === 0) {
      this.connections.delete(sessionId);
    }
  }

  // ── Buffering and broadcasting ─────────────────────────────────────────────

  /**
   * Buffer an event in the session's ring buffer without broadcasting.
   * Use this when you want to persist an event for replay without pushing
   * it to currently active connections.
   */
  buffer(sessionId: string, event: SSEEvent): void {
    this.pushToBuffer(sessionId, event);
  }

  /**
   * Broadcast an event to all active connections for the session AND buffer it.
   * Connections that fail to receive the event (e.g., disconnected) are removed.
   *
   * @returns Promise that resolves after all write attempts complete
   */
  async broadcast(sessionId: string, event: SSEEvent): Promise<void> {
    this.pushToBuffer(sessionId, event);

    const conns = this.connections.get(sessionId);
    if (!conns || conns.size === 0) return;

    const failed: SSEConnection[] = [];
    const writes = [...conns].map(async (conn) => {
      try {
        await conn.write(event);
      } catch {
        // Connection is broken — mark for removal
        failed.push(conn);
      }
    });
    await Promise.all(writes);

    for (const conn of failed) {
      conns.delete(conn);
    }
    if (conns.size === 0) {
      this.connections.delete(sessionId);
    }
  }

  // ── Replay (Last-Event-Id reconnection) ───────────────────────────────────

  /**
   * Return all buffered events for the session with id > afterEventId.
   * Returns [] if no events are found or the session buffer doesn't exist.
   * Returns null if afterEventId is too old (evicted from ring buffer).
   */
  replay(sessionId: string, afterEventId: number): SSEEvent[] | null {
    const buf = this.buffers.get(sessionId);
    if (!buf) return [];

    const allEvents = this.collectEvents(buf);
    allEvents.sort((a, b) => a.id - b.id);

    // If buffer has wrapped, check whether afterEventId is still in range
    if (buf.full && allEvents.length > 0) {
      const oldest = allEvents[0];
      if (oldest && afterEventId < oldest.id - 1) {
        // Too old — ring buffer has evicted the events before afterEventId
        return null;
      }
    }

    return allEvents.filter((e) => e.id > afterEventId);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  /**
   * Remove session buffers that haven't received events within maxAgeMs.
   * Call periodically to prevent unbounded memory growth.
   *
   * @param maxAgeMs Maximum age of a buffer in milliseconds (default: 5 minutes)
   */
  cleanup(maxAgeMs = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, buf] of this.buffers) {
      if (now - buf.lastWrittenAt >= maxAgeMs) {
        this.buffers.delete(sessionId);
        this.connections.delete(sessionId);
      }
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private pushToBuffer(sessionId: string, event: SSEEvent): void {
    let buf = this.buffers.get(sessionId);
    if (!buf) {
      buf = {
        events: new Array<SSEEvent | undefined>(this.capacity),
        writePos: 0,
        full: false,
        lastWrittenAt: 0,
      };
      this.buffers.set(sessionId, buf);
    }

    buf.events[buf.writePos] = event;
    buf.writePos = (buf.writePos + 1) % this.capacity;
    if (buf.writePos === 0) {
      buf.full = true;
    }
    buf.lastWrittenAt = Date.now();
  }

  private collectEvents(buf: RingBuffer): SSEEvent[] {
    const count = buf.full ? this.capacity : buf.writePos;
    const result: SSEEvent[] = [];
    for (let i = 0; i < count; i++) {
      const idx = buf.full ? (buf.writePos + i) % this.capacity : i;
      const ev = buf.events[idx];
      if (ev) result.push(ev);
    }
    return result;
  }

  /** Accessor for testing: current connection count for a session */
  connectionCount(sessionId: string): number {
    return this.connections.get(sessionId)?.size ?? 0;
  }

  /** Accessor for testing: current buffer size for a session */
  bufferSize(sessionId: string): number {
    const buf = this.buffers.get(sessionId);
    if (!buf) return 0;
    return buf.full ? this.capacity : buf.writePos;
  }
}

/** Application-level singleton — one broadcaster for the whole api-server process */
export const broadcaster = new SSEBroadcaster();
