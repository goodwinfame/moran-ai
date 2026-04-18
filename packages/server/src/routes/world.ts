/**
 * /api/projects/:id/world — 世界观设定 CRUD
 *
 * GET    /                — 列出所有子系统/设定
 * POST   /                — 新增子系统/设定
 * GET    /:settingId      — 获取单条设定详情
 * PUT    /:settingId      — 更新设定
 * DELETE /:settingId      — 删除设定
 */

import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { SessionProjectBridge, JiangxinEngine } from "@moran/core";
import { getDb } from "@moran/core/db";
import { worldSettings } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";
import type { WorldDesignInput } from "@moran/core";

const log = createLogger("world-routes");

export function createWorldRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine) {
  const route = new Hono();

  /** GET / — 列出项目的所有世界设定 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const db = getDb();
    const settings = await db
      .select()
      .from(worldSettings)
      .where(eq(worldSettings.projectId, projectId))
      .orderBy(asc(worldSettings.sortOrder));

    return c.json({ settings, total: settings.length });
  });

  /** POST /align — 世界观对齐 */
  route.post("/align", async (c) => {
    try {
      const projectId = c.req.param("id");
      if (!projectId) {
        return c.json({ error: "Missing project ID" }, 400);
      }

      const body = await c.req.json<{
        briefSummary: string;
        requirements?: string;
        referenceKnowledge?: string[];
      }>();

      if (!body.briefSummary) {
        return c.json({ error: "briefSummary is required" }, 400);
      }

      const input: WorldDesignInput = {
        projectId,
        briefSummary: body.briefSummary,
        requirements: body.requirements,
        referenceKnowledge: body.referenceKnowledge,
      };

      await bridge.ensureSession(projectId);
      const result = await jiangxinEngine.designWorld(input, bridge);
      return c.json({ reply: result.overview, data: result });
    } catch (error) {
      log.error({ error }, "World alignment failed");
      return c.json({ error: "World alignment failed" }, 500);
    }
  });

  /** POST / — 新增设定 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<{
      section: string;
      name: string;
      content: string;
      sortOrder?: number;
    }>();

    if (!body.section || !body.name || !body.content) {
      return c.json({ error: "section, name, and content are required" }, 400);
    }

    const db = getDb();
    const [setting] = await db
      .insert(worldSettings)
      .values({
        projectId,
        section: body.section,
        name: body.name,
        content: body.content,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();

    log.info({ id: setting?.id, section: body.section, name: body.name }, "World setting created");

    return c.json(setting, 201);
  });

  /** GET /:settingId — 获取单条设定 */
  route.get("/:settingId", async (c) => {
    const settingId = c.req.param("settingId");
    const db = getDb();
    const [setting] = await db
      .select()
      .from(worldSettings)
      .where(eq(worldSettings.id, settingId));

    if (!setting) {
      return c.json({ error: "World setting not found" }, 404);
    }

    return c.json(setting);
  });

  /** PUT /:settingId — 更新设定 */
  route.put("/:settingId", async (c) => {
    const settingId = c.req.param("settingId");
    const db = getDb();
    const [existing] = await db
      .select({ id: worldSettings.id })
      .from(worldSettings)
      .where(eq(worldSettings.id, settingId));

    if (!existing) {
      return c.json({ error: "World setting not found" }, 404);
    }

    const body = await c.req.json<{
      section?: string;
      name?: string;
      content?: string;
      sortOrder?: number;
    }>();

    const [updated] = await db
      .update(worldSettings)
      .set({
        ...(body.section !== undefined && { section: body.section }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(worldSettings.id, settingId))
      .returning();

    log.info({ settingId }, "World setting updated");

    return c.json(updated);
  });

  /** DELETE /:settingId — 删除设定 */
  route.delete("/:settingId", async (c) => {
    const settingId = c.req.param("settingId");
    const db = getDb();
    const result = await db
      .delete(worldSettings)
      .where(eq(worldSettings.id, settingId))
      .returning({ id: worldSettings.id });

    if (result.length === 0) {
      return c.json({ error: "World setting not found" }, 404);
    }

    log.info({ settingId }, "World setting deleted");

    return c.json({ deleted: true });
  });

  return route;
}
