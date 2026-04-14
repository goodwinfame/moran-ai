/**
 * ChapterPipeline — 章节写作管道
 *
 * 将 Orchestrator（状态机）、WriterEngine（执笔）、ReviewEngine（明镜）、Bridge（LLM 调用）
 * 整合为完整的"写下一章"流程。
 *
 * 流程：
 *   1. Orchestrator.startWriting() → 进入 writing 阶段
 *   2. WriterEngine.write() → 调用 Bridge 生成内容，流式推送 SSE
 *   3. Orchestrator.finishWriting() → 进入 reviewing 阶段
 *   4. ReviewEngine.review() → 三轮审校（AI味 + 一致性 + RUBRIC）
 *   5. 通过 → Orchestrator.finishArchiving() → done
 *   6. 未通过 → 回到 step 2 重写
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import type { ReviewEngine } from "../review/review-engine.js";
import type { ConsistencyContext, FullReviewResult } from "../review/types.js";
import type { StyleManager } from "../style/style-manager.js";
import type {
  ChapterType,
  ForbiddenRules,
  WriterResult,
  WritingChunk,
} from "../style/types.js";
import { WriterEngine } from "../writer/writer-engine.js";
import type { Orchestrator } from "./orchestrator.js";
import type { WriteChapterResult } from "./types.js";
import type { SelectionResult, VersionSelectorConfig } from "./version-selector.js";
import { VersionSelector } from "./version-selector.js";

const logger = createLogger("chapter-pipeline");

/** 章节写作管道配置 */
export interface ChapterPipelineConfig {
  /** 是否启用 Anti-AI 检测 */
  antiAiCheck: boolean;
  /** 是否启用流式输出 */
  streaming: boolean;
  /** 审校是否自动通过（绕过 ReviewEngine，仅用 Anti-AI 结果） */
  autoPassReview: boolean;
  /** 多版本择优配置（null = 不启用） */
  multiVersion: Partial<VersionSelectorConfig> | null;
}

const DEFAULT_PIPELINE_CONFIG: ChapterPipelineConfig = {
  antiAiCheck: true,
  streaming: true,
  autoPassReview: false, // M1.5: 默认启用完整审校
  multiVersion: null,   // M4.1: 默认不启用多版本
};

/**
 * ChapterPipeline — 章节写作管道
 *
 * 协调 Orchestrator ↔ WriterEngine ↔ ReviewEngine ↔ Bridge 的完整写作流程
 */
export class ChapterPipeline {
  private readonly orchestrator: Orchestrator;
  private readonly writerEngine: WriterEngine;
  private readonly reviewEngine: ReviewEngine | null;
  private readonly bridge: SessionProjectBridge;
  private readonly config: ChapterPipelineConfig;

  constructor(
    orchestrator: Orchestrator,
    styleManager: StyleManager,
    bridge: SessionProjectBridge,
    reviewEngine?: ReviewEngine | null,
    config?: Partial<ChapterPipelineConfig>,
  ) {
    this.orchestrator = orchestrator;
    this.bridge = bridge;
    this.reviewEngine = reviewEngine ?? null;
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.writerEngine = new WriterEngine(styleManager, {
      antiAiCheck: this.config.antiAiCheck,
      streaming: this.config.streaming,
    });
  }

  /**
   * 执行完整的章节写作流程
   *
   * @param params 章节参数
   * @returns 写作结果
   */
  async writeChapter(params: {
    chapterNumber: number;
    arcNumber: number;
    chapterType: ChapterType;
    styleId: string;
    brief?: string;
    assembledContext?: string;
    moduleContents?: Record<string, string>;
    /** 禁忌词规则（来自风格配置，传递给审校） */
    forbidden?: ForbiddenRules;
    /** 一致性检查上下文（Round 2 需要） */
    consistencyContext?: ConsistencyContext;
    /** 是否启用多版本择优（覆盖 pipeline config） */
    multiVersion?: boolean;
  }): Promise<WriteChapterResult> {
    // 判断是否走多版本模式
    const useMultiVersion = params.multiVersion ?? this.config.multiVersion !== null;

    if (useMultiVersion && this.config.multiVersion !== null) {
      return this.writeChapterMultiVersion(params);
    }

    return this.writeChapterSingle(params);
  }

  // ── 单版本写作流程（原有逻辑） ──────────────────────

