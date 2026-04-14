/**
 * /api/projects/:id/timeline — 事件时间线数据 (vis-timeline 格式)
 *
 * GET  /        — 获取时间线数据 (items + groups)
 * POST /        — 新增事件
 * PUT  /:eventId — 更新事件
 * DELETE /:eventId — 删除事件
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("timeline-routes");

export interface TimelineEvent {
  id: string;
  projectId: string;
  title: string;
  content: string;
  group: string;
  start: string;
  end: string | null;
  type: "point" | "range" | "box";
  chapterNumber: number | null;
  significance: "major" | "minor" | "turning_point";
  className: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineGroup {
  id: string;
  content: string;
  order: number;
}

// ── In-memory store ─────────────────────────────

const eventStore = new Map<string, TimelineEvent>();

function seedDemoEvents(projectId: string) {
  const now = new Date().toISOString();

  const groups: TimelineGroup[] = [
    { id: "main-plot", content: "主线", order: 1 },
    { id: "character-arc", content: "角色弧", order: 2 },
    { id: "world-events", content: "世界事件", order: 3 },
  ];

  const events: TimelineEvent[] = [
    {
      id: "evt-1", projectId, title: "开篇：少年入山门",
      content: "主角被天剑宗长老发现灵根，收入门下", group: "main-plot",
      start: "2025-01-01", end: null, type: "point", chapterNumber: 1,
      significance: "major", className: "timeline-major",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-2", projectId, title: "外门试炼",
      content: "三年一度的外门弟子晋升试炼", group: "main-plot",
      start: "2025-01-15", end: "2025-01-20", type: "range", chapterNumber: 5,
      significance: "minor", className: "timeline-minor",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-3", projectId, title: "转折：发现秘境",
      content: "主角在试炼中意外发现远古秘境入口", group: "main-plot",
      start: "2025-01-20", end: null, type: "point", chapterNumber: 8,
      significance: "turning_point", className: "timeline-turning-point",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-4", projectId, title: "主角觉醒剑意",
      content: "在秘境中顿悟剑道真意，实力暴涨", group: "character-arc",
      start: "2025-01-25", end: null, type: "point", chapterNumber: 12,
      significance: "major", className: "timeline-major",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-5", projectId, title: "魔族入侵前兆",
      content: "幽冥深渊魔气异动，边境小国受袭", group: "world-events",
      start: "2025-01-10", end: "2025-02-01", type: "range", chapterNumber: 3,
      significance: "minor", className: "timeline-minor",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-6", projectId, title: "师兄叛变",
      content: "大师兄被魔族蛊惑，背叛宗门", group: "character-arc",
      start: "2025-02-05", end: null, type: "point", chapterNumber: 15,
      significance: "turning_point", className: "timeline-turning-point",
      createdAt: now, updatedAt: now,
    },
    {
      id: "evt-7", projectId, title: "宗门大比",
      content: "各大宗门齐聚苍云山，举行五年一度的大比", group: "main-plot",
      start: "2025-02-10", end: "2025-02-20", type: "range", chapterNumber: 18,
      significance: "major", className: "timeline-major",
      createdAt: now, updatedAt: now,
    },
  ];

  // Store groups as metadata on events (vis-timeline consumes groups separately)
  for (const evt of events) {
    eventStore.set(evt.id, evt);
  }

  return groups;
}

// ── Route factory ───────────────────────────────

export function createTimelineRoute() {
  const route = new Hono();

  /** GET / — 时间线数据 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const hasData = Array.from(eventStore.values()).some(
      (e) => e.projectId === projectId,
    );

    let groups: TimelineGroup[];
    if (!hasData) {
      groups = seedDemoEvents(projectId);
    } else {
      // Derive groups from existing events
      const groupSet = new Set<string>();
      for (const evt of eventStore.values()) {
        if (evt.projectId === projectId) groupSet.add(evt.group);
      }
      const groupLabels: Record<string, string> = {
        "main-plot": "主线",
        "character-arc": "角色弧",
        "world-events": "世界事件",
        "sub-plot": "支线",
      };
      groups = Array.from(groupSet).map((g, i) => ({
        id: g,
        content: groupLabels[g] ?? g,
        order: i + 1,
      }));
    }

    const events = Array.from(eventStore.values())
      .filter((e) => e.projectId === projectId)
      .map((e) => ({
        id: e.id,
        content: e.title,
        title: e.content,
        group: e.group,
        start: e.start,
        end: e.end,
        type: e.type,
        className: e.className,
        chapterNumber: e.chapterNumber,
        significance: e.significance,
      }));

    return c.json({ items: events, groups, total: events.length });
  });

  /** POST / — 新增事件 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      title?: string;
      content?: string;
      group?: string;
      start?: string;
      end?: string | null;
      type?: TimelineEvent["type"];
      chapterNumber?: number | null;
      significance?: TimelineEvent["significance"];
    }>();

    if (!body.title) return c.json({ error: "title is required" }, 400);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const event: TimelineEvent = {
      id,
      projectId,
      title: body.title,
      content: body.content ?? "",
      group: body.group ?? "main-plot",
      start: body.start ?? now.split("T")[0] ?? now,
      end: body.end ?? null,
      type: body.type ?? "point",
      chapterNumber: body.chapterNumber ?? null,
      significance: body.significance ?? "minor",
      className: `timeline-${body.significance ?? "minor"}`,
      createdAt: now,
      updatedAt: now,
    };

    eventStore.set(id, event);
    log.info({ id, title: body.title }, "Timeline event created");

    return c.json(event, 201);
  });

  /** PUT /:eventId — 更新事件 */
  route.put("/:eventId", async (c) => {
    const eventId = c.req.param("eventId");
    const existing = eventStore.get(eventId);
    if (!existing) return c.json({ error: "Event not found" }, 404);

    const body = await c.req.json<Partial<TimelineEvent>>();
    const updated: TimelineEvent = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    eventStore.set(eventId, updated);
    log.info({ eventId, title: updated.title }, "Timeline event updated");

    return c.json(updated);
  });

  /** DELETE /:eventId — 删除事件 */
  route.delete("/:eventId", (c) => {
    const eventId = c.req.param("eventId");
    if (!eventStore.has(eventId)) {
      return c.json({ error: "Event not found" }, 404);
    }

    eventStore.delete(eventId);
    log.info({ eventId }, "Timeline event deleted");

    return c.json({ deleted: true });
  });

  return route;
}
