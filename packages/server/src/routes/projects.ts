/**
 * /api/projects — 项目管理 CRUD
 *
 * GET    /                — 列出当前用户的所有项目
 * POST   /                — 创建新项目
 * GET    /:id             — 获取项目详情
 * PUT    /:id             — 更新项目
 * DELETE /:id             — 删除项目
 */

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { projects } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("projects-routes");

/** 从请求头提取 userId，fallback "local" */
function getUserId(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("x-user-id") ?? "local";
}

export function createProjectsRoute() {
  const route = new Hono();

  /** GET / — 列出当前用户的所有项目 */
  route.get("/", async (c) => {
    const userId = getUserId(c);
    const db = getDb();

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));

    return c.json({ projects: rows, total: rows.length });
  });

  /** POST / — 创建新项目 */
  route.post("/", async (c) => {
    const userId = getUserId(c);
    const body = await c.req.json<{
      title: string;
      genre?: string;
      subGenre?: string;
      targetWordCount?: number;
      styleId?: string;
    }>();

    if (!body.title) {
      return c.json({ error: "title is required" }, 400);
    }

    const db = getDb();
    const [project] = await db
      .insert(projects)
      .values({
        title: body.title,
        genre: body.genre ?? null,
        subGenre: body.subGenre ?? null,
        targetWordCount: body.targetWordCount ?? 500000,
        styleId: body.styleId ?? null,
        userId,
      })
      .returning();

    log.info({ id: project?.id, title: body.title }, "Project created");

    return c.json(project, 201);
  });

  /** GET /:id — 获取项目详情 */
  route.get("/:id", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");
    const db = getDb();

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(project);
  });

  /** PUT /:id — 更新项目 */
  route.put("/:id", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");
    const db = getDb();

    // 验证项目属于当前用户
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }

    const body = await c.req.json<{
      title?: string;
      genre?: string | null;
      subGenre?: string | null;
      targetWordCount?: number;
      status?: string;
      styleId?: string | null;
      currentChapter?: number;
      currentArc?: number;
      totalWordCount?: number;
    }>();

    const [updated] = await db
      .update(projects)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.genre !== undefined && { genre: body.genre }),
        ...(body.subGenre !== undefined && { subGenre: body.subGenre }),
        ...(body.targetWordCount !== undefined && { targetWordCount: body.targetWordCount }),
        ...(body.styleId !== undefined && { styleId: body.styleId }),
        ...(body.currentChapter !== undefined && { currentChapter: body.currentChapter }),
        ...(body.currentArc !== undefined && { currentArc: body.currentArc }),
        ...(body.totalWordCount !== undefined && { totalWordCount: body.totalWordCount }),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    log.info({ id }, "Project updated");

    return c.json(updated);
  });

  /** DELETE /:id — 删除项目 */
  route.delete("/:id", async (c) => {
    const userId = getUserId(c);
    const id = c.req.param("id");
    const db = getDb();

    const result = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning({ id: projects.id });

    if (result.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    log.info({ id }, "Project deleted");

    return c.json({ deleted: true });
  });

  return route;
}
