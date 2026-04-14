/**
 * WriteSession — 多章连续写作会话管理器
 *
 * 核心能力：
 *   1. write-next: 自动确定下一章 → 执行 ChapterPipeline → 归档
 *   2. write-loop: 连续写作循环，弧段边界自动暂停
 *   3. 恢复机制: 中断后从持久化状态继续
 *   4. 弧段边界检测: 弧段最后一章完成后触发暂停/停止
 *
 * 设计原则：
 *   - WriteSession 不直接依赖 DB，通过 ProjectDataProvider 抽象
 *   - ChapterPipeline 负责单章（写作-审校-归档），WriteSession 负责多章调度
 *   - 所有状态可序列化（WriteSessionState），支持断点恢复
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import type { ChapterPipeline } from "../orchestrator/chapter-pipeline.js";
import type { Orchestrator } from "../orchestrator/orchestrator.js";
import type { WriteChapterResult } from "../orchestrator/types.js";
import type { ChapterType } from "../style/types.js";
import type {
  ArcBoundaryAction,
  ArcBoundaryInfo,
  ProjectDataProvider,
  WriteLoopResult,
  WriteLoopStats,
  WriteLoopStopReason,
  WriteNextRequest,
  WriteNextResult,
  WriteLoopRequest,
  WriteSessionEvent,
  WriteSessionListener,
  WriteSessionState,
} from "./types.js";

const logger = createLogger("write-session");

/** 生成唯一会话 ID */
function generateSessionId(): string {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `ws_${now}_${random}`;
}

/**
 * WriteSession — 多章连续写作会话
 */
export class WriteSession {
  private readonly pipeline: ChapterPipeline;
  private readonly dataProvider: ProjectDataProvider;
  private readonly listeners: WriteSessionListener[] = [];

  private state: WriteSessionState;
  private chapterResults: WriteChapterResult[] = [];
  private pauseRequested = false;

