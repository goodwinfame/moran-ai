import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { characters, characterDna, characterStates } from "../db/schema/characters.js";
import type { ServiceResult } from "./types.js";

type Character = typeof characters.$inferSelect;
type NewCharacter = typeof characters.$inferInsert;
type Dna = typeof characterDna.$inferSelect;
type NewDna = typeof characterDna.$inferInsert;
type CharState = typeof characterStates.$inferSelect;
type NewCharState = typeof characterStates.$inferInsert;

// ── Characters ──

export async function create(
  projectId: string,
  data: Omit<NewCharacter, "id" | "projectId" | "createdAt" | "updatedAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(characters)
    .values({ projectId, ...data })
    .returning({ id: characters.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "角色创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function read(
  projectId: string,
  id: string,
): Promise<ServiceResult<Character>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "角色不存在" } };
  return { ok: true, data: row };
}

export async function list(projectId: string): Promise<ServiceResult<Character[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(characters.createdAt);
  return { ok: true, data: rows };
}

export async function update(
  id: string,
  data: Partial<Omit<NewCharacter, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<ServiceResult<Character>> {
  const db = getDb();
  const rows = await db
    .update(characters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(characters.id, id))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "角色不存在" } };
  return { ok: true, data: row };
}

export async function patch(
  id: string,
  data: {
    name?: string;
    aliases?: string[];
    role?: NewCharacter["role"];
    description?: string;
    personality?: string;
    background?: string;
    goals?: string[];
    firstAppearance?: number;
    arc?: string;
    profileContent?: string;
    wound?: string;
    designTier?: string;
  },
): Promise<ServiceResult<Character>> {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { code: "NO_FIELDS", message: "没有需要更新的字段" } };
  }
  updates.updatedAt = new Date();
  const rows = await db.update(characters).set(updates).where(eq(characters.id, id)).returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "角色不存在" } };
  return { ok: true, data: row };
}

export async function remove(id: string): Promise<ServiceResult<void>> {
  const db = getDb();
  const rows = await db.delete(characters).where(eq(characters.id, id)).returning({ id: characters.id });
  if (rows.length === 0) return { ok: false, error: { code: "NOT_FOUND", message: "角色不存在" } };
  return { ok: true, data: undefined };
}

// ── Character DNA (五维心理模型) ──

export async function createDna(
  characterId: string,
  data: Omit<NewDna, "id" | "characterId">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(characterDna)
    .values({ characterId, ...data })
    .returning({ id: characterDna.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "角色DNA创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readDna(characterId: string): Promise<ServiceResult<Dna>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(characterDna)
    .where(eq(characterDna.characterId, characterId))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "角色DNA不存在" } };
  return { ok: true, data: row };
}

export async function updateDna(
  characterId: string,
  data: Partial<Omit<NewDna, "id" | "characterId">>,
): Promise<ServiceResult<Dna>> {
  const db = getDb();
  const rows = await db
    .update(characterDna)
    .set(data)
    .where(eq(characterDna.characterId, characterId))
    .returning();
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "角色DNA不存在" } };
  return { ok: true, data: row };
}

// ── Character States (per-chapter snapshots) ──

export async function createState(
  characterId: string,
  data: Omit<NewCharState, "id" | "characterId" | "createdAt">,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const rows = await db
    .insert(characterStates)
    .values({ characterId, ...data })
    .returning({ id: characterStates.id });
  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "角色状态创建失败" } };
  return { ok: true, data: { id: row.id } };
}

export async function readState(
  characterId: string,
  chapterNumber: number,
): Promise<ServiceResult<CharState>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(characterStates)
    .where(and(eq(characterStates.characterId, characterId), eq(characterStates.chapterNumber, chapterNumber)))
    .limit(1);
  if (!row) return { ok: false, error: { code: "NOT_FOUND", message: "该章节角色状态不存在" } };
  return { ok: true, data: row };
}

export async function listStates(characterId: string): Promise<ServiceResult<CharState[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(characterStates)
    .where(eq(characterStates.characterId, characterId))
    .orderBy(characterStates.chapterNumber);
  return { ok: true, data: rows };
}
