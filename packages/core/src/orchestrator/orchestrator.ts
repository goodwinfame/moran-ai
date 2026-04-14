/**
 * Orchestrator — 墨衡编排器
 *
 * 管理写作全流程的六阶段状态机：
 *   idle -> writing -> reviewing -> archiving -> idle (循环)
 *
 * 集成：
 * - SpiralDetector：审校 >3 轮自动中断
 * - CostTracker：token 消耗统计
 * - EventBus：SSE 事件推送
 *
 * 注意：本模块不直接调用 LLM。它管理状态和流程，
 * 实际的 Agent 调用由 Session-Project Bridge 层处理（M1.4+）。
 */

import type { AgentId } from "../agents/types.js";
import { EventBus } from "../events/event-bus.js";
import type { SSEEvent } from "../events/types.js";
import { createLogger } from "../logger/index.js";
import { SpiralDetector } from "../unm/spiral-detector.js";
import { CostTracker } from "./cost-tracker.js";
import type {
  ChapterCostSummary,
  OrchestratorConfig,
  OrchestratorPhase,
  OrchestratorState,
} from "./types.js";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "./types.js";

export class Orchestrator {
  private state: OrchestratorState;
  private readonly config: OrchestratorConfig;
  private readonly eventBus: EventBus;
  private readonly spiralDetector: SpiralDetector;
  private readonly costTracker: CostTracker;
  private readonly logger = createLogger("orchestrator");
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    projectId: string,
    config?: Partial<OrchestratorConfig>,
    eventBus?: EventBus,
  ) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.eventBus = eventBus ?? new EventBus();
    this.spiralDetector = new SpiralDetector();
    this.costTracker = new CostTracker();

    this.state = {
      phase: "idle",
      projectId,
      currentChapter: 0,
      currentArc: 0,
      reviewRound: 0,
      paused: false,
      aborted: false,
      lastActivity: new Date(),
    };
  }

  // ── 状态查询 ──────────────────────────────────────────

  /** 获取当前编排器状态（只读副本） */
  getState(): Readonly<OrchestratorState> {
    return { ...this.state };
  }

  /** 获取 EventBus 实例（供 SSE 路由订阅） */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /** 获取当前阶段 */
  get phase(): OrchestratorPhase {
    return this.state.phase;
  }

  /** 是否暂停 */
  get isPaused(): boolean {
    return this.state.paused;
  }

  // ── 阶段控制 ──────────────────────────────────────────

  /**
   * 转换阶段 — 内部状态机
   */
  private transition(phase: OrchestratorPhase): void {
    const prev = this.state.phase;
    this.state.phase = phase;
    this.state.lastActivity = new Date();
    this.logger.info({ from: prev, to: phase, projectId: this.state.projectId }, "Phase transition");
  }

  /**
   * 开始写章节 — 进入 writing 阶段
   */
  startWriting(chapterNumber: number, arcNumber: number): void {
    if (this.state.phase !== "idle") {
      throw new Error(`Cannot start writing in phase "${this.state.phase}"`);
    }
    this.state.currentChapter = chapterNumber;
    this.state.currentArc = arcNumber;
    this.state.reviewRound = 0;
    this.state.paused = false;
    this.state.aborted = false;
    this.costTracker.reset();
    this.transition("writing");
    this.startHeartbeat();
  }

  /**
   * 标记写作完成，进入审校阶段
   */
  finishWriting(): void {
    if (this.state.phase !== "writing") {
      throw new Error(`Cannot finish writing in phase "${this.state.phase}"`);
    }
    this.state.reviewRound = 1;
    this.transition("reviewing");
    this.emit({ type: "reviewing", data: { round: 1 } });
  }

  /**
   * 提交审校结果
   * @returns 是否需要重写（审校未通过且未触发螺旋保护）
   */
  submitReview(passed: boolean, _score: number): { needsRewrite: boolean; spiralTriggered: boolean } {
    if (this.state.phase !== "reviewing") {
      throw new Error(`Cannot submit review in phase "${this.state.phase}"`);
    }

    // 检查螺旋保护
    const spiral = this.spiralDetector.detectReviewSpiral(
      `${this.state.projectId}-ch${this.state.currentChapter}`,
      this.state.reviewRound,
    );

    if (spiral) {
      this.logger.warn({ spiral, chapter: this.state.currentChapter }, "Review spiral detected");
      this.emit({
        type: "error",
        data: {
          message: `Chapter ${this.state.currentChapter} review spiral: ${this.state.reviewRound} rounds exceeded limit`,
          recoverable: true,
          code: "REVIEW_SPIRAL",
        },
      });
      this.state.aborted = true;
      this.transition("idle");
      this.stopHeartbeat();
      return { needsRewrite: false, spiralTriggered: true };
    }

    if (passed) {
      this.transition("archiving");
      this.emit({ type: "archiving", data: { chapterNumber: this.state.currentChapter } });
      return { needsRewrite: false, spiralTriggered: false };
    }

    // 未通过 — 返回写作阶段
    this.state.reviewRound += 1;
    this.transition("writing");
    return { needsRewrite: true, spiralTriggered: false };
  }

  /**
   * 标记归档完成
   */
  finishArchiving(): void {
    if (this.state.phase !== "archiving") {
      throw new Error(`Cannot finish archiving in phase "${this.state.phase}"`);
    }

    const chapterNumber = this.state.currentChapter;
    this.emit({ type: "done", data: { projectId: this.state.projectId, chapterNumber } });
    this.transition("idle");
    this.stopHeartbeat();

    this.logger.info(
      { chapter: chapterNumber, cost: this.costTracker.summarize(chapterNumber) },
      "Chapter completed",
    );
  }

  // ── 暂停 / 继续 / 中止 ─────────────────────────────────

  /** 暂停编排 */
  pause(): void {
    if (this.state.paused) return;
    this.state.paused = true;
    this.state.lastActivity = new Date();
    this.logger.info({ phase: this.state.phase }, "Orchestrator paused");
  }

  /** 恢复编排 */
  resume(): void {
    if (!this.state.paused) return;
    this.state.paused = false;
    this.state.lastActivity = new Date();
    this.logger.info({ phase: this.state.phase }, "Orchestrator resumed");
  }

  /** 中止当前任务 */
  abort(reason: string): void {
    this.state.aborted = true;
    this.emit({
      type: "error",
      data: { message: `Orchestrator aborted: ${reason}`, recoverable: false, code: "ABORTED" },
    });
    this.transition("idle");
    this.stopHeartbeat();
    this.logger.warn({ reason }, "Orchestrator aborted");
  }

  // ── 成本追踪 ──────────────────────────────────────────

  /** 记录 Agent 的 token 消耗 */
  trackCost(agentId: AgentId, inputTokens: number, outputTokens: number, model?: string): void {
    if (!this.config.costTracking) return;
    this.costTracker.record(agentId, this.state.phase, inputTokens, outputTokens, model);
  }

  /** 获取当前章节的成本汇总 */
  getCostSummary(): ChapterCostSummary {
    return this.costTracker.summarize(this.state.currentChapter);
  }

  // ── SSE 事件 ──────────────────────────────────────────

  /** 发布 SSE 事件 */
  emit(event: SSEEvent): void {
    this.eventBus.emit(this.state.projectId, event);
  }

  /** 订阅 SSE 事件（供 API 路由使用） */
  subscribe(listener: (event: SSEEvent) => void): () => void {
    return this.eventBus.subscribe(this.state.projectId, listener);
  }

  // ── 心跳 ──────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.emit({ type: "heartbeat", data: { ts: Date.now() } });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── 清理 ──────────────────────────────────────────────

  /** 销毁编排器，清理所有资源 */
  dispose(): void {
    this.stopHeartbeat();
    this.eventBus.removeAll(this.state.projectId);
  }
}
