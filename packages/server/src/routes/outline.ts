/**
 * /api/projects/:id/outline — 大纲管理 CRUD
 *
 * GET    /                — 获取项目大纲（含弧段和章节计划）
 * PUT    /                — 更新大纲元信息（梗概/结构类型/主题）
 * GET    /arcs            — 列出弧段
 * POST   /arcs            — 新增弧段
 * PUT    /arcs/:arcIndex  — 更新弧段
 * DELETE /arcs/:arcIndex  — 删除弧段
 */

import { Hono } from "hono";
import { eq, and, asc, max } from "drizzle-orm";
import type { SessionProjectBridge, StructurePlanInput } from "@moran/core";
import { JiangxinEngine } from "@moran/core";
import { getDb } from "@moran/core/db";
import { outlines, arcs } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("outline-routes");

export function createOutlineRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine) {
  const route = new Hono();

  /** POST /align — 规划弧段 */
  route.post("/align", async (c) => {
    try {
      const projectId = c.req.param("id");
      if (!projectId) return c.json({ error: "Missing project ID" }, 400);

      const body = await c.req.json<{
        briefSummary: string;
        worldOverview: string;
        charactersSummary: string;
        arcNumber: number;
        previousArcsSummary?: string;
        requirements?: string;
        referenceKnowledge?: string[];
      }>();

      if (!body.briefSummary || !body.worldOverview || !body.charactersSummary || body.arcNumber === undefined) {
        return c.json({ error: "briefSummary, worldOverview, charactersSummary, and arcNumber are required" }, 400);
      }

      const input: StructurePlanInput = {
        projectId,
        briefSummary: body.briefSummary,
        worldOverview: body.worldOverview,
        charactersSummary: body.charactersSummary,
        arcNumber: body.arcNumber,
        previousArcsSummary: body.previousArcsSummary,
        requirements: body.requirements,
        referenceKnowledge: body.referenceKnowledge,
      };

      await bridge.ensureSession(projectId);
      const result = await jiangxinEngine.planStructure(input, bridge);

      return c.json({
        reply: `规划了弧段 ${result.arcPlan.name}，共 ${result.arcPlan.chapterCount} 章`,
        data: result,
      });
    } catch (error) {
      log.error({ error }, "Failed to align outline");
      return c.json({ error: "Failed to align outline" }, 500);
    }
  });

  /** GET / — 获取项目大纲 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();

    const [outline] = await db.select().from(outlines).where(eq(outlines.projectId, projectId));
    const arcRows = await db
      .select()
      .from(arcs)
      .where(eq(arcs.projectId, projectId))
      .orderBy(asc(arcs.arcIndex));

    return c.json({ outline: outline ?? null, arcs: arcRows, totalArcs: arcRows.length });
  });

  /** PUT / — 更新大纲元信息 */
  route.put("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();
    const body = await c.req.json<{
      synopsis?: string;
      structureType?: string;
      themes?: string[];
    }>();

    const [existing] = await db
      .select({ id: outlines.id })
      .from(outlines)
      .where(eq(outlines.projectId, projectId));

    let outlineRow;
    if (existing) {
      [outlineRow] = await db
        .update(outlines)
        .set({
          ...(body.synopsis !== undefined && { synopsis: body.synopsis }),
          ...(body.structureType !== undefined && { structureType: body.structureType }),
          ...(body.themes !== undefined && { themes: body.themes }),
        })
        .where(eq(outlines.projectId, projectId))
        .returning();
    } else {
      [outlineRow] = await db
        .insert(outlines)
        .values({
          projectId,
          synopsis: body.synopsis ?? "",
          structureType: body.structureType ?? "",
          themes: body.themes ?? [],
        })
        .returning();
    }

    log.info({ projectId }, "Outline updated");

    return c.json(outlineRow);
  });

  /** GET /arcs — 列出弧段 */
  route.get("/arcs", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();

    const arcRows = await db
      .select()
      .from(arcs)
      .where(eq(arcs.projectId, projectId))
      .orderBy(asc(arcs.arcIndex));

    return c.json({ arcs: arcRows, total: arcRows.length });
  });

  /** POST /arcs — 新增弧段 */
  route.post("/arcs", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();

    const body = await c.req.json<{
      title: string;
      description?: string;
      startChapter?: number;
      endChapter?: number;
      detailedPlan?: string;
    }>();

    if (!body.title) return c.json({ error: "title is required" }, 400);

    const [result] = await db
      .select({ maxIdx: max(arcs.arcIndex) })
      .from(arcs)
      .where(eq(arcs.projectId, projectId));
    const arcIndex = (result?.maxIdx ?? 0) + 1;

    const [arcRow] = await db
      .insert(arcs)
      .values({
        projectId,
        arcIndex,
        title: body.title,
        description: body.description ?? "",
        startChapter: body.startChapter ?? 0,
        endChapter: body.endChapter ?? 0,
        detailedPlan: body.detailedPlan ?? "",
      })
      .returning();

    log.info({ projectId, arcIndex, title: body.title }, "Arc created");

    return c.json(arcRow, 201);
  });

  /** PUT /arcs/:arcIndex — 更新弧段 */
  route.put("/arcs/:arcIndex", async (c) => {
    const projectId = c.req.param("id");
    const arcIndex = parseInt(c.req.param("arcIndex"), 10);

    if (!projectId || isNaN(arcIndex)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();

    const [existing] = await db
      .select({ id: arcs.id })
      .from(arcs)
      .where(and(eq(arcs.projectId, projectId), eq(arcs.arcIndex, arcIndex)));

    if (!existing) return c.json({ error: "Arc not found" }, 404);

    const body = await c.req.json<{
      title?: string;
      description?: string;
      startChapter?: number;
      endChapter?: number;
      detailedPlan?: string;
    }>();

    const [updated] = await db
      .update(arcs)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.startChapter !== undefined && { startChapter: body.startChapter }),
        ...(body.endChapter !== undefined && { endChapter: body.endChapter }),
        ...(body.detailedPlan !== undefined && { detailedPlan: body.detailedPlan }),
      })
      .where(and(eq(arcs.projectId, projectId), eq(arcs.arcIndex, arcIndex)))
      .returning();

    log.info({ projectId, arcIndex }, "Arc updated");

    return c.json(updated);
  });

  /** DELETE /arcs/:arcIndex — 删除弧段 */
  route.delete("/arcs/:arcIndex", async (c) => {
    const projectId = c.req.param("id");
    const arcIndex = parseInt(c.req.param("arcIndex"), 10);

    if (!projectId || isNaN(arcIndex)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();

    const result = await db
      .delete(arcs)
      .where(and(eq(arcs.projectId, projectId), eq(arcs.arcIndex, arcIndex)))
      .returning({ id: arcs.id });

    if (result.length === 0) {
      return c.json({ error: "Arc not found" }, 404);
    }

    log.info({ projectId, arcIndex }, "Arc deleted");

    return c.json({ deleted: true });
  });

  return route;
}