  constructor(
    orchestrator: Orchestrator,
    pipeline: ChapterPipeline,
    _bridge: SessionProjectBridge,
    dataProvider: ProjectDataProvider,
    existingState?: WriteSessionState,
  ) {
    this.pipeline = pipeline;
    this.dataProvider = dataProvider;

    if (existingState) {
      this.state = { ...existingState };
    } else {
      const now = new Date().toISOString();
      this.state = {
        sessionId: generateSessionId(),
        projectId: orchestrator.getState().projectId,
        type: "write-next",
        status: "idle",
        currentArc: 0,
        nextChapter: 0,
        completedChapters: [],
        arcBoundaryAction: "pause",
        stats: {
          chaptersWritten: 0,
          totalWordCount: 0,
          firstPassCount: 0,
          totalEstimatedCost: 0,
          startedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  // ── 状态查询 ──────────────────────────────────────

  /** 获取会话状态（只读副本） */
  getState(): Readonly<WriteSessionState> {
    return { ...this.state };
  }

  /** 获取已完成章节的结果 */
  getChapterResults(): readonly WriteChapterResult[] {
    return [...this.chapterResults];
  }

  /** 是否正在运行 */
  get isRunning(): boolean {
    return this.state.status === "running";
  }

  /** 是否可恢复 */
  get isResumable(): boolean {
    return this.state.status === "paused" || this.state.status === "interrupted";
  }

  // ── 事件订阅 ──────────────────────────────────────

  /** 订阅会话事件 */
  on(listener: WriteSessionListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: WriteSessionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.warn({ error: err }, "WriteSession listener error");
      }
    }
  }

  // ── write-next: 写下一章 ──────────────────────────

  /**
   * 写下一章 — 自动确定章节号，执行完整 Pipeline
   */
  async writeNext(request: WriteNextRequest): Promise<WriteNextResult> {
    if (this.state.status === "running") {
      throw new Error("WriteSession is already running");
    }

    this.state.type = "write-next";
    this.state.status = "running";
    this.state.projectId = request.projectId;
    if (request.styleId) this.state.styleId = request.styleId;
    this.updateTimestamp();

    try {
      // 1. 确定下一章序号
      const chapterNumber = request.chapterNumber
        ?? (await this.dataProvider.getLastCompletedChapter(request.projectId)) + 1;

      // 2. 获取弧段信息
      const arcInfo = await this.resolveArcInfo(request.projectId, chapterNumber);
      this.state.currentArc = arcInfo.currentArc;
      this.state.nextChapter = chapterNumber;

      // 3. 获取或生成 Brief
      const brief = request.useExistingBrief
        ? await this.dataProvider.getChapterBrief(request.projectId, chapterNumber)
        : null;

      // 4. 发出开始事件
      this.emit({
        type: "chapter_start",
        chapterNumber,
        arcNumber: arcInfo.currentArc,
      });

      logger.info(
        { project: request.projectId, chapter: chapterNumber, arc: arcInfo.currentArc },
        "write-next starting",
      );

      // 5. 执行 ChapterPipeline
      const chapterType = this.inferChapterType(arcInfo);
      const result = await this.pipeline.writeChapter({
        chapterNumber,
        arcNumber: arcInfo.currentArc,
        chapterType,
        styleId: request.styleId ?? "default",
        brief: brief ?? undefined,
      });

      // 6. 更新状态
      this.recordChapterResult(result);

      // 7. 更新项目进度
      if (result.success) {
        await this.dataProvider.updateProjectProgress(
          request.projectId,
          chapterNumber,
          arcInfo.currentArc,
        );
      }

      // 8. 发出完成事件
      this.emit({
        type: "chapter_complete",
        chapterNumber,
        result,
      });

      // 9. 检查弧段边界
      if (arcInfo.isLastInArc && result.success) {
        this.emit({ type: "arc_boundary", info: arcInfo });
      }

      this.state.status = result.success ? "completed" : "error";
      if (!result.success && result.error) {
        this.state.error = result.error;
      }
      this.updateTimestamp();
      await this.persistState();

      return {
        ...result,
        arcInfo,
        isArcBoundary: arcInfo.isLastInArc,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.status = "error";
      this.state.error = message;
      this.updateTimestamp();
      await this.persistState();

      this.emit({ type: "session_error", error: message });
      logger.error({ error: message }, "write-next failed");

      throw error;
    }
  }

  // ── write-loop: 连续写作 ──────────────────────────

  /**
   * 连续写作循环 — 写 N 章，弧段边界自动处理
   */
  async writeLoop(request: WriteLoopRequest): Promise<WriteLoopResult> {
    if (this.state.status === "running") {
      throw new Error("WriteSession is already running");
    }

    this.state.type = "write-loop";
    this.state.status = "running";
    this.state.projectId = request.projectId;
    this.state.arcBoundaryAction = request.arcBoundaryAction;
    this.state.targetChapters = request.targetChapters;
    if (request.styleId) this.state.styleId = request.styleId;
    this.state.stats.startedAt = new Date().toISOString();
    this.pauseRequested = false;
    this.chapterResults = [];
    this.updateTimestamp();

    const startTime = Date.now();
    /** Chapters written in THIS invocation (not cumulative) — used for target check */
    let chaptersThisRun = 0;

    try {
      let stopReason: WriteLoopStopReason | null = null;
      let arcBoundaryInfo: ArcBoundaryInfo | undefined;

      while (!stopReason) {
        // 检查用户暂停请求
        if (this.pauseRequested) {
          stopReason = "user_pause";
          break;
        }

        // 检查目标章数（用本次运行计数，非累积）
        if (request.targetChapters && chaptersThisRun >= request.targetChapters) {
          stopReason = "target_reached";
          break;
        }

        // 确定下一章
        const chapterNumber = this.state.nextChapter > 0
          ? this.state.nextChapter
          : (await this.dataProvider.getLastCompletedChapter(request.projectId)) + 1;

        // 获取弧段信息
        const arcInfo = await this.resolveArcInfo(request.projectId, chapterNumber);
        this.state.currentArc = arcInfo.currentArc;
        this.state.nextChapter = chapterNumber;

        // 检查是否还有章节可写
        if (!arcInfo.currentArc) {
          stopReason = "no_more_chapters";
          break;
        }

        // 发出开始事件
        this.emit({
          type: "chapter_start",
          chapterNumber,
          arcNumber: arcInfo.currentArc,
        });

        logger.info(
          {
            project: request.projectId,
            chapter: chapterNumber,
            arc: arcInfo.currentArc,
            progress: `${this.state.stats.chaptersWritten + 1}/${request.targetChapters ?? "∞"}`,
          },
          "write-loop: writing chapter",
        );

        // 获取 Brief
        const brief = await this.dataProvider.getChapterBrief(request.projectId, chapterNumber);

        // 执行 Pipeline
        const chapterType = this.inferChapterType(arcInfo);
        const result = await this.pipeline.writeChapter({
          chapterNumber,
          arcNumber: arcInfo.currentArc,
          chapterType,
          styleId: request.styleId ?? "default",
          brief: brief ?? undefined,
        });

        // 记录结果
        this.recordChapterResult(result);
        if (result.success) {
          chaptersThisRun += 1;
        }

        // 发出完成事件
        this.emit({
          type: "chapter_complete",
          chapterNumber,
          result,
        });

        if (!result.success) {
          if (result.spiralInterrupted) {
            stopReason = "spiral_interrupt";
          } else {
            stopReason = "error";
            this.state.error = result.error ?? "Chapter pipeline failed";
          }
          break;
        }

        // 更新项目进度
        await this.dataProvider.updateProjectProgress(
          request.projectId,
          chapterNumber,
          arcInfo.currentArc,
        );

        // 设置下一章
        this.state.nextChapter = chapterNumber + 1;

        // 发出进度事件
        const progressStats = this.buildStats(startTime);
        this.emit({
          type: "loop_progress",
          stats: progressStats,
          nextChapter: this.state.nextChapter,
        });

        // 检查弧段边界
        if (arcInfo.isLastInArc) {
          this.emit({ type: "arc_boundary", info: arcInfo });
          arcBoundaryInfo = arcInfo;

          if (request.arcBoundaryAction === "pause") {
            stopReason = "arc_boundary";
            break;
          } else if (request.arcBoundaryAction === "stop") {
            stopReason = "arc_boundary";
            break;
          }
          // "continue" — 继续下一弧段
        }

        // 持久化中间状态
        this.updateTimestamp();
        await this.persistState();
      }

      // 构建最终结果
      const endTime = Date.now();
      const stats = this.buildStats(startTime, endTime);
      const finalStopReason = stopReason ?? "target_reached";

      // 更新会话最终状态
      this.state.stopReason = finalStopReason;
      if (finalStopReason === "arc_boundary" && request.arcBoundaryAction === "pause") {
        this.state.status = "paused";
      } else if (finalStopReason === "spiral_interrupt") {
        this.state.status = "interrupted";
      } else if (finalStopReason === "error") {
        this.state.status = "error";
      } else {
        this.state.status = "completed";
      }
      this.updateTimestamp();
      await this.persistState();

      const loopResult: WriteLoopResult = {
        completed: finalStopReason === "target_reached" || finalStopReason === "no_more_chapters",
        chapters: [...this.chapterResults],
        stopReason: finalStopReason,
        arcBoundary: arcBoundaryInfo,
        stats,
        resumable: this.state.status === "paused" || this.state.status === "interrupted",
      };

      // 发出会话完成/暂停事件
      if (this.state.status === "paused") {
        this.emit({ type: "session_paused", reason: finalStopReason });
      } else {
        this.emit({ type: "session_completed", result: loopResult });
      }

      return loopResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.status = "error";
      this.state.error = message;
      this.updateTimestamp();
      await this.persistState();

      this.emit({ type: "session_error", error: message });
      logger.error({ error: message }, "write-loop failed");

      const stats = this.buildStats(startTime);
      return {
        completed: false,
        chapters: [...this.chapterResults],
        stopReason: "error",
        stats,
        resumable: false,
      };
    }
  }

  // ── resume: 恢复写作 ──────────────────────────────

  /**
   * 恢复暂停的写作循环
   *
   * 从持久化的 WriteSessionState 继续写作。
   * 仅在 status=paused 或 status=interrupted 时可调用。
   */
  async resume(overrides?: {
    targetChapters?: number;
    arcBoundaryAction?: ArcBoundaryAction;
  }): Promise<WriteLoopResult> {
    if (!this.isResumable) {
      throw new Error(`Cannot resume session in status "${this.state.status}"`);
    }

    logger.info(
      {
        sessionId: this.state.sessionId,
        nextChapter: this.state.nextChapter,
        previousStatus: this.state.status,
      },
      "Resuming write session",
    );

    // 应用覆盖参数
    if (overrides?.arcBoundaryAction) {
      this.state.arcBoundaryAction = overrides.arcBoundaryAction;
    }
    const targetChapters = overrides?.targetChapters ?? this.state.targetChapters;

    // 对于弧段边界暂停的恢复，计算剩余目标
    const remaining = targetChapters
      ? targetChapters - this.state.stats.chaptersWritten
      : undefined;

    return this.writeLoop({
      projectId: this.state.projectId,
      targetChapters: remaining,
      styleId: this.state.styleId,
      arcBoundaryAction: this.state.arcBoundaryAction,
    });
  }

  // ── pause: 请求暂停 ──────────────────────────────

  /** 请求暂停写作循环（在当前章节完成后生效） */
  requestPause(): void {
    if (this.state.status !== "running") return;
    this.pauseRequested = true;
    logger.info({ sessionId: this.state.sessionId }, "Pause requested");
  }

  // ── 静态恢复 ──────────────────────────────────────

  /**
   * 从持久化状态恢复 WriteSession
   */
  static async restore(
    orchestrator: Orchestrator,
    pipeline: ChapterPipeline,
    bridge: SessionProjectBridge,
    dataProvider: ProjectDataProvider,
  ): Promise<WriteSession | null> {
    const projectId = orchestrator.getState().projectId;
    const savedState = await dataProvider.loadSessionState(projectId);
    if (!savedState) return null;
    if (savedState.status !== "paused" && savedState.status !== "interrupted") return null;

    logger.info(
      { sessionId: savedState.sessionId, nextChapter: savedState.nextChapter },
      "Restored write session from saved state",
    );

    return new WriteSession(orchestrator, pipeline, bridge, dataProvider, savedState);
  }

  // ── 内部工具方法 ──────────────────────────────────

  /** 解析弧段信息 */
  private async resolveArcInfo(
    projectId: string,
    chapterNumber: number,
  ): Promise<ArcBoundaryInfo> {
    const arc = await this.dataProvider.getCurrentArc(projectId);

    if (!arc) {
      return {
        currentArc: 0,
        positionInArc: 0,
        arcTotalChapters: 0,
        isLastInArc: false,
      };
    }

    const positionInArc = chapterNumber - arc.startChapter + 1;
    const isLastInArc = chapterNumber >= arc.endChapter;

    let nextArcInfo: { arcNumber: number; arcName?: string } | undefined;
    if (isLastInArc) {
      const next = await this.dataProvider.getNextArc(projectId, arc.arcNumber);
      if (next) {
        nextArcInfo = { arcNumber: next.arcNumber, arcName: next.arcName };
      }
    }

    return {
      currentArc: arc.arcNumber,
      currentArcName: arc.arcName,
      positionInArc,
      arcTotalChapters: arc.totalChapters,
      isLastInArc,
      nextArc: nextArcInfo?.arcNumber,
      nextArcName: nextArcInfo?.arcName,
    };
  }

  /** 从弧段位置推断章节类型 */
  private inferChapterType(arcInfo: ArcBoundaryInfo): ChapterType {
    if (!arcInfo.arcTotalChapters || !arcInfo.positionInArc) {
      return "normal";
    }

    const ratio = arcInfo.positionInArc / arcInfo.arcTotalChapters;

    // 最后一章通常是高潮
    if (arcInfo.isLastInArc) return "climax";
    // 弧段后 20% 是 action 密集区
    if (ratio > 0.8) return "action";
    // 弧段前 20% 通常是日常/铺垫
    if (ratio < 0.2) return "daily";
    // 弧段中段 50-70% 是情感转折区
    if (ratio > 0.5 && ratio < 0.7) return "emotional";
    // 其余为普通
    return "normal";
  }

  /** 记录章节完成结果 */
  private recordChapterResult(result: WriteChapterResult): void {
    this.chapterResults.push(result);

    if (result.success) {
      this.state.completedChapters.push(result.chapterNumber);
      this.state.stats.chaptersWritten += 1;

      // 估算字数
      const wordCount = result.content?.length ?? 0;
      this.state.stats.totalWordCount += wordCount;

      // 首次通过计数（reviewRounds === 1 表示首次通过）
      if (result.reviewRounds <= 1) {
        this.state.stats.firstPassCount += 1;
      }

      // 累加成本
      this.state.stats.totalEstimatedCost += result.cost.totalEstimatedCost;
    }
  }

  /** 构建循环统计 */
  private buildStats(startTime: number, endTime?: number): WriteLoopStats {
    const now = endTime ?? Date.now();
    const chaptersWritten = this.state.stats.chaptersWritten;
    const firstPassCount = this.state.stats.firstPassCount;

    return {
      chaptersWritten,
      targetChapters: this.state.targetChapters,
      totalWordCount: this.state.stats.totalWordCount,
      firstPassRate: chaptersWritten > 0 ? firstPassCount / chaptersWritten : 0,
      totalEstimatedCost: this.state.stats.totalEstimatedCost,
      startedAt: new Date(this.state.stats.startedAt),
      endedAt: new Date(now),
      durationSeconds: Math.round((now - startTime) / 1000),
    };
  }

  /** 更新时间戳 */
  private updateTimestamp(): void {
    this.state.updatedAt = new Date().toISOString();
  }

  /** 持久化状态 */
  private async persistState(): Promise<void> {
    try {
      await this.dataProvider.saveSessionState(this.state);
    } catch (err) {
      logger.warn({ error: err, sessionId: this.state.sessionId }, "Failed to persist session state");
    }
  }
}
