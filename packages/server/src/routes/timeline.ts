/**
 * /api/projects/:id/timeline — 事件时间线数据 (vis-timeline 格式)
 *
 * GET  /        — 获取时间线数据 (items + groups)
 * POST /        — 新增事件
 * PUT  /:eventId — 更新事件
 * DELETE /:eventId — 删除事件
 */

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { timelineEvents } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("timeline-routes");

type DbSignificance = "minor" | "moderate" | "major" | "critical";
type ResponseSignificance = "major" | "minor" | "turning_point";

type TimelineGroup = {
  id: string;
  content: string;
  order: number;
};

type TimelineItem = {
  id: string;
  content: string;
  title: string;
  group: string;
  start: string;
  end: string | null;
  type: "point" | "range" | "box";
  className: string;
  chapterNumber: number | null;
  significance: ResponseSignificance;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_GROUPS: TimelineGroup[] = [
  { id: "main-plot", content: "主线", order: 1 },
  { id: "character-arc", content: "角色弧", order: 2 },
  { id: "world-events", content: "世界事件", order: 3 },
];

const GROUP_BY_SIGNIFICANCE: Record<DbSignificance, string> = {
  minor: "world-events",
  moderate: "character-arc",
  major: "main-plot",
  critical: "main-plot",
};

function toDbSignificance(value: string | undefined): DbSignificance {
  if (value === "minor" || value === "moderate" || value === "major" || value === "critical") return value;
  if (value === "turning_point") return "critical";
  return "minor";
}

function toResponseSignificance(value: DbSignificance): ResponseSignificance {
  if (value === "minor") return "minor";
  if (value === "critical") return "turning_point";
  return "major";
}

function buildDescription(title?: string, content?: string): string {
  const t = title?.trim() ?? "";
  const c = content?.trim() ?? "";

  if (t && c) return `${t}\n\n${c}`;
  return t || c;
}

function parseDescription(description: string): { title: string; content: string } {
  const split = description.indexOf("\n\n");

  if (split === -1) {
    return { title: description, content: "" };
  }

  return {
    title: description.slice(0, split),
    content: description.slice(split + 2),
  };
}

function toTimelineItem(row: typeof timelineEvents.$inferSelect): TimelineItem {
  const parsed = parseDescription(row.description);
  const significance = toResponseSignificance(row.significance as DbSignificance);

  return {
    id: row.id,
    content: parsed.title,
    title: parsed.content,
    group: GROUP_BY_SIGNIFICANCE[row.significance as DbSignificance],
    start: row.storyTimestamp ?? "",
    end: null,
    type: "point",
    className: `timeline-${significance}`,
    chapterNumber: row.chapterNumber,
    significance,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    updatedAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

export function createTimelineRoute() {
  const route = new Hono();

  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();
    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.projectId, projectId));

    const items = rows.map(toTimelineItem);
    const groupIds = new Set(items.map((item) => item.group));
    const groups = items.length === 0 ? DEFAULT_GROUPS : DEFAULT_GROUPS.filter((group) => groupIds.has(group.id));

    return c.json({ items, groups, total: items.length });
  });

  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      title?: string;
      content?: string;
      group?: string;
      start?: string;
      end?: string | null;
      type?: "point" | "range" | "box";
      chapterNumber?: number | null;
      significance?: ResponseSignificance | DbSignificance;
      className?: string;
    }>();

    if (!body.title && !body.content) return c.json({ error: "title is required" }, 400);

    const db = getDb();
    const [row] = await db
      .insert(timelineEvents)
      .values({
        projectId,
        chapterNumber: body.chapterNumber ?? null,
        storyTimestamp: body.start ?? new Date().toISOString(),
        description: buildDescription(body.title, body.content),
        characterIds: [],
        locationId: null,
        significance: toDbSignificance(body.significance),
      })
      .returning();

    if (!row) return c.json({ error: "Failed to create event" }, 500);
    const event = toTimelineItem(row);
    log.info({ id: event.id, title: event.content }, "Timeline event created");

    return c.json(
      {
        ...event,
        group: body.group ?? event.group,
        end: body.end ?? null,
        type: body.type ?? "point",
        className: body.className ?? event.className,
      },
      201,
    );
  });

  route.put("/:eventId", async (c) => {
    const projectId = c.req.param("id");
    const eventId = c.req.param("eventId");
    if (!projectId || !eventId) return c.json({ error: "Missing parameters" }, 400);

    const body = await c.req.json<{
      title?: string;
      content?: string;
      group?: string;
      start?: string;
      end?: string | null;
      type?: "point" | "range" | "box";
      chapterNumber?: number | null;
      significance?: ResponseSignificance | DbSignificance;
      className?: string;
    }>();

    const db = getDb();
    const [existing] = await db
      .select()
      .from(timelineEvents)
      .where(and(eq(timelineEvents.id, eventId), eq(timelineEvents.projectId, projectId)));

    if (!existing) return c.json({ error: "Event not found" }, 404);

    const existingParsed = parseDescription(existing.description);
    const [row] = await db
      .update(timelineEvents)
      .set({
        chapterNumber: body.chapterNumber ?? existing.chapterNumber,
        storyTimestamp: body.start ?? existing.storyTimestamp,
        description: buildDescription(body.title ?? existingParsed.title, body.content ?? existingParsed.content),
        significance: body.significance ? toDbSignificance(body.significance) : existing.significance,
      })
      .where(and(eq(timelineEvents.id, eventId), eq(timelineEvents.projectId, projectId)))
      .returning();

    if (!row) return c.json({ error: "Failed to update event" }, 500);
    const updated = toTimelineItem(row);
    log.info({ eventId, title: updated.content }, "Timeline event updated");

    return c.json({
      ...updated,
      group: body.group ?? updated.group,
      end: body.end ?? null,
      type: body.type ?? "point",
      className: body.className ?? updated.className,
    });
  });

  route.delete("/:eventId", async (c) => {
    const projectId = c.req.param("id");
    const eventId = c.req.param("eventId");
    if (!projectId || !eventId) return c.json({ error: "Missing parameters" }, 400);

    const db = getDb();

    const result = await db
      .delete(timelineEvents)
      .where(and(eq(timelineEvents.id, eventId), eq(timelineEvents.projectId, projectId)))
      .returning({ id: timelineEvents.id });

    if (result.length === 0) return c.json({ error: "Event not found" }, 404);

    log.info({ eventId }, "Timeline event deleted");
    return c.json({ deleted: true });
  });

  return route;
}
