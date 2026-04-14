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
import { createLogger } from "@moran/core/logger";

const log = createLogger("outline-routes");

/**
 * 大纲核心 — 对应 §6 outlines 表
 */
export interface OutlineData {
  id: string;
  projectId: string;
  synopsis: string;
  structureType: string;
  themes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 弧段 — 对应 §6 arcs 表
 */
export interface ArcData {
  id: string;
  projectId: string;
  arcIndex: number;
  title: string;
  description: string;
  startChapter: number;
  endChapter: number;
  detailedPlan: string;
  createdAt: string;
  updatedAt: string;
}

// 内存存储
const outlineStore = new Map<string, OutlineData>();
const arcStore = new Map<string, ArcData>();

function arcKey(projectId: string, arcIndex: number) {
  return `${projectId}:arc:${arcIndex}`;
}

function seedDemoOutline(projectId: string): void {
  const now = new Date().toISOString();

  outlineStore.set(projectId, {
    id: `${projectId}-outline`,
    projectId,
    synopsis:
      "沈墨尘，沈家嫡子，幼时被测出杂灵根，沦为家族笑柄。十六岁那年，一次意外解封了被母亲封印的真正灵根——混沌灵根。从此踏上逆天改命之路，一步步揭开父亲失踪的真相、家族覆灭的阴谋，以及修仙界最大的秘密。\n\n这不仅是一个废柴逆袭的故事，更是一个关于选择、牺牲和成长的修仙叙事。主角不靠金手指碾压，而是在不断的挫折中锤炼心性，用智慧和决心走出自己的道。",
    structureType: "four-act",
    themes: ["逆天改命", "家族复兴", "成长与牺牲", "信任与背叛"],
    createdAt: now,
    updatedAt: now,
  });

  const arcs: Array<Omit<ArcData, "id" | "projectId" | "createdAt" | "updatedAt">> = [
    {
      arcIndex: 1,
      title: "废物觉醒",
      description:
        "沈墨尘在沈家受尽冷眼，却意外解封灵根。拜入天一宗后展露锋芒，但也引起了大长老陆九渊的注意。",
      startChapter: 1,
      endChapter: 30,
      detailedPlan:
        "### 爆点设计\n\n1. **Ch5 灵根解封**：在家族试炼中生死危机触发灵根解封\n2. **Ch15 宗门大比**：以弱胜强，击败核心弟子\n3. **Ch28 弧段高潮**：发现母亲留下的秘密信件，揭示父亲失踪与陆九渊有关\n\n### 伏笔埋设\n\n- 玉镯中的神秘意识（Ch3）\n- 北冥异动的传闻（Ch10）\n- 陆九渊对沈家旧事的暧昧态度（Ch20）",
    },
    {
      arcIndex: 2,
      title: "秘境历练",
      description:
        "沈墨尘进入上古秘境寻找父亲的线索，结识凌霜，面对重重危机。秘境中的发现彻底改变了他对修仙界的认知。",
      startChapter: 31,
      endChapter: 60,
      detailedPlan:
        "### 爆点设计\n\n1. **Ch35 凌霜登场**：冰宫弟子在秘境中被围攻，沈墨尘出手相救\n2. **Ch45 远古真相**：发现上古文明遗迹，揭示灵根体系的本质\n3. **Ch58 弧段高潮**：与秘境守关BOSS决战，混沌灵根进阶\n\n### 伏笔回收\n\n- 玉镯意识觉醒（回收 Ch3 伏笔）\n\n### 新伏笔\n\n- 上古文明覆灭的原因\n- 凌霜身世之谜的第一条线索",
    },
    {
      arcIndex: 3,
      title: "宗门暗流",
      description:
        "回到天一宗后，沈墨尘发现陆九渊的阴谋已经深入宗门核心。联合志同道合的人准备反击，但陆九渊先发制人。",
      startChapter: 61,
      endChapter: 100,
      detailedPlan:
        "### 核心矛盾\n\n沈墨尘 vs 陆九渊的正面对抗。不是单纯的武力较量，而是智谋、人心、势力的全面博弈。\n\n### 爆点设计\n\n1. **Ch70 阴谋曝光**：沈墨尘取得陆九渊勾结魔修的证据\n2. **Ch85 背叛**：可信赖的同伴意外倒戈\n3. **Ch98 弧段高潮**：宗门大战，赵小虎身受重伤",
    },
  ];

  for (const arc of arcs) {
    const key = arcKey(projectId, arc.arcIndex);
    arcStore.set(key, {
      ...arc,
      id: `${projectId}-arc-${arc.arcIndex}`,
      projectId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function createOutlineRoute() {
  const route = new Hono();

  /** GET / — 获取项目大纲 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    if (!outlineStore.has(projectId)) {
      seedDemoOutline(projectId);
    }

    const outline = outlineStore.get(projectId);
    const arcs = Array.from(arcStore.values())
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => a.arcIndex - b.arcIndex);

    return c.json({ outline: outline ?? null, arcs, totalArcs: arcs.length });
  });

  /** PUT / — 更新大纲元信息 */
  route.put("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    if (!outlineStore.has(projectId)) {
      seedDemoOutline(projectId);
    }

    const existing = outlineStore.get(projectId);
    if (!existing) return c.json({ error: "Outline not found" }, 404);

    const body = await c.req.json<Partial<OutlineData>>();
    const updated: OutlineData = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    outlineStore.set(projectId, updated);
    log.info({ projectId }, "Outline updated");

    return c.json(updated);
  });

  /** GET /arcs — 列出弧段 */
  route.get("/arcs", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    if (!outlineStore.has(projectId)) {
      seedDemoOutline(projectId);
    }

    const arcs = Array.from(arcStore.values())
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => a.arcIndex - b.arcIndex);

    return c.json({ arcs, total: arcs.length });
  });

  /** POST /arcs — 新增弧段 */
  route.post("/arcs", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      title: string;
      description?: string;
      startChapter?: number;
      endChapter?: number;
      detailedPlan?: string;
    }>();

    if (!body.title) return c.json({ error: "title is required" }, 400);

    // Find the next arc index
    const existingArcs = Array.from(arcStore.values()).filter(
      (a) => a.projectId === projectId,
    );
    const maxIndex = existingArcs.reduce((max, a) => Math.max(max, a.arcIndex), 0);
    const arcIndex = maxIndex + 1;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const arc: ArcData = {
      id,
      projectId,
      arcIndex,
      title: body.title,
      description: body.description ?? "",
      startChapter: body.startChapter ?? 0,
      endChapter: body.endChapter ?? 0,
      detailedPlan: body.detailedPlan ?? "",
      createdAt: now,
      updatedAt: now,
    };

    arcStore.set(arcKey(projectId, arcIndex), arc);
    log.info({ projectId, arcIndex, title: body.title }, "Arc created");

    return c.json(arc, 201);
  });

  /** PUT /arcs/:arcIndex — 更新弧段 */
  route.put("/arcs/:arcIndex", async (c) => {
    const projectId = c.req.param("id");
    const arcIndex = parseInt(c.req.param("arcIndex"), 10);

    if (!projectId || isNaN(arcIndex)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const key = arcKey(projectId, arcIndex);
    const existing = arcStore.get(key);
    if (!existing) return c.json({ error: "Arc not found" }, 404);

    const body = await c.req.json<Partial<ArcData>>();
    const updated: ArcData = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      arcIndex: existing.arcIndex,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    arcStore.set(key, updated);
    log.info({ projectId, arcIndex }, "Arc updated");

    return c.json(updated);
  });

  /** DELETE /arcs/:arcIndex — 删除弧段 */
  route.delete("/arcs/:arcIndex", (c) => {
    const projectId = c.req.param("id");
    const arcIndex = parseInt(c.req.param("arcIndex"), 10);

    if (!projectId || isNaN(arcIndex)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const key = arcKey(projectId, arcIndex);
    if (!arcStore.has(key)) {
      return c.json({ error: "Arc not found" }, 404);
    }

    arcStore.delete(key);
    log.info({ projectId, arcIndex }, "Arc deleted");

    return c.json({ deleted: true });
  });

  return route;
}
