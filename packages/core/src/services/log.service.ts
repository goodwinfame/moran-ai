import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { agentLogs } from "../db/schema/logs.js";
import type { ServiceResult } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AgentLogRecord = typeof agentLogs.$inferSelect;

export interface WriteLogInput {
  projectId: string;
  userId?: string;
  sessionId?: string;
  level: "debug" | "info" | "warn" | "error";
  category: "agent" | "tool" | "auth" | "sse" | "app";
  agentName?: string;
  toolName?: string;
  message: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export type LogEntry = WriteLogInput;

// ── Helpers ────────────────────────────────────────────────────────────────────

function consoleOutput(level: WriteLogInput["level"], message: string, metadata?: Record<string, unknown>): void {
  const payload = metadata ? { message, ...metadata } : message;
  switch (level) {
    case "debug":
    case "info":
      console.info(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    case "error":
      console.error(payload);
      break;
  }
}

// ── Service Methods ────────────────────────────────────────────────────────────

/**
 * Write a log entry. Console output always happens.
 * DB insert is skipped for category="app" or level="debug".
 * Never throws — errors are caught and logged to console.error.
 */
export async function writeLog(entry: WriteLogInput): Promise<void> {
  try {
    consoleOutput(entry.level, entry.message, entry.metadata);

    const skipDb = entry.category === "app" || entry.level === "debug";
    if (skipDb) return;

    const db = getDb();
    await db.insert(agentLogs).values({
      projectId: entry.projectId,
      userId: entry.userId,
      sessionId: entry.sessionId,
      level: entry.level,
      category: entry.category,
      agentName: entry.agentName,
      toolName: entry.toolName,
      message: entry.message,
      durationMs: entry.durationMs,
      metadata: entry.metadata,
    });
  } catch (err) {
    console.error("Failed to write log:", err);
  }
}

/**
 * Query agent logs for a project with optional filters and pagination.
 */
export async function query(params: {
  projectId: string;
  category?: string;
  level?: string;
  limit?: number;
  offset?: number;
}): Promise<ServiceResult<{ logs: AgentLogRecord[]; total: number; hasMore: boolean }>> {
  const db = getDb();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const conditions = [eq(agentLogs.projectId, params.projectId)];
  if (params.category) conditions.push(eq(agentLogs.category, params.category));
  if (params.level) conditions.push(eq(agentLogs.level, params.level));
  const whereClause = and(...conditions);

  // ── Count ──────────────────────────────────────────────────────────────────
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentLogs)
    .where(whereClause);

  const total = countRow?.count ?? 0;

  // ── Records ────────────────────────────────────────────────────────────────
  const logs = await db
    .select()
    .from(agentLogs)
    .where(whereClause)
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const hasMore = offset + limit < total;

  return { ok: true, data: { logs, total, hasMore } };
}

/**
 * Delete agent logs older than retentionDays.
 * Returns count of deleted rows.
 */
export async function cleanup(retentionDays: number): Promise<ServiceResult<{ deleted: number }>> {
  const db = getDb();

  const cutoff = sql`now() - interval '1 day' * ${retentionDays}`;

  const deleted = await db
    .delete(agentLogs)
    .where(lt(agentLogs.createdAt, cutoff))
    .returning({ id: agentLogs.id });

  return { ok: true, data: { deleted: deleted.length } };
}
