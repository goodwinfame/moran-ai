/**
 * /api/projects/:id/writing — 写作流程控制
 *
 * POST /next     — 写下一章（触发完整写作管线）
 * POST /pause    — 暂停写作
 * POST /continue — 续写
 *
 * M1.3 阶段：框架实现，Orchestrator 状态机流转正确，
 * 但不实际调用 LLM（placeholder Agent 响应）。
 * M1.4+ 阶段：接入真实 Bridge → OpenCode SDK → LLM 调用链。
 */

import { Hono } from "hono";
import type { Orchestrator } from "@moran/core";
import { createLogger } from "@moran/core/logger";

const log = createLogger("writing-routes");

/** Orchestrator 工厂 — 按 projectId 获取或创建 */
export type OrchestratorProvider = (projectId: string) => Orchestrator | undefined;

/**
 * 创建写作控制路由
 *
 * @param getOrchestrator - 获取项目对应的 Orchestrator 实例
 */
export function createWritingRoute(getOrchestrator: OrchestratorProvider) {
  const route = new Hono();

  /**
   * POST /next — 写下一章
   *
   * 请求体（可选）：
   * - chapterNumber: number (不指定则自动取下一章)
   * - arcNumber: number (弧段号，默认 1)
   */
  route.post("/next", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const orchestrator = getOrchestrator(projectId);
    if (!orchestrator) {
      return c.json({ error: "Project not found or orchestrator not initialized" }, 404);
    }

    const state = orchestrator.getState();
    if (state.phase !== "idle") {
      return c.json(
        {
          error: `Cannot start writing: orchestrator is in "${state.phase}" phase`,
          currentPhase: state.phase,
        },
        409,
      );
    }

    // 解析请求体
    let chapterNumber = state.currentChapter + 1;
    let arcNumber = state.currentArc || 1;

    try {
      const body = await c.req.json().catch(() => ({}));
      if (body && typeof body === "object") {
        if (typeof (body as Record<string, unknown>).chapterNumber === "number") {
          chapterNumber = (body as Record<string, unknown>).chapterNumber as number;
        }
        if (typeof (body as Record<string, unknown>).arcNumber === "number") {
          arcNumber = (body as Record<string, unknown>).arcNumber as number;
        }
      }
    } catch {
      // 空 body 也可以，使用默认值
    }

    try {
      orchestrator.startWriting(chapterNumber, arcNumber);
      log.info({ projectId, chapterNumber, arcNumber }, "Writing started");

      return c.json({
        status: "writing",
        chapterNumber,
        arcNumber,
        message: `Started writing chapter ${chapterNumber}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error({ err, projectId }, "Failed to start writing");
      return c.json({ error: message }, 500);
    }
  });

  /**
   * POST /pause — 暂停写作
   */
  route.post("/pause", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const orchestrator = getOrchestrator(projectId);
    if (!orchestrator) {
      return c.json({ error: "Project not found or orchestrator not initialized" }, 404);
    }

    const state = orchestrator.getState();
    if (state.phase === "idle") {
      return c.json({ error: "Nothing to pause: orchestrator is idle" }, 409);
    }

    if (state.paused) {
      return c.json({ status: "already_paused", phase: state.phase });
    }

    orchestrator.pause();
    log.info({ projectId, phase: state.phase }, "Writing paused");

    return c.json({
      status: "paused",
      phase: state.phase,
      chapterNumber: state.currentChapter,
    });
  });

  /**
   * POST /continue — 续写（恢复暂停的写作）
   */
  route.post("/continue", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const orchestrator = getOrchestrator(projectId);
    if (!orchestrator) {
      return c.json({ error: "Project not found or orchestrator not initialized" }, 404);
    }

    const state = orchestrator.getState();
    if (!state.paused) {
      return c.json({ error: "Orchestrator is not paused" }, 409);
    }

    orchestrator.resume();
    log.info({ projectId, phase: state.phase }, "Writing resumed");

    return c.json({
      status: "resumed",
      phase: state.phase,
      chapterNumber: state.currentChapter,
    });
  });

  /**
   * GET / — 获取当前写作状态
   */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const orchestrator = getOrchestrator(projectId);
    if (!orchestrator) {
      return c.json({ error: "Project not found or orchestrator not initialized" }, 404);
    }

    const state = orchestrator.getState();
    const cost = orchestrator.getCostSummary();

    return c.json({
      phase: state.phase,
      chapterNumber: state.currentChapter,
      arcNumber: state.currentArc,
      reviewRound: state.reviewRound,
      paused: state.paused,
      aborted: state.aborted,
      lastActivity: state.lastActivity.toISOString(),
      cost,
    });
  });

  return route;
}
