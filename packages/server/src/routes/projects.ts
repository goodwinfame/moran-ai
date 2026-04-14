/**
 * /api/projects — 项目管理 CRUD
 *
 * GET    /                — 列出所有项目
 * POST   /                — 创建新项目
 * GET    /:id             — 获取项目详情
 * PUT    /:id             — 更新项目
 * DELETE /:id             — 删除项目
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("projects-routes");

/**
 * 项目数据 — 在真实 DB 集成之前使用内存存储
 * M3 阶段的核心目标是 WebUI 功能验证，DB 集成已通过 Drizzle schema 准备就绪。
 */
interface ProjectData {
  id: string;
  title: string;
  genre: string | null;
  subGenre: string | null;
  language: string;
  targetWordCount: number;
  currentChapter: number;
  currentArc: number;
  totalWordCount: number;
  status: string;
  styleId: string | null;
  createdAt: string;
  updatedAt: string;
}

// 内存存储 — 开发/演示用
const projectStore = new Map<string, ProjectData>();

export function createProjectsRoute() {
  const route = new Hono();

  /** GET / — 列出所有项目 */
  route.get("/", (c) => {
    const projects = Array.from(projectStore.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return c.json({ projects, total: projects.length });
  });

  /** POST / — 创建新项目 */
  route.post("/", async (c) => {
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

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project: ProjectData = {
      id,
      title: body.title,
      genre: body.genre ?? null,
      subGenre: body.subGenre ?? null,
      language: "zh-CN",
      targetWordCount: body.targetWordCount ?? 500000,
      currentChapter: 0,
      currentArc: 0,
      totalWordCount: 0,
      status: "planning",
      styleId: body.styleId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    projectStore.set(id, project);
    log.info({ id, title: body.title }, "Project created");

    return c.json(project, 201);
  });

  /** GET /:id — 获取项目详情 */
  route.get("/:id", (c) => {
    const id = c.req.param("id");
    const project = projectStore.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    return c.json(project);
  });

  /** PUT /:id — 更新项目 */
  route.put("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = projectStore.get(id);
    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }

    const body = await c.req.json<Partial<ProjectData>>();
    const updated: ProjectData = {
      ...existing,
      ...body,
      id, // immutable
      createdAt: existing.createdAt, // immutable
      updatedAt: new Date().toISOString(),
    };

    projectStore.set(id, updated);
    log.info({ id }, "Project updated");

    return c.json(updated);
  });

  /** DELETE /:id — 删除项目 */
  route.delete("/:id", (c) => {
    const id = c.req.param("id");
    if (!projectStore.has(id)) {
      return c.json({ error: "Project not found" }, 404);
    }

    projectStore.delete(id);
    log.info({ id }, "Project deleted");

    return c.json({ deleted: true });
  });

  return route;
}
