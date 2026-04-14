/**
 * ChapterPipeline — 章节写作管道
 *
 * 将 Orchestrator（状态机）、WriterEngine（执笔）、Bridge（LLM 调用）
 * 三者整合为完整的"写下一章"流程。
 *
 * 流程：
 *   1. Orchestrator.startWriting() → 进入 writing 阶段
 *   2. WriterEngine.write() → 调用 Bridge 生成内容，流式推送 SSE
 *   3. Orchestrator.finishWriting() → 进入 reviewing 阶段
 *   4. 审校（M1.5）→ Orchestrator.submitReview()
 *   5. 通过 → Orchestrator.finishArchiving() → done
 *   6. 未通过 → 回到 step 2 重写
 *
 * M1.4 阶段：审校逻辑使用 placeholder，始终通过。
 * M1.5 将集成明镜审校系统。
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import type { StyleManager } from "../style/style-manager.js";
import type {
  ChapterType,
  WriterResult,
  WritingChunk,
} from "../style/types.js";
import { WriterEngine } from "../writer/writer-engine.js";
import type { Orchestrator } from "./orchestrator.js";
import type { WriteChapterResult } from "./types.js";

const logger = createLogger("chapter-pipeline");

/** 章节写作管道配置 */
export interface ChapterPipelineConfig {
  /** 是否启用 Anti-AI 检测 */
  antiAiCheck: boolean;
  /** 是否启用流式输出 */
  streaming: boolean;
  /** 审校是否自动通过（M1.4 placeholder） */
  autoPassReview: boolean;
}

const DEFAULT_PIPELINE_CONFIG: ChapterPipelineConfig = {
  antiAiCheck: true,
  streaming: true,
  autoPassReview: true, // M1.5 集成审校后改为 false
};

/**
 * ChapterPipeline — 章节写作管道
 *
 * 协调 Orchestrator ↔ WriterEngine ↔ Bridge 的完整写作流程
 */
export class ChapterPipeline {
  private readonly orchestrator: Orchestrator;
  private readonly writerEngine: WriterEngine;
  private readonly bridge: SessionProjectBridge;
  private readonly config: ChapterPipelineConfig;

  constructor(
    orchestrator: Orchestrator,
    styleManager: StyleManager,
    bridge: SessionProjectBridge,
    config?: Partial<ChapterPipelineConfig>,
  ) {
    this.orchestrator = orchestrator;
    this.bridge = bridge;
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
        const reviewPassed = await this.review(writerResult);

        // 提交审校结果到 Orchestrator
        const { needsRewrite, spiralTriggered } = this.orchestrator.submitReview(
          reviewPassed,
          reviewPassed ? 90 : 60, // placeholder score
        );

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
          { chapter: chapterNumber, round: reviewRounds + 1 },
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
   * M1.4: placeholder — 自动通过
   * M1.5: 集成明镜审校系统（burstiness + 逻辑一致性 + RUBRIC 文学质量）
   */
  private async review(result: WriterResult): Promise<boolean> {
    if (this.config.autoPassReview) {
      // M1.4 placeholder: 仅基于 Anti-AI 检测决定是否通过
      const passed = result.antiAiCheck.passed;

      this.orchestrator.emit({
        type: "review",
        data: {
          passed,
          report: {
            round: this.orchestrator.getState().reviewRound,
            passed,
            score: passed ? 85 : 60,
            burstiness: result.antiAiCheck.burstiness,
            issues: result.antiAiCheck.issues.map((issue) => ({
              issue: issue.description,
              severity: "minor" as const,
              evidence: issue.evidence,
            })),
          },
        },
      });

      return passed;
    }

    // TODO: M1.5 — 调用明镜审校系统
    return true;
  }

  /** 获取 WriterEngine 实例 */
  getWriterEngine(): WriterEngine {
    return this.writerEngine;
  }
}
