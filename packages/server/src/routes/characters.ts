/**
 * /api/projects/:id/characters — 角色管理 CRUD
 *
 * GET    /                — 列出所有角色
 * POST   /                — 新增角色
 * GET    /:charId         — 获取角色详情
 * PUT    /:charId         — 更新角色
 * DELETE /:charId         — 删除角色
 * GET    /graph           — 关系图数据 (Cytoscape.js 格式)
 */

import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { JiangxinEngine } from "@moran/core";
import { getDb } from "@moran/core/db";
import { characters, characterDna, characterRelationships } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";
import type { CharacterDesignInput, SessionProjectBridge } from "@moran/core";

const log = createLogger("characters-routes");

const roleOrder: Record<string, number> = {
  protagonist: 0,
  antagonist: 1,
  supporting: 2,
  minor: 3,
};

export function createCharactersRoute(bridge: SessionProjectBridge, jiangxinEngine: JiangxinEngine) {
  const route = new Hono();

  /** GET / — 列出所有角色 */
  route.get("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();

    const rows = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId));

    const charIds = rows.map((r) => r.id);
    const dnaRows =
      charIds.length > 0
        ? await db
            .select()
            .from(characterDna)
            .where(inArray(characterDna.characterId, charIds))
        : [];

    const dnaByCharId = new Map(dnaRows.map((d) => [d.characterId, d]));

    const result = rows
      .map((ch) => {
        const dna = dnaByCharId.get(ch.id) ?? null;
        return { ...ch, dna };
      })
      .sort((a, b) => (roleOrder[a.role ?? "minor"] ?? 3) - (roleOrder[b.role ?? "minor"] ?? 3));

    return c.json({ characters: result, total: result.length });
  });

  /** POST /align — 角色设计对齐 */
  route.post("/align", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    try {
      const body = await c.req.json<{
        briefSummary: string;
        worldOverview: string;
        requirements?: string;
        referenceKnowledge?: string[];
      }>();

      if (!body.briefSummary) return c.json({ error: "briefSummary is required" }, 400);
      if (!body.worldOverview) return c.json({ error: "worldOverview is required" }, 400);

      const input: CharacterDesignInput = {
        projectId,
        briefSummary: body.briefSummary,
        worldOverview: body.worldOverview,
        requirements: body.requirements,
        referenceKnowledge: body.referenceKnowledge,
      };

      await bridge.ensureSession(projectId);
      const result = await jiangxinEngine.designCharacters(input, bridge);

      return c.json({ reply: `设计了 ${result.characters.length} 个角色`, data: result });
    } catch (error) {
      log.error({ error, projectId }, "Character alignment failed");
      return c.json({ error: "Failed to align characters" }, 500);
    }
  });

  /** POST / — 新增角色 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      name: string;
      aliases?: string[];
      role?: "protagonist" | "antagonist" | "supporting" | "minor";
      description?: string;
      personality?: string;
      background?: string;
      goals?: string[];
      firstAppearance?: number | null;
      arc?: string | null;
      profileContent?: string | null;
      dna?: {
        ghost?: string | null;
        wound?: string | null;
        lie?: string | null;
        want?: string | null;
        need?: string | null;
        arcType?: "positive" | "negative" | "flat" | "corruption";
        defaultMode?: string | null;
        stressResponse?: string | null;
        lieDefense?: string | null;
        tell?: string | null;
      } | null;
    }>();

    if (!body.name) return c.json({ error: "name is required" }, 400);

    const db = getDb();

    const [character] = await db
      .insert(characters)
      .values({
        projectId,
        name: body.name,
        aliases: body.aliases ?? [],
        role: body.role ?? "minor",
        description: body.description ?? null,
        personality: body.personality ?? null,
        background: body.background ?? null,
        goals: body.goals ?? [],
        firstAppearance: body.firstAppearance ?? null,
        arc: body.arc ?? null,
        profileContent: body.profileContent ?? null,
      })
      .returning();

    if (!character) return c.json({ error: "Failed to create character" }, 500);

    let dna = null;
    if (body.dna) {
      const [dnaRow] = await db
        .insert(characterDna)
        .values({
          characterId: character.id,
          ghost: body.dna.ghost ?? null,
          wound: body.dna.wound ?? null,
          lie: body.dna.lie ?? null,
          want: body.dna.want ?? null,
          need: body.dna.need ?? null,
          arcType: body.dna.arcType ?? null,
          defaultMode: body.dna.defaultMode ?? null,
          stressResponse: body.dna.stressResponse ?? null,
          lieDefense: body.dna.lieDefense ?? null,
          tell: body.dna.tell ?? null,
        })
        .returning();
      dna = dnaRow ?? null;
    }

    log.info({ id: character.id, name: body.name }, "Character created");

    return c.json({ ...character, dna }, 201);
  });

  /** GET /graph — 关系图数据 */
  route.get("/graph", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const db = getDb();

    const [charRows, relRows] = await Promise.all([
      db.select().from(characters).where(eq(characters.projectId, projectId)),
      db.select().from(characterRelationships).where(eq(characterRelationships.projectId, projectId)),
    ]);

    const roleColors: Record<string, string> = {
      protagonist: "#e53e3e",
      antagonist: "#805ad5",
      supporting: "#3182ce",
      minor: "#718096",
    };

    const nodes = charRows.map((ch) => ({
      id: ch.id,
      label: ch.name,
      role: ch.role,
      color: roleColors[ch.role ?? "minor"] ?? "#718096",
    }));

    const edges = relRows.map((r) => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      label: r.type,
      description: r.description,
    }));

    return c.json({ nodes, edges });
  });

  /** GET /:charId — 获取角色详情 */
  route.get("/:charId", async (c) => {
    const charId = c.req.param("charId");
    const db = getDb();

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, charId));

    if (!character) return c.json({ error: "Character not found" }, 404);

    const [dna] = await db
      .select()
      .from(characterDna)
      .where(eq(characterDna.characterId, charId));

    return c.json({ ...character, dna: dna ?? null });
  });

  /** PUT /:charId — 更新角色 */
  route.put("/:charId", async (c) => {
    const charId = c.req.param("charId");
    const db = getDb();

    const [existing] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, charId));

    if (!existing) return c.json({ error: "Character not found" }, 404);

    const body = await c.req.json<{
      name?: string;
      aliases?: string[];
      role?: "protagonist" | "antagonist" | "supporting" | "minor";
      description?: string | null;
      personality?: string | null;
      background?: string | null;
      goals?: string[];
      firstAppearance?: number | null;
      arc?: string | null;
      profileContent?: string | null;
      dna?: {
        ghost?: string | null;
        wound?: string | null;
        lie?: string | null;
        want?: string | null;
        need?: string | null;
        arcType?: "positive" | "negative" | "flat" | "corruption";
        defaultMode?: string | null;
        stressResponse?: string | null;
        lieDefense?: string | null;
        tell?: string | null;
      } | null;
    }>();

    const [updated] = await db
      .update(characters)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.aliases !== undefined && { aliases: body.aliases }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.personality !== undefined && { personality: body.personality }),
        ...(body.background !== undefined && { background: body.background }),
        ...(body.goals !== undefined && { goals: body.goals }),
        ...(body.firstAppearance !== undefined && { firstAppearance: body.firstAppearance }),
        ...(body.arc !== undefined && { arc: body.arc }),
        ...(body.profileContent !== undefined && { profileContent: body.profileContent }),
        updatedAt: new Date(),
      })
      .where(eq(characters.id, charId))
      .returning();

    if (!updated) return c.json({ error: "Failed to update character" }, 500);

    let dna = null;
    if (body.dna !== undefined) {
      if (body.dna === null) {
        // Remove DNA if explicitly set to null
        await db.delete(characterDna).where(eq(characterDna.characterId, charId));
      } else {
        // Upsert DNA
        const [existingDna] = await db
          .select({ id: characterDna.id })
          .from(characterDna)
          .where(eq(characterDna.characterId, charId));

        if (existingDna) {
          const [updatedDna] = await db
            .update(characterDna)
            .set({
              ...(body.dna.ghost !== undefined && { ghost: body.dna.ghost }),
              ...(body.dna.wound !== undefined && { wound: body.dna.wound }),
              ...(body.dna.lie !== undefined && { lie: body.dna.lie }),
              ...(body.dna.want !== undefined && { want: body.dna.want }),
              ...(body.dna.need !== undefined && { need: body.dna.need }),
              ...(body.dna.arcType !== undefined && { arcType: body.dna.arcType }),
              ...(body.dna.defaultMode !== undefined && { defaultMode: body.dna.defaultMode }),
              ...(body.dna.stressResponse !== undefined && { stressResponse: body.dna.stressResponse }),
              ...(body.dna.lieDefense !== undefined && { lieDefense: body.dna.lieDefense }),
              ...(body.dna.tell !== undefined && { tell: body.dna.tell }),
            })
            .where(eq(characterDna.characterId, charId))
            .returning();
          dna = updatedDna ?? null;
        } else {
          const [insertedDna] = await db
            .insert(characterDna)
            .values({
              characterId: charId,
              ghost: body.dna.ghost ?? null,
              wound: body.dna.wound ?? null,
              lie: body.dna.lie ?? null,
              want: body.dna.want ?? null,
              need: body.dna.need ?? null,
              arcType: body.dna.arcType ?? null,
              defaultMode: body.dna.defaultMode ?? null,
              stressResponse: body.dna.stressResponse ?? null,
              lieDefense: body.dna.lieDefense ?? null,
              tell: body.dna.tell ?? null,
            })
            .returning();
          dna = insertedDna ?? null;
        }
      }
    } else {
      // Fetch existing DNA to include in response
      const [existingDna] = await db
        .select()
        .from(characterDna)
        .where(eq(characterDna.characterId, charId));
      dna = existingDna ?? null;
    }

    log.info({ charId, name: updated.name }, "Character updated");

    return c.json({ ...updated, dna });
  });

  /** DELETE /:charId — 删除角色 */
  route.delete("/:charId", async (c) => {
    const charId = c.req.param("charId");
    const db = getDb();

    const result = await db
      .delete(characters)
      .where(eq(characters.id, charId))
      .returning({ id: characters.id });

    if (result.length === 0) {
      return c.json({ error: "Character not found" }, 404);
    }

    log.info({ charId }, "Character deleted");
    return c.json({ deleted: true });
  });

  return route;
}
