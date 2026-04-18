/**
 * /api/projects/:id/versions — 多版本择优管理
 */

import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@moran/core/db";
import { projectDocuments } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";
import type { SelectionResult } from "@moran/core";

const log = createLogger("versions-routes");

interface VersionData {
  versionIndex: number;
  content: string;
  wordCount: number;
  temperature: number;
  score: number;
  passed: boolean;
  isSelected: boolean;
  createdAt: string;
}

interface ChapterVersionSet {
  projectId: string;
  chapterNumber: number;
  hasPassingVersion: boolean;
  totalVersions: number;
  passingVersions: number;
  selectedVersion: number;
  versions: VersionData[];
  createdAt: string;
}

interface VersionConfig {
  versionCount: number;
  temperaturePerturbation: number;
  parallel: boolean;
  skipFullReview: boolean;
  enabled: boolean;
}

const DEFAULT_CONFIG: VersionConfig = {
  versionCount: 3,
  temperaturePerturbation: 0.08,
  parallel: false,
  skipFullReview: false,
  enabled: false,
};

type VersionSetRow = { id: string; content: string };
type VersionConfigRow = { id: string; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseVersionData(value: unknown): VersionData | null {
  if (!isRecord(value)) return null;
  const { versionIndex, content, wordCount, temperature, score, passed, isSelected, createdAt } = value;
  if (
    typeof versionIndex !== "number" || typeof content !== "string" || typeof wordCount !== "number" ||
    typeof temperature !== "number" || typeof score !== "number" || typeof passed !== "boolean" ||
    typeof isSelected !== "boolean" || typeof createdAt !== "string"
  ) return null;
  return { versionIndex, content, wordCount, temperature, score, passed, isSelected, createdAt };
}

function parseVersionSetContent(content: string): ChapterVersionSet | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return null;
    const { projectId, chapterNumber, hasPassingVersion, totalVersions, passingVersions, selectedVersion, versions, createdAt } = parsed;
    if (
      typeof projectId !== "string" || typeof chapterNumber !== "number" || typeof hasPassingVersion !== "boolean" ||
      typeof totalVersions !== "number" || typeof passingVersions !== "number" || typeof selectedVersion !== "number" ||
      !Array.isArray(versions) || typeof createdAt !== "string"
    ) return null;
    const parsedVersions: VersionData[] = [];
    for (const version of versions) {
      const item = parseVersionData(version);
      if (!item) return null;
      parsedVersions.push(item);
    }
    return { projectId, chapterNumber, hasPassingVersion, totalVersions, passingVersions, selectedVersion, versions: parsedVersions, createdAt };
  } catch {
    return null;
  }
}

function parseVersionConfigContent(content: string): VersionConfig | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) return null;
    const { versionCount, temperaturePerturbation, parallel, skipFullReview, enabled } = parsed;
    if (
      typeof versionCount !== "number" || typeof temperaturePerturbation !== "number" || typeof parallel !== "boolean" ||
      typeof skipFullReview !== "boolean" || typeof enabled !== "boolean"
    ) return null;
    return { versionCount, temperaturePerturbation, parallel, skipFullReview, enabled };
  } catch {
    return null;
  }
}

function fromSelectionResult(projectId: string, chapterNumber: number, result: SelectionResult): ChapterVersionSet {
  const now = new Date().toISOString();
  return {
    projectId,
    chapterNumber,
    hasPassingVersion: result.hasPassingVersion,
    totalVersions: result.totalVersions,
    passingVersions: result.passingVersions,
    selectedVersion: result.selected.versionIndex,
    versions: result.candidates.map((c) => ({
      versionIndex: c.versionIndex,
      content: c.content,
      wordCount: c.wordCount,
      temperature: c.temperature,
      score: c.score,
      passed: c.passed,
      isSelected: c.versionIndex === result.selected.versionIndex,
      createdAt: now,
    })),
    createdAt: now,
  };
}

function toVersionSetMetadata(chapterNumber: number) {
  return { chapterNumber, subType: "versions" };
}

function toVersionConfigMetadata() {
  return { subType: "version-config" };
}

async function getVersionSetRow(projectId: string, chapterNumber: number): Promise<VersionSetRow | null> {
  const db = getDb();
  const [row] = await db.select({ id: projectDocuments.id, content: projectDocuments.content }).from(projectDocuments).where(
    and(
      eq(projectDocuments.projectId, projectId),
      eq(projectDocuments.category, "guide"),
      sql`${projectDocuments.metadata}->>'subType' = 'versions'`,
      sql`${projectDocuments.metadata}->>'chapterNumber' = ${String(chapterNumber)}`,
    ),
  ).limit(1);
  return row ?? null;
}

async function getVersionConfigRow(projectId: string): Promise<VersionConfigRow | null> {
  const db = getDb();
  const [row] = await db.select({ id: projectDocuments.id, content: projectDocuments.content }).from(projectDocuments).where(
    and(
      eq(projectDocuments.projectId, projectId),
      eq(projectDocuments.category, "guide"),
      sql`${projectDocuments.metadata}->>'subType' = 'version-config'`,
    ),
  ).limit(1);
  return row ?? null;
}

async function upsertVersionDocument(
  projectId: string,
  title: string,
  content: string,
  metadata: Record<string, unknown>,
  existingId?: string,
): Promise<string | null> {
  const db = getDb();
  const values = { projectId, category: "guide" as const, title, content, metadata };
  if (existingId) {
    const [updated] = await db.update(projectDocuments).set(values).where(eq(projectDocuments.id, existingId)).returning({ id: projectDocuments.id });
    if (!updated) return null;
    return updated.id;
  }
  const [created] = await db.insert(projectDocuments).values(values).returning({ id: projectDocuments.id });
  if (!created) return null;
  return created.id;
}

