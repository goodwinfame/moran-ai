/**
 * Chat API routes — OpenCode proxy layer
 *
 * POST /send    — Send user message to OpenCode session (fire-and-forget)
 * GET  /events  — SSE event stream skeleton (full impl in Phase 4.2)
 * GET  /history — Fetch message history from OpenCode session
 *
 * All routes require authentication (mounted after requireAuth in app.ts).
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionManager } from "../opencode/manager.js";
import { ok, fail } from "../utils/response.js";

/** Type for userId injected by requireAuth middleware */
type Variables = { userId: string };

// ── Zod schemas ────────────────────────────────────────────────────────────

const sendBodySchema = z.object({
  projectId: z.string(),
  message: z.string(),
  attachments: z.array(z.string()).optional(),
});

const eventsQuerySchema = z.object({
  sessionId: z.string(),
  lastEventId: z.string().optional(),
});

const historyQuerySchema = z.object({
  projectId: z.string(),
  limit: z.coerce.number().int().positive().default(50),
  before: z.string().optional(),
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
    const { projectId, message } = c.req.valid("json");
    const userId = c.get("userId");

    try {
      const sessionId = await sessionManager.getOrCreateSession(userId, projectId);
      const result = await sessionManager.sendMessage(sessionId, message);
      return ok(c, { messageId: result.messageId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      return fail(c, "INTERNAL_ERROR", msg, 500);
    }
  });

  /**
   * GET /api/chat/events
   * SSE skeleton — streams OpenCode events filtered to the given sessionId.
   * Full implementation (reconnection, lastEventId) will land in Phase 4.2.
   */
  chat.get("/events", zValidator("query", eventsQuerySchema), (c) => {
    const { sessionId } = c.req.valid("query");
    const { stream, close } = sessionManager.subscribeEvents(sessionId);

    const encoder = new TextEncoder();
    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
          }
          controller.close();
        } catch {
          // Stream aborted or connection dropped — close gracefully
          controller.close();
        } finally {
          reader.releaseLock();
          close();
        }
      },
      cancel() {
        close();
      },
    });

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    return c.body(sseStream);
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