  private async writeChapterSingle(params: {
    chapterNumber: number;
    arcNumber: number;
    chapterType: ChapterType;
    styleId: string;
    brief?: string;
    assembledContext?: string;
    moduleContents?: Record<string, string>;
    forbidden?: ForbiddenRules;
    consistencyContext?: ConsistencyContext;
  }): Promise<WriteChapterResult> {
    const { chapterNumber, arcNumber } = params;
    const state = this.orchestrator.getState();

    logger.info(
      { chapter: chapterNumber, arc: arcNumber, project: state.projectId },
      "Chapter pipeline starting",
    );

    try {
      // Phase 1: 开始写作
      this.orchestrator.startWriting(chapterNumber, arcNumber);

      // Phase 2: 执笔写作（可能多轮）
      let writerResult: WriterResult | null = null;
      let reviewRounds = 0;
      let spiralInterrupted = false;
      let lastReviewResult: FullReviewResult | null = null;

      // 写作-审校循环
      while (!spiralInterrupted) {
        // 准备上下文
        const context = this.writerEngine.prepareContext({
          projectId: state.projectId,
          chapterNumber: params.chapterNumber,
          arcNumber: params.arcNumber,
          chapterType: params.chapterType,
          styleId: params.styleId,
          brief: params.brief,
          assembledContext: params.assembledContext,
          moduleContents: params.moduleContents,
        });

        // 调用执笔 — 流式 chunk 通过 SSE 推送
        writerResult = await this.writerEngine.write(
          context,
          this.bridge,
          (chunk: WritingChunk) => {
            this.orchestrator.emit({
              type: "writing",
              data: { chunk: chunk.text, wordCount: chunk.cumulativeWordCount },
            });
          },
        );

        // 追踪成本
        this.orchestrator.trackCost(
          "zhibi",
          writerResult.usage.inputTokens,
          writerResult.usage.outputTokens,
        );

        // Phase 3: 进入审校
        this.orchestrator.finishWriting();
        reviewRounds += 1;

        // Phase 4: 审校逻辑
        const reviewResult = await this.review(writerResult, params);

        // 提交审校结果到 Orchestrator
        const { needsRewrite, spiralTriggered } = this.orchestrator.submitReview(
          reviewResult.passed,
          reviewResult.score,
        );

        lastReviewResult = reviewResult;

        if (spiralTriggered) {
          spiralInterrupted = true;
          break;
        }

        if (!needsRewrite) {
          // 审校通过 → 归档
          this.orchestrator.finishArchiving();
          break;
        }

        // 需要重写 — Orchestrator 已回到 writing phase
        logger.info(
          {
            chapter: chapterNumber,
            round: reviewRounds + 1,
            failReasons: reviewResult.failReasons,
          },
          "Rewriting chapter after review failure",
        );
      }

      // 汇总结果
      const cost = this.orchestrator.getCostSummary();

      return {
        success: !spiralInterrupted && writerResult !== null,
        chapterNumber,
        content: writerResult?.content,
        reviewRounds,
        spiralInterrupted,
        lastReview: lastReviewResult ?? undefined,
        cost,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, chapter: chapterNumber }, "Chapter pipeline failed");

      // 中止 orchestrator
      this.orchestrator.abort(`Pipeline error: ${message}`);

      return {
        success: false,
        chapterNumber,
        reviewRounds: 0,
        spiralInterrupted: false,
        cost: this.orchestrator.getCostSummary(),
        error: message,
      };
    }
  }

  /**
   * 审校章节
   *
   * autoPassReview=true: 仅基于 Anti-AI 检测决定是否通过（快速模式）
   * autoPassReview=false: 调用 ReviewEngine 完整三轮审校
   */
  private async review(
    result: WriterResult,
    params: {
      chapterNumber: number;
      arcNumber: number;
      forbidden?: ForbiddenRules;
      consistencyContext?: ConsistencyContext;
    },
  ): Promise<FullReviewResult> {
    if (this.config.autoPassReview || !this.reviewEngine) {
      // 快速模式: 仅基于 Anti-AI 检测决定是否通过
      return this.quickReview(result);
    }

    // 完整审校: ReviewEngine 三轮审校
    const reviewResult = await this.reviewEngine.review(
      {
        content: result.content,
        chapterNumber: params.chapterNumber,
        arcNumber: params.arcNumber,
        forbidden: params.forbidden,
        consistencyContext: params.consistencyContext,
      },
      this.bridge,
      (roundResult) => {
        // 每轮完成时推送 SSE reviewing 事件
        this.orchestrator.emit({
          type: "reviewing",
          data: { round: roundResult.round },
        });
      },
    );

    // 追踪明镜的成本（Round 2 + Round 3 各一次 LLM 调用）
    // 实际 token 数由 Bridge placeholder 返回 0，真正集成后会有实际值
    this.orchestrator.trackCost("mingjing", 0, 0);

    // 推送最终审校报告 SSE
    this.orchestrator.emit({
      type: "review",
      data: {
        passed: reviewResult.passed,
        report: reviewResult.toReport(this.orchestrator.getState().reviewRound),
      },
    });

    return reviewResult;
  }

  /**
   * 快速审校（autoPassReview 模式）
   *
   * 不调用 LLM，仅基于 Anti-AI 检测结果判定
   */
  private quickReview(result: WriterResult): FullReviewResult {
    const passed = result.antiAiCheck.passed;

    const reviewResult: FullReviewResult = {
      passed,
      score: passed ? 85 : 60,
      burstiness: result.antiAiCheck.burstiness,
      rounds: [],
      allIssues: result.antiAiCheck.issues.map((issue) => ({
        issue: issue.description,
        severity: "minor" as const,
        evidence: issue.evidence,
      })),
      failReasons: passed ? [] : ["Anti-AI 检测不通过"],
      toReport(round: number) {
        return {
          round,
          passed: this.passed,
          score: this.score,
          burstiness: this.burstiness,
          issues: this.allIssues,
        };
      },
    };

    this.orchestrator.emit({
      type: "review",
      data: {
        passed,
        report: reviewResult.toReport(this.orchestrator.getState().reviewRound),
      },
    });

    return reviewResult;
  }

  /** 获取 WriterEngine 实例 */
  getWriterEngine(): WriterEngine {
    return this.writerEngine;
  }

  /** 获取 ReviewEngine 实例 */
  getReviewEngine(): ReviewEngine | null {
    return this.reviewEngine;
  }

  // ── 多版本写作流程 (M4.1) ──────────────────────────────

  /**
   * 多版本择优写作流程
   *
   * 1. startWriting → writing phase
   * 2. VersionSelector.selectBest → 生成 N 版本各自审校
   * 3. 选出最优版本 → finishArchiving
   */
  private async writeChapterMultiVersion(params: {
    chapterNumber: number;
    arcNumber: number;
    chapterType: ChapterType;
    styleId: string;
    brief?: string;
    assembledContext?: string;
    moduleContents?: Record<string, string>;
    forbidden?: ForbiddenRules;
    consistencyContext?: ConsistencyContext;
  }): Promise<WriteChapterResult> {
    const { chapterNumber, arcNumber } = params;
    const state = this.orchestrator.getState();

    logger.info(
      { chapter: chapterNumber, arc: arcNumber, project: state.projectId },
      "Chapter pipeline starting (multi-version mode)",
    );

    try {
      // Phase 1: 开始写作
      this.orchestrator.startWriting(chapterNumber, arcNumber);

      // Phase 2: 多版本择优
      const selector = new VersionSelector(
        this.writerEngine.getStyleManager(),
        this.bridge,
        this.reviewEngine,
        this.config.multiVersion ?? undefined,
      );

      const selectionResult: SelectionResult = await selector.selectBest({
        projectId: state.projectId,
        chapterNumber: params.chapterNumber,
        arcNumber: params.arcNumber,
        chapterType: params.chapterType,
        styleId: params.styleId,
        brief: params.brief,
        assembledContext: params.assembledContext,
        moduleContents: params.moduleContents,
        forbidden: params.forbidden,
        consistencyContext: params.consistencyContext,
      });

      // 推送最终选中版本的内容
      this.orchestrator.emit({
        type: "writing",
        data: {
          chunk: selectionResult.selected.content,
          wordCount: selectionResult.selected.wordCount,
        },
      });

      // 追踪所有版本的成本
      for (const candidate of selectionResult.candidates) {
        this.orchestrator.trackCost(
          "zhibi",
          candidate.writerResult.usage.inputTokens,
          candidate.writerResult.usage.outputTokens,
        );
      }

      // Phase 3: 提交审校结果
      this.orchestrator.finishWriting();
      this.orchestrator.submitReview(
        selectionResult.selected.passed,
        selectionResult.selected.score,
      );

      // Phase 4: 归档
      this.orchestrator.finishArchiving();

      // 推送审校报告
      if (selectionResult.selected.reviewResult) {
        this.orchestrator.emit({
          type: "review",
          data: {
            passed: selectionResult.selected.passed,
            report: selectionResult.selected.reviewResult.toReport(1),
          },
        });
      }

      // 汇总结果
      const cost = this.orchestrator.getCostSummary();

      return {
        success: selectionResult.hasPassingVersion,
        chapterNumber,
        content: selectionResult.selected.content,
        reviewRounds: selectionResult.totalVersions,
        spiralInterrupted: false,
        lastReview: selectionResult.selected.reviewResult ?? undefined,
        cost,
        multiVersionResult: selectionResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, chapter: chapterNumber }, "Multi-version pipeline failed");

      this.orchestrator.abort(`Multi-version pipeline error: ${message}`);

      return {
        success: false,
        chapterNumber,
        reviewRounds: 0,
        spiralInterrupted: false,
        cost: this.orchestrator.getCostSummary(),
        error: message,
      };
    }
  }
}
