/**
 * Chat API routes — OpenCode proxy layer
 *
 * POST /send    — Send user message to OpenCode session (fire-and-forget)
 * GET  /events  — SSE event stream (Phase 4.2: transformer + broadcaster + heartbeat)
 * GET  /history — Fetch message history from OpenCode session
 * GET  /session — Get (or create) OpenCode sessionId for a project
 *
 * All routes require authentication (mounted after requireAuth in app.ts).
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionManager } from "../opencode/manager.js";
import { ok, fail } from "../utils/response.js";
import { EventTransformer } from "../sse/transformer.js";
import { broadcaster } from "../sse/broadcaster.js";
import type { SSEConnection } from "../sse/types.js";

/** Type for userId injected by requireAuth middleware */
type Variables = { userId: string };

// ── Zod schemas ────────────────────────────────────────────────────────────

const sendBodySchema = z.object({
  projectId: z.string().nullable(),
  message: z.string(),
  agent: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

const eventsQuerySchema = z.object({
  sessionId: z.string(),
  projectId: z.string().optional(),
  lastEventId: z.string().optional(),
});

const historyQuerySchema = z.object({
  projectId: z.string(),
  limit: z.coerce.number().int().positive().default(50),
  before: z.string().optional(),
});

const sessionQuerySchema = z.object({
  projectId: z.string().nullable().default(null),
});

// ── Route factory ──────────────────────────────────────────────────────────

export function createChatRoutes() {
  const chat = new Hono<{ Variables: Variables }>();

  /**
   * POST /api/chat/send
   * Sends a user message to the OpenCode session for the given project.
   * Fire-and-forget: enqueues the message and immediately returns messageId.
   */
  chat.post("/send", zValidator("json", sendBodySchema), async (c) => {
    const { projectId, message, agent } = c.req.valid("json");
    const userId = c.get("userId");
    const effectiveProjectId = projectId ?? "__global__";
    const effectiveAgent = agent ?? "moheng";

    const t0 = Date.now();
    try {
      const sessionId = await sessionManager.getOrCreateSession(userId, effectiveProjectId);
      log.info(`[send-timing] getOrCreateSession: +${Date.now() - t0}ms`);
      const result = await sessionManager.sendMessage(sessionId, message, { agent: effectiveAgent });
      log.info(`[send-timing] promptAsync done: +${Date.now() - t0}ms`);
      return ok(c, { messageId: result.messageId, sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      return fail(c, "INTERNAL_ERROR", msg, 500);
    }
  });

  /**
   * GET /api/chat/events
   * Full SSE implementation:
   *   - Last-Event-Id header support for reconnection replay
   *   - EventTransformer maps OpenCode events to 14 V2 SSE event types
   *   - SSEBroadcaster buffers events and manages active connections
   *   - 30-second heartbeat to keep the connection alive
   */
  chat.get("/events", zValidator("query", eventsQuerySchema), (c) => {
    const { sessionId, projectId } = c.req.valid("query");
    const userId = c.get("userId");
    const lastEventIdHeader = c.req.header("Last-Event-Id");

    return streamSSE(c, async (stream) => {
      const t0 = Date.now();
      const elapsed = (label: string) =>
        log.info(`[sse-timing] ${label}: +${Date.now() - t0}ms`);
      elapsed("streamSSE handler entered");

      // ── 1. Replay missed events (Last-Event-Id reconnection) ──────────────
      if (lastEventIdHeader) {
        const afterId = parseInt(lastEventIdHeader, 10);
        if (!isNaN(afterId)) {
          const missed = broadcaster.replay(sessionId, afterId);
          if (missed !== null) {
            for (const event of missed) {
              await stream.writeSSE({
                id: String(event.id),
                event: event.type,
                data: JSON.stringify(event.data),
              });
            }
          }
        }
      }

      // ── 2. Register connection with broadcaster ────────────────────────────
      const conn: SSEConnection = {
        connId: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        write: async (event) => {
          await stream.writeSSE({
            id: String(event.id),
            event: event.type,
            data: JSON.stringify(event.data),
          });
        },
      };
      broadcaster.addConnection(sessionId, conn);

      // ── 3. Subscribe to OpenCode events ───────────────────────────────────
      elapsed("subscribeEvents called");
      const transformer = new EventTransformer({ projectId, userId, sessionId });
      const { stream: eventStream, close } = sessionManager.subscribeEvents(sessionId);
      elapsed("subscribeEvents returned");

      // ── 4. Heartbeat every 30 seconds ─────────────────────────────────────
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: "heartbeat", data: "" }).catch(() => {
          // Stream may have closed — interval will be cleared in finally
        });
      }, 30_000);

      // ── 5. Process event stream ────────────────────────────────────────────
      // Each connection reads its own OpenCode subscription and writes ONLY
      // to its own stream. broadcaster.buffer() stores events for Last-Event-Id
      // replay but does NOT fan out to other connections. This prevents the N²
      // duplication bug where N connections each broadcast to all N peers.
      try {
        const reader = eventStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const sseEvent = transformer.transform(value);
            if (sseEvent) {
              if (sseEvent.type === "text") elapsed("first text event dispatched");
              broadcaster.buffer(sessionId, sseEvent);
              await stream.writeSSE({
                id: String(sseEvent.id),
                event: sseEvent.type,
                data: JSON.stringify(sseEvent.data),
              });
            }
          }
        } finally {
          reader.releaseLock();
        }
      } finally {
        clearInterval(heartbeat);
        broadcaster.removeConnection(sessionId, conn);
        close();
      }
    });
  });

  /**
   * GET /api/chat/session
   * Returns the OpenCode sessionId for the given project.
   * Creates a new session if one does not already exist.
   */
  chat.get("/session", zValidator("query", sessionQuerySchema), async (c) => {
    const { projectId } = c.req.valid("query");
    const userId = c.get("userId");
    const effectiveProjectId = projectId ?? "__global__";
    try {
      const sessionId = await sessionManager.getOrCreateSession(userId, effectiveProjectId);
      return ok(c, { sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get session";
      return fail(c, "INTERNAL_ERROR", msg, 500);
    }
  });

  /**
   * GET /api/chat/history
   * Returns paginated message history for the given project's OpenCode session.
   */
  chat.get("/history", zValidator("query", historyQuerySchema), async (c) => {
    const { projectId, limit } = c.req.valid("query");
    const userId = c.get("userId");

    try {
      const sessionId = await sessionManager.getOrCreateSession(userId, projectId);
      const messages = await sessionManager.getMessages(sessionId, { limit });
      return ok(c, { messages, hasMore: messages.length === limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get history";
      return fail(c, "INTERNAL_ERROR", msg, 500);
    }
  });

  return chat;
}