export async function registerVersionResult(projectId: string, chapterNumber: number, result: SelectionResult): Promise<void> {
  const set = fromSelectionResult(projectId, chapterNumber, result);
  const savedId = await upsertVersionDocument(projectId, `versions:ch${chapterNumber}`, JSON.stringify(set), toVersionSetMetadata(chapterNumber));
  if (!savedId) throw new Error("Failed to save version result");
  log.info({ projectId, chapterNumber, totalVersions: result.totalVersions }, "Version result registered");
}

export function createVersionsRoute() {
  const route = new Hono();

  route.get("/chapters/:num", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    if (!projectId || Number.isNaN(num)) return c.json({ error: "Invalid parameters" }, 400);
    const row = await getVersionSetRow(projectId, num);
    if (!row) return c.json({ error: "No versions found for this chapter" }, 404);
    const versionSet = parseVersionSetContent(row.content);
    if (!versionSet) return c.json({ error: "Version data is corrupted" }, 500);
    const versions = versionSet.versions.map(({ content: _content, ...rest }) => rest);
    return c.json({ chapterNumber: versionSet.chapterNumber, hasPassingVersion: versionSet.hasPassingVersion, totalVersions: versionSet.totalVersions, passingVersions: versionSet.passingVersions, selectedVersion: versionSet.selectedVersion, versions });
  });

  route.get("/chapters/:num/:vIdx", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    const vIdx = parseInt(c.req.param("vIdx"), 10);
    if (!projectId || Number.isNaN(num) || Number.isNaN(vIdx)) return c.json({ error: "Invalid parameters" }, 400);
    const row = await getVersionSetRow(projectId, num);
    if (!row) return c.json({ error: "No versions found for this chapter" }, 404);
    const versionSet = parseVersionSetContent(row.content);
    if (!versionSet) return c.json({ error: "Version data is corrupted" }, 500);
    const version = versionSet.versions.find((v) => v.versionIndex === vIdx);
    if (!version) return c.json({ error: `Version ${vIdx} not found` }, 404);
    return c.json(version);
  });

  route.post("/chapters/:num/select", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    if (!projectId || Number.isNaN(num)) return c.json({ error: "Invalid parameters" }, 400);
    const body = await c.req.json<{ versionIndex: number }>().catch(() => null);
    if (!body || typeof body.versionIndex !== "number") return c.json({ error: "Missing or invalid versionIndex" }, 400);
    const row = await getVersionSetRow(projectId, num);
    if (!row) return c.json({ error: "No versions found for this chapter" }, 404);
    const versionSet = parseVersionSetContent(row.content);
    if (!versionSet) return c.json({ error: "Version data is corrupted" }, 500);
    const targetVersion = versionSet.versions.find((v) => v.versionIndex === body.versionIndex);
    if (!targetVersion) return c.json({ error: `Version ${body.versionIndex} not found` }, 404);
    const updatedSet: ChapterVersionSet = { ...versionSet, selectedVersion: body.versionIndex, versions: versionSet.versions.map((version) => ({ ...version, isSelected: version.versionIndex === body.versionIndex })) };
    const savedId = await upsertVersionDocument(projectId, `versions:ch${num}`, JSON.stringify(updatedSet), toVersionSetMetadata(num), row.id);
    if (!savedId) return c.json({ error: "Failed to update version selection" }, 500);
    log.info({ projectId, chapterNumber: num, selectedVersion: body.versionIndex }, "Version manually selected");
    return c.json({ status: "selected", chapterNumber: num, selectedVersion: body.versionIndex, wordCount: targetVersion.wordCount, score: targetVersion.score });
  });

  route.get("/config", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);
    const row = await getVersionConfigRow(projectId);
    if (!row) return c.json({ ...DEFAULT_CONFIG });
    const config = parseVersionConfigContent(row.content);
    if (!config) return c.json({ error: "Version config data is corrupted" }, 500);
    return c.json(config);
  });

  route.put("/config", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);
    const body = await c.req.json<Partial<VersionConfig>>().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const currentRow = await getVersionConfigRow(projectId);
    const currentConfig = currentRow ? parseVersionConfigContent(currentRow.content) : null;
    const baseConfig = currentConfig ?? DEFAULT_CONFIG;
    const updated: VersionConfig = {
      versionCount: typeof body.versionCount === "number" ? Math.max(2, Math.min(5, body.versionCount)) : baseConfig.versionCount,
      temperaturePerturbation: typeof body.temperaturePerturbation === "number" ? Math.max(0, Math.min(0.3, body.temperaturePerturbation)) : baseConfig.temperaturePerturbation,
      parallel: typeof body.parallel === "boolean" ? body.parallel : baseConfig.parallel,
      skipFullReview: typeof body.skipFullReview === "boolean" ? body.skipFullReview : baseConfig.skipFullReview,
      enabled: typeof body.enabled === "boolean" ? body.enabled : baseConfig.enabled,
    };
    const savedId = await upsertVersionDocument(projectId, "version-config", JSON.stringify(updated), toVersionConfigMetadata(), currentRow?.id);
    if (!savedId) return c.json({ error: "Failed to update version config" }, 500);
    log.info({ projectId, config: updated }, "Version config updated");
    return c.json(updated);
  });

  return route;
}
