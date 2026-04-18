/**
 * /api/projects/:id/locations — 地点数据 (层级树 + 可视化)
 *
 * GET  /       — 层级树数据 (D3.js 格式)
 * POST /       — 新增地点
 * PUT  /:locId — 更新地点
 * DELETE /:locId — 删除地点
 */

import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { locations } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("locations-routes");

type LocationRow = typeof locations.$inferSelect;
type LocationInsert = typeof locations.$inferInsert;

type LocationTreeSource = Pick<LocationRow, "id" | "name" | "type" | "description" | "parentId">;

type LocationWriteInput = {
  name?: string;
  parentId?: string | null;
  type?: string | null;
  description?: string | null;
  aliases?: string[] | null;
  sensoryDetails?: string | null;
  layout?: string | null;
  significance?: LocationInsert["significance"] | null;
  firstAppearance?: number | null;
  status?: LocationInsert["status"] | null;
  relatedCharacterIds?: string[] | null;
  tags?: string[] | null;
};

export interface LocationTreeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  children: LocationTreeNode[];
}

function buildTree(locations: LocationTreeSource[]): LocationTreeNode[] {
  const byId = new Map<string, LocationTreeNode>();
  const roots: LocationTreeNode[] = [];

  for (const loc of locations) {
    byId.set(loc.id, {
      id: loc.id,
      name: loc.name,
      type: loc.type ?? "custom",
      description: loc.description ?? "",
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

function serializeAttributes(row: LocationRow): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (row.aliases && row.aliases.length > 0) attributes.aliases = JSON.stringify(row.aliases);
  if (row.sensoryDetails) attributes.sensoryDetails = row.sensoryDetails;
  if (row.layout) attributes.layout = row.layout;
  if (row.significance) attributes.significance = row.significance;
  if (row.firstAppearance !== null && row.firstAppearance !== undefined) {
    attributes.firstAppearance = String(row.firstAppearance);
  }
  if (row.relatedCharacterIds && row.relatedCharacterIds.length > 0) {
    attributes.relatedCharacterIds = JSON.stringify(row.relatedCharacterIds);
  }
  if (row.status) attributes.status = row.status;
  if (row.tags && row.tags.length > 0) attributes.tags = JSON.stringify(row.tags);

  return attributes;
}

function serializeLocation(row: LocationRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    parentId: row.parentId,
    type: row.type ?? "custom",
    description: row.description ?? "",
    attributes: serializeAttributes(row),
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date(0).toISOString(),
  };
}

function collectDescendantIds(rows: LocationRow[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.parentId) continue;
    const current = childrenByParent.get(row.parentId);
    if (current) current.push(row.id);
    else childrenByParent.set(row.parentId, [row.id]);
  }

  const collected = new Set<string>([rootId]);
  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const children = childrenByParent.get(current);
    if (!children) continue;

    for (const childId of children) {
      if (collected.has(childId)) continue;
      collected.add(childId);
      stack.push(childId);
    }
  }

  return Array.from(collected);
}

// ── Route factory ───────────────────────────────

export function createLocationsRoute() {
  const route = new Hono();

  /** GET / — 层级树数据 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();
    const rows = await db.select().from(locations).where(eq(locations.projectId, projectId));

    const tree = buildTree(rows);
    const flat = rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      type: row.type ?? "custom",
      description: row.description ?? "",
      attributes: serializeAttributes(row),
    }));

    return c.json({ tree, flat, total: rows.length });
  });

  /** POST / — 新增地点 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<LocationWriteInput>();
    if (!body.name) return c.json({ error: "name is required" }, 400);

    const db = getDb();
    const [created] = await db
      .insert(locations)
      .values({
        projectId,
        name: body.name,
        parentId: body.parentId ?? null,
        type: body.type ?? "custom",
        description: body.description ?? null,
        aliases: body.aliases ?? null,
        sensoryDetails: body.sensoryDetails ?? null,
        layout: body.layout ?? null,
        significance: body.significance ?? null,
        firstAppearance: body.firstAppearance ?? null,
        status: body.status ?? "active",
        relatedCharacterIds: body.relatedCharacterIds ?? null,
        tags: body.tags ?? null,
      })
      .returning();

    log.info({ id: created?.id, name: body.name }, "Location created");

    return c.json(created ? serializeLocation(created) : null, 201);
  });

  /** PUT /:locId — 更新地点 */
  route.put("/:locId", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);
    const locId = c.req.param("locId");
    const db = getDb();

    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locId), eq(locations.projectId, projectId)))
      .limit(1);

    if (!existing) return c.json({ error: "Location not found" }, 404);

    const body = await c.req.json<LocationWriteInput>();

    const [updated] = await db
      .update(locations)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.aliases !== undefined && { aliases: body.aliases }),
        ...(body.sensoryDetails !== undefined && { sensoryDetails: body.sensoryDetails }),
        ...(body.layout !== undefined && { layout: body.layout }),
        ...(body.significance !== undefined && { significance: body.significance }),
        ...(body.firstAppearance !== undefined && { firstAppearance: body.firstAppearance }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.relatedCharacterIds !== undefined && { relatedCharacterIds: body.relatedCharacterIds }),
        ...(body.tags !== undefined && { tags: body.tags }),
        updatedAt: new Date(),
      })
      .where(and(eq(locations.id, locId), eq(locations.projectId, projectId)))
      .returning();

    log.info({ locId, name: updated?.name }, "Location updated");

    return c.json(updated ? serializeLocation(updated) : null);
  });

  /** DELETE /:locId — 删除地点 */
  route.delete("/:locId", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);
    const locId = c.req.param("locId");
    const db = getDb();

    const rows = await db.select().from(locations).where(eq(locations.projectId, projectId));
    const targetExists = rows.some((row) => row.id === locId);
    if (!targetExists) return c.json({ error: "Location not found" }, 404);

    const idsToDelete = collectDescendantIds(rows, locId);

    await db
      .delete(locations)
      .where(and(eq(locations.projectId, projectId), inArray(locations.id, idsToDelete)));

    log.info({ locId }, "Location deleted");
    return c.json({ deleted: true });
  });

  return route;
}
