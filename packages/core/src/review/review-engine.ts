/**
 * ReviewEngine — 明镜审校引擎
 *
 * 协调三轮审校流程：
 *   Round 1: AI 味检测（纯代码，checkAntiAi）
 *   Round 2: 逻辑一致性（LLM via Bridge）
 *   Round 3: RUBRIC 文学质量（LLM via Bridge）
 *
 * 每轮结果独立汇报，最终由 judgeReviewResult() 综合判定通过/不通过。
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import type { ReviewReport } from "../events/types.js";
import { createLogger } from "../logger/index.js";
import { checkAntiAi } from "../style/anti-ai-checker.js";
import {
  buildConsistencySystemPrompt,
  buildConsistencyUserMessage,
  buildRubricSystemPrompt,
  buildRubricUserMessage,
} from "./prompts.js";
import {
  antiAiIssueToReviewIssue,
  collectAllIssues,
  createDefaultRubricScore,
  getBurstiness,
  getCompositeScore,
  judgeReviewResult,
  parseConsistencyResponse,
  parseRubricResponse,
} from "./rubric.js";
import type {
  FullReviewResult,
  ReviewEngineConfig,
  ReviewInput,
  ReviewRoundResult,
  Round1Result,
  Round2Result,
  Round3Result,
} from "./types.js";
import { DEFAULT_REVIEW_CONFIG } from "./types.js";

const logger = createLogger("review-engine");

export class ReviewEngine {
  private readonly config: ReviewEngineConfig;

  constructor(config?: Partial<ReviewEngineConfig>) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<ReviewEngineConfig> {
    return this.config;
  }

  /**
   * 执行完整三轮审校
   *
   * @param input 待审章节及上下文
   * @param bridge LLM 调用桥接（Round 2/3 需要）
   * @param onRoundComplete 每轮完成回调（用于 SSE 推送）
   */
  async review(
    input: ReviewInput,
    bridge?: SessionProjectBridge,
    onRoundComplete?: (round: ReviewRoundResult) => void,
  ): Promise<FullReviewResult> {
    const rounds: ReviewRoundResult[] = [];

    logger.info(
      { chapter: input.chapterNumber, arc: input.arcNumber },
      "Starting review",
    );

    // ── Round 1: AI 味检测 ──────────────────────────────

    const r1 = this.executeRound1(input);
    rounds.push(r1);
    onRoundComplete?.(r1);

    logger.info(
      {
        chapter: input.chapterNumber,
        burstiness: r1.antiAiCheck.burstiness,
        issueCount: r1.issues.length,
      },
      "Round 1 complete: AI 味检测",
    );

    // ── Round 2: 逻辑一致性 ──────────────────────────────

    if (this.config.enableConsistencyCheck && bridge) {
      const r2 = await this.executeRound2(input, bridge);
      rounds.push(r2);
      onRoundComplete?.(r2);

      logger.info(
        { chapter: input.chapterNumber, issueCount: r2.issues.length },
        "Round 2 complete: 逻辑一致性",
      );
    } else {
      logger.info(
        { chapter: input.chapterNumber, reason: !bridge ? "no bridge" : "disabled" },
        "Round 2 skipped",
      );
    }

    // ── Round 3: RUBRIC 文学质量 ──────────────────────────

    if (this.config.enableLiteraryCheck && bridge) {
      const r3 = await this.executeRound3(input, bridge);
      rounds.push(r3);
      onRoundComplete?.(r3);

      logger.info(
        {
          chapter: input.chapterNumber,
          score: r3.rubricScore.weightedScore,
          issueCount: r3.issues.length,
        },
        "Round 3 complete: RUBRIC 文学质量",
      );
    } else {
      logger.info(
        { chapter: input.chapterNumber, reason: !bridge ? "no bridge" : "disabled" },
        "Round 3 skipped",
      );
    }

    // ── 综合判定 ──────────────────────────────────────────

    const allIssues = collectAllIssues(rounds);
    const score = getCompositeScore(rounds);
    const burstiness = getBurstiness(rounds);
    const judgment = judgeReviewResult(allIssues, score, burstiness, this.config);

    const result: FullReviewResult = {
      passed: judgment.passed,
      score,
      burstiness,
      rounds,
      allIssues,
      failReasons: judgment.reasons,
      toReport(round: number): ReviewReport {
        return {
          round,
          passed: this.passed,
          score: this.score,
          burstiness: this.burstiness,
          issues: this.allIssues,
        };
      },
    };

    logger.info(
      {
        chapter: input.chapterNumber,
        passed: result.passed,
        score,
        burstiness,
        totalIssues: allIssues.length,
        failReasons: judgment.reasons,
      },
      "Review complete",
    );

    return result;
  }

  // ── Round 1: AI 味检测 ──────────────────────────────────

  private executeRound1(input: ReviewInput): Round1Result {
    const antiAiCheck = checkAntiAi(input.content, input.forbidden);
    const issues = antiAiCheck.issues.map(antiAiIssueToReviewIssue);

    return {
      round: 1,
      antiAiCheck,
      issues,
    };
  }

  // ── Round 2: 逻辑一致性 ──────────────────────────────────

  private async executeRound2(
    input: ReviewInput,
    bridge: SessionProjectBridge,
  ): Promise<Round2Result> {
    try {
      const systemPrompt = buildConsistencySystemPrompt();
      const userMessage = buildConsistencyUserMessage(
        input.content,
        input.chapterNumber,
        input.consistencyContext,
      );

      // 调用 Bridge 让 LLM 做一致性检查
      const response = await bridge.invokeAgent({
        agentId: "mingjing",
        message: userMessage,
        context: systemPrompt,
        stream: false,
        temperature: 0.15,
      });

      // 解析 LLM 响应
      const issues = parseConsistencyResponse(response.content);

      return {
        round: 2,
        issues: issues ?? [],
        rawResponse: response.content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, chapter: input.chapterNumber }, "Round 2 failed");

      return {
        round: 2,
        issues: [],
        rawResponse: `[ERROR] Round 2 failed: ${message}`,
      };
    }
  }

  // ── Round 3: RUBRIC 文学质量 ──────────────────────────────

  private async executeRound3(
    input: ReviewInput,
    bridge: SessionProjectBridge,
  ): Promise<Round3Result> {
    try {
      const systemPrompt = buildRubricSystemPrompt();
      const userMessage = buildRubricUserMessage(
        input.content,
        input.chapterNumber,
      );

      // 调用 Bridge 让 LLM 做 RUBRIC 评分
      const response = await bridge.invokeAgent({
        agentId: "mingjing",
        message: userMessage,
        context: systemPrompt,
        stream: false,
        temperature: 0.25,
      });

      // 解析 LLM 响应
      const parsed = parseRubricResponse(response.content);

      if (parsed) {
        return {
          round: 3,
          rubricScore: parsed.rubricScore,
          issues: parsed.issues,
          rawResponse: response.content,
        };
      }

      // 解析失败 — fallback 到默认评分
      logger.warn(
        { chapter: input.chapterNumber },
        "Failed to parse RUBRIC response, using default score",
      );

      return {
        round: 3,
        rubricScore: createDefaultRubricScore(),
        issues: [],
        rawResponse: response.content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, chapter: input.chapterNumber }, "Round 3 failed");

      return {
        round: 3,
        rubricScore: createDefaultRubricScore(),
        issues: [],
        rawResponse: `[ERROR] Round 3 failed: ${message}`,
      };
    }
  }
}
