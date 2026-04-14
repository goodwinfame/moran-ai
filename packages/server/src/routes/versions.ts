/**
 * /api/projects/:id/versions — 多版本择优管理
 *
 * GET    /chapters/:num           — 获取章节的版本列表
 * GET    /chapters/:num/:vIdx     — 获取某个具体版本详情
 * POST   /chapters/:num/select    — 手动选择版本
 * GET    /config                  — 获取多版本配置
 * PUT    /config                  — 更新多版本配置
 *
 * M4.1: 多版本择优数据管理。使用内存存储，后续接入 PostgreSQL。
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";
import type {
  SelectionResult,
} from "@moran/core";

const log = createLogger("versions-routes");

// ── 内存存储 ──────────────────────────────────────────

/** 版本数据（简化版，前端展示用） */
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

/** 章节版本集 */
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

/** 多版本配置 */
interface VersionConfig {
  versionCount: number;
  temperaturePerturbation: number;
  parallel: boolean;
  skipFullReview: boolean;
  enabled: boolean;
}

// key: `${projectId}:${chapterNumber}`
const versionStore = new Map<string, ChapterVersionSet>();
const configStore = new Map<string, VersionConfig>();

function versionKey(projectId: string, num: number) {
  return `${projectId}:${num}`;
}

const DEFAULT_CONFIG: VersionConfig = {
  versionCount: 3,
  temperaturePerturbation: 0.08,
  parallel: false,
  skipFullReview: false,
  enabled: false,
};

