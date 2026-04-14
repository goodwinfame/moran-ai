/**
 * /api/projects/:id/writing — 写作流程控制
 *
 * POST /next     — 写下一章（触发完整写作管线）
 * POST /pause    — 暂停写作
 * POST /continue — 续写
 *
 * M1.4：接入 ChapterPipeline，通过 Bridge → placeholder Agent 完成全流程。
 * 实际的 LLM 调用链在 OpenCode SDK 集成后替换。
 */

import { Hono } from "hono";
import type { Orchestrator, ChapterPipeline } from "@moran/core";
import { createLogger } from "@moran/core/logger";

const log = createLogger("writing-routes");

/** Orchestrator 工厂 — 按 projectId 获取或创建 */
export type OrchestratorProvider = (projectId: string) => Orchestrator | undefined;

/** ChapterPipeline 工厂 — 按 projectId 获取或创建 */
export type PipelineProvider = (projectId: string) => ChapterPipeline | undefined;

/**
 * 创建写作控制路由
 *
 * @param getOrchestrator - 获取项目对应的 Orchestrator 实例
 * @param getPipeline - 获取项目对应的 ChapterPipeline 实例（可选，M1.4+）
 */
export function createWritingRoute(
  getOrchestrator: OrchestratorProvider,
  getPipeline?: PipelineProvider,
) {
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

    // 尝试使用 ChapterPipeline（M1.4+）
    const pipeline = getPipeline?.(projectId);
    if (pipeline) {
      // 异步执行管线，立即返回 202 Accepted
      // 客户端通过 SSE 订阅获取实时进度
      const chapterType = "normal" as const; // TODO: 从 brief/outline 推断
      const styleId = "yunmo"; // TODO: 从项目配置读取

      // 不 await — 火后即忘，SSE 推送进度
      pipeline
        .writeChapter({
          chapterNumber,
          arcNumber,
          chapterType,
          styleId,
          brief: undefined,
          assembledContext: undefined,
        })
        .then((result) => {
          log.info(
            { projectId, chapterNumber, success: result.success, rounds: result.reviewRounds },
            "Chapter pipeline completed",
          );
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          log.error({ err: msg, projectId, chapterNumber }, "Chapter pipeline failed");
        });

      log.info({ projectId, chapterNumber, arcNumber, mode: "pipeline" }, "Writing started via pipeline");

      return c.json(
        {
          status: "writing",
          chapterNumber,
          arcNumber,
          mode: "pipeline",
          message: `Started writing chapter ${chapterNumber} — subscribe to SSE for progress`,
        },
        202,
      );
    }

    // 回退：仅状态转换（无 pipeline）
    try {
      orchestrator.startWriting(chapterNumber, arcNumber);
      log.info({ projectId, chapterNumber, arcNumber, mode: "orchestrator-only" }, "Writing started");

      return c.json({
        status: "writing",
        chapterNumber,
        arcNumber,
        mode: "orchestrator-only",
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
