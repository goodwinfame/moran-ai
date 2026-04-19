import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { timelineEvents } from "../db/schema/outline.js";
import type { ServiceResult } from "./types.js";

type TimelineEvent = typeof timelineEvents.$inferSelect;
type NewTimelineEvent = typeof timelineEvents.$inferInsert;

export async function create(
  projectId: string,
  data: Omit<NewTimelineEvent, "id" | "projectId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(timelineEvents)
    .values({ projectId, ...data })
    .returning({ id: timelineEvents.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "时间线事件创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<TimelineEvent>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(timelineEvents)
    .where(and(eq(timelineEvents.id, id), eq(timelineEvents.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "时间线事件不存在" } };
  return { ok: true, data: row };
}

export async function list(
  projectId: string,
  chapterNumber?: number,
): Promise<ServiceResult<TimelineEvent[]>> {
  const db = getDb();
  const conditions = [eq(timelineEvents.projectId, projectId)];
  if (chapterNumber !== undefined) {
    conditions.push(eq(timelineEvents.chapterNumber, chapterNumber));
  }
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(and(...conditions))
    .orderBy(timelineEvents.createdAt);
  return { ok: true, data: rows };
}