/** 从 SelectionResult 转换为存储格式 */
function fromSelectionResult(
  projectId: string,
  chapterNumber: number,
  result: SelectionResult,
): ChapterVersionSet {
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

/**
 * 注册版本数据（供 ChapterPipeline 调用）
 */
export function registerVersionResult(
  projectId: string,
  chapterNumber: number,
  result: SelectionResult,
): void {
  const key = versionKey(projectId, chapterNumber);
  versionStore.set(key, fromSelectionResult(projectId, chapterNumber, result));
  log.info(
    { projectId, chapterNumber, totalVersions: result.totalVersions },
    "Version result registered",
  );
}

// ── 示例数据 ──────────────────────────────────────────

function seedDemoVersions(projectId: string): void {
  const key = versionKey(projectId, 1);
  if (versionStore.has(key)) return;

  const now = new Date().toISOString();
  versionStore.set(key, {
    projectId,
    chapterNumber: 1,
    hasPassingVersion: true,
    totalVersions: 3,
    passingVersions: 2,
    selectedVersion: 2,
    versions: [
      {
        versionIndex: 1,
        content: "\u7b2c\u4e00\u7248\u672c\u7684\u5185\u5bb9\u2026\u2026\u7b97\u4e86\u8fd9\u4e2a\u7248\u672c\u5199\u5f97\u4e00\u822c\u3002",
        wordCount: 2800,
        temperature: 0.72,
        score: 68,
        passed: false,
        isSelected: false,
        createdAt: now,
      },
      {
        versionIndex: 2,
        content: "\u7b2c\u4e8c\u7248\u672c\u7684\u5185\u5bb9\u2026\u2026\u8fd9\u4e2a\u7248\u672c\u5199\u5f97\u6700\u597d\uff0c\u88ab\u9009\u4e2d\u4e86\u3002",
        wordCount: 3200,
        temperature: 0.80,
        score: 85,
        passed: true,
        isSelected: true,
        createdAt: now,
      },
      {
        versionIndex: 3,
        content: "\u7b2c\u4e09\u7248\u672c\u7684\u5185\u5bb9\u2026\u2026\u8fd9\u4e2a\u7248\u672c\u4e5f\u8fd8\u884c\u3002",
        wordCount: 3000,
        temperature: 0.88,
        score: 76,
        passed: true,
        isSelected: false,
        createdAt: now,
      },
    ],
    createdAt: now,
  });
}

// ── 路由 ──────────────────────────────────────────────

export function createVersionsRoute() {
  const route = new Hono();

  /** GET /chapters/:num — 获取章节版本列表 */
  route.get("/chapters/:num", (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);

    if (!projectId || isNaN(num)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    seedDemoVersions(projectId);

    const key = versionKey(projectId, num);
    const versionSet = versionStore.get(key);

    if (!versionSet) {
      return c.json({ error: "No versions found for this chapter" }, 404);
    }

    // 返回不含正文的摘要列表
    const summaries = versionSet.versions.map(({ content: _, ...rest }) => rest);

    return c.json({
      chapterNumber: versionSet.chapterNumber,
      hasPassingVersion: versionSet.hasPassingVersion,
      totalVersions: versionSet.totalVersions,
      passingVersions: versionSet.passingVersions,
      selectedVersion: versionSet.selectedVersion,
      versions: summaries,
    });
  });

  /** GET /chapters/:num/:vIdx — 获取版本详情（含正文） */
  route.get("/chapters/:num/:vIdx", (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    const vIdx = parseInt(c.req.param("vIdx"), 10);

    if (!projectId || isNaN(num) || isNaN(vIdx)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    seedDemoVersions(projectId);

    const key = versionKey(projectId, num);
    const versionSet = versionStore.get(key);
    if (!versionSet) {
      return c.json({ error: "No versions found for this chapter" }, 404);
    }

    const version = versionSet.versions.find((v) => v.versionIndex === vIdx);
    if (!version) {
      return c.json({ error: `Version ${vIdx} not found` }, 404);
    }

    return c.json(version);
  });

  /** POST /chapters/:num/select — 手动选择版本 */
  route.post("/chapters/:num/select", async (c) => {
    const projectId = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);

    if (!projectId || isNaN(num)) {
      return c.json({ error: "Invalid parameters" }, 400);
    }

    const body = await c.req.json<{ versionIndex: number }>().catch(() => null);
    if (!body || typeof body.versionIndex !== "number") {
      return c.json({ error: "Missing or invalid versionIndex" }, 400);
    }

    seedDemoVersions(projectId);

    const key = versionKey(projectId, num);
    const versionSet = versionStore.get(key);
    if (!versionSet) {
      return c.json({ error: "No versions found for this chapter" }, 404);
    }

    const targetVersion = versionSet.versions.find(
      (v) => v.versionIndex === body.versionIndex,
    );
    if (!targetVersion) {
      return c.json({ error: `Version ${body.versionIndex} not found` }, 404);
    }

    // 更新选中状态
    for (const v of versionSet.versions) {
      v.isSelected = v.versionIndex === body.versionIndex;
    }
    versionSet.selectedVersion = body.versionIndex;

    log.info(
      { projectId, chapterNumber: num, selectedVersion: body.versionIndex },
      "Version manually selected",
    );

    return c.json({
      status: "selected",
      chapterNumber: num,
      selectedVersion: body.versionIndex,
      wordCount: targetVersion.wordCount,
      score: targetVersion.score,
    });
  });

  /** GET /config — 获取多版本配置 */
  route.get("/config", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const config = configStore.get(projectId) ?? { ...DEFAULT_CONFIG };
    return c.json(config);
  });

  /** PUT /config — 更新多版本配置 */
  route.put("/config", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<Partial<VersionConfig>>().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const current = configStore.get(projectId) ?? { ...DEFAULT_CONFIG };

    // 合并更新
    const updated: VersionConfig = {
      versionCount:
        typeof body.versionCount === "number"
          ? Math.max(2, Math.min(5, body.versionCount))
          : current.versionCount,
      temperaturePerturbation:
        typeof body.temperaturePerturbation === "number"
          ? Math.max(0, Math.min(0.3, body.temperaturePerturbation))
          : current.temperaturePerturbation,
      parallel: typeof body.parallel === "boolean" ? body.parallel : current.parallel,
      skipFullReview:
        typeof body.skipFullReview === "boolean" ? body.skipFullReview : current.skipFullReview,
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    };

    configStore.set(projectId, updated);
    log.info({ projectId, config: updated }, "Version config updated");

    return c.json(updated);
  });

  return route;
}
