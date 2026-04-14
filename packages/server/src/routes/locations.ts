/**
 * /api/projects/:id/locations — 地点数据 (层级树 + 可视化)
 *
 * GET  /       — 层级树数据 (D3.js 格式)
 * POST /       — 新增地点
 * PUT  /:locId — 更新地点
 * DELETE /:locId — 删除地点
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("locations-routes");

export interface LocationData {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  type: "realm" | "region" | "city" | "area" | "building" | "custom";
  description: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface LocationTreeNode {
  id: string;
  name: string;
  type: LocationData["type"];
  description: string;
  children: LocationTreeNode[];
}

// ── In-memory store ─────────────────────────────

const locationStore = new Map<string, LocationData>();

function seedDemoLocations(projectId: string) {
  const now = new Date().toISOString();
  const locs: LocationData[] = [
    {
      id: "loc-1", projectId, name: "天玄大陆", parentId: null,
      type: "realm", description: "故事发生的主要大陆，灵气充沛",
      attributes: { climate: "四季分明" }, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-2", projectId, name: "苍云山脉", parentId: "loc-1",
      type: "region", description: "大陆中部的绵延山脉",
      attributes: { elevation: "极高" }, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-3", projectId, name: "天剑宗", parentId: "loc-2",
      type: "area", description: "主角所属门派，位于苍云山主峰",
      attributes: { faction: "正道" }, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-4", projectId, name: "剑意殿", parentId: "loc-3",
      type: "building", description: "宗门核心建筑，存放历代剑意传承",
      attributes: {}, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-5", projectId, name: "藏经阁", parentId: "loc-3",
      type: "building", description: "存放功法与秘术",
      attributes: {}, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-6", projectId, name: "东海域", parentId: "loc-1",
      type: "region", description: "大陆东部的广阔海域",
      attributes: { terrain: "海洋" }, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-7", projectId, name: "龙渊城", parentId: "loc-6",
      type: "city", description: "东海最大的港口城市",
      attributes: { population: "百万" }, createdAt: now, updatedAt: now,
    },
    {
      id: "loc-8", projectId, name: "幽冥深渊", parentId: "loc-1",
      type: "region", description: "大陆南端的禁地，魔气弥漫",
      attributes: { danger: "极高" }, createdAt: now, updatedAt: now,
    },
  ];

  for (const loc of locs) {
    locationStore.set(loc.id, loc);
  }
}

function buildTree(locations: LocationData[]): LocationTreeNode[] {
  const byId = new Map<string, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];

  for (const loc of locations) {
    byId.set(loc.id, {
      id: loc.id,
      name: loc.name,
      type: loc.type,
      description: loc.description,
      children: [],
    });
  }

  for (const loc of locations) {
    const node = byId.get(loc.id);
    if (!node) continue;

    if (loc.parentId) {
      const parent = byId.get(loc.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Route factory ───────────────────────────────

export function createLocationsRoute() {
  const route = new Hono();

  /** GET / — 层级树数据 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const hasData = Array.from(locationStore.values()).some(
      (l) => l.projectId === projectId,
    );
    if (!hasData) seedDemoLocations(projectId);

    const locations = Array.from(locationStore.values()).filter(
      (l) => l.projectId === projectId,
    );

    const tree = buildTree(locations);
    const flat = locations.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.parentId,
      type: l.type,
      description: l.description,
      attributes: l.attributes,
    }));

    return c.json({ tree, flat, total: locations.length });
  });

  /** POST / — 新增地点 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      name?: string;
      parentId?: string | null;
      type?: LocationData["type"];
      description?: string;
      attributes?: Record<string, string>;
    }>();

    if (!body.name) return c.json({ error: "name is required" }, 400);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const location: LocationData = {
      id,
      projectId,
      name: body.name,
      parentId: body.parentId ?? null,
      type: body.type ?? "custom",
      description: body.description ?? "",
      attributes: body.attributes ?? {},
      createdAt: now,
      updatedAt: now,
    };

    locationStore.set(id, location);
    log.info({ id, name: body.name }, "Location created");

    return c.json(location, 201);
  });

  /** PUT /:locId — 更新地点 */
  route.put("/:locId", async (c) => {
    const locId = c.req.param("locId");
    const existing = locationStore.get(locId);
    if (!existing) return c.json({ error: "Location not found" }, 404);

    const body = await c.req.json<Partial<LocationData>>();
    const updated: LocationData = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    locationStore.set(locId, updated);
    log.info({ locId, name: updated.name }, "Location updated");

    return c.json(updated);
  });

  /** DELETE /:locId — 删除地点 */
  route.delete("/:locId", (c) => {
    const locId = c.req.param("locId");
    if (!locationStore.has(locId)) {
      return c.json({ error: "Location not found" }, 404);
    }

    // Also delete children recursively
    const deleteRecursive = (parentId: string) => {
      for (const [id, loc] of locationStore) {
        if (loc.parentId === parentId) {
          deleteRecursive(id);
          locationStore.delete(id);
        }
      }
    };
    deleteRecursive(locId);
    locationStore.delete(locId);

    log.info({ locId }, "Location deleted");
    return c.json({ deleted: true });
  });

  return route;
}
