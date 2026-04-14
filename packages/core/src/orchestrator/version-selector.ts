/**
 * VersionSelector — 多版本择优引擎
 *
 * M4.1: 生成同一章节的 N 个版本，各自独立审校，选出最优版本。
 *
 * 策略：
 * 1. 多温度策略：每个版本使用不同的 temperature（微调 ±0.05~0.1）
 * 2. 独立审校：每个版本各自经过 ReviewEngine 三轮审校
 * 3. 评分排序：按综合分降序，相同分数看 burstiness
 * 4. 人工兜底：若所有版本均不通过，保留最高分版本供人工选择
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import type { ReviewEngine } from "../review/review-engine.js";
import type {
  ConsistencyContext,
  FullReviewResult,
} from "../review/types.js";
import type {
  ChapterType,
  ForbiddenRules,
  WritingChunk,
} from "../style/types.js";
import { WriterEngine } from "../writer/writer-engine.js";
import type { StyleManager } from "../style/style-manager.js";
import type { WriterResult } from "../style/types.js";

const logger = createLogger("version-selector");

// ── 类型定义 ──────────────────────────────────────────

/** 版本候选 */
export interface VersionCandidate {
  /** 版本序号（从 1 开始） */
  versionIndex: number;
  /** 生成内容 */
  content: string;
  /** 字数 */
  wordCount: number;
  /** 使用的 temperature */
  temperature: number;
  /** 写作结果 */
  writerResult: WriterResult;
  /** 审校结果（可能为 null 如果审校被跳过） */
  reviewResult: FullReviewResult | null;
  /** 综合分（审校分 or Anti-AI 代替分） */
  score: number;
  /** 是否通过审校 */
  passed: boolean;
}

/** 多版本择优结果 */
export interface SelectionResult {
  /** 是否有版本通过审校 */
  hasPassingVersion: boolean;
  /** 选中的最优版本 */
  selected: VersionCandidate;
  /** 所有候选版本（按分数降序） */
  candidates: VersionCandidate[];
  /** 生成版本数 */
  totalVersions: number;
  /** 通过审校的版本数 */
  passingVersions: number;
}

/** VersionSelector 配置 */
export interface VersionSelectorConfig {
  /** 生成版本数量 (2-5) */
  versionCount: number;
  /** 温度扰动范围 — 基础温度 ± perturbation */
  temperaturePerturbation: number;
  /** 是否并行生成（true 时同时发起 N 个 LLM 调用） */
  parallel: boolean;
  /** 是否跳过审校（仅用 Anti-AI 分数排序） */
  skipFullReview: boolean;
}

export const DEFAULT_VERSION_SELECTOR_CONFIG: VersionSelectorConfig = {
  versionCount: 3,
  temperaturePerturbation: 0.08,
  parallel: false, // 默认串行，减少同时 token 消耗
  skipFullReview: false,
};

/** 版本生成参数 */
export interface VersionGenerateParams {
  projectId: string;
  chapterNumber: number;
  arcNumber: number;
  chapterType: ChapterType;
  styleId: string;
  brief?: string;
  assembledContext?: string;
  moduleContents?: Record<string, string>;
  forbidden?: ForbiddenRules;
  consistencyContext?: ConsistencyContext;
}

// ── 进度回调 ──────────────────────────────────────────

/** 版本进度信息 */
export interface VersionProgress {
  versionIndex: number;
  totalVersions: number;
  phase: "writing" | "reviewing" | "done";
  score?: number;
  passed?: boolean;
}

/** 版本选择通知 */
export interface VersionSelectedInfo {
  selectedIndex: number;
  totalVersions: number;
  passingVersions: number;
  selectedScore: number;
}

/** 进度回调 */
export type VersionProgressCallback = (progress: VersionProgress) => void;

/** 选择完成回调 */
export type VersionSelectedCallback = (info: VersionSelectedInfo) => void;

// ── SSE 事件类型（用于前端） ──────────────────────────────

/** 多版本进度 SSE 事件 */
export interface VersionProgressEvent {
  type: "version_progress";
  data: VersionProgress;
}

/** 多版本选择 SSE 事件 */
export interface VersionSelectedEvent {
  type: "version_selected";
  data: VersionSelectedInfo;
}

// ── 核心引擎 ──────────────────────────────────────────

/**
 * VersionSelector — 多版本择优引擎
 */
export class VersionSelector {
  private readonly writerEngine: WriterEngine;
  private readonly reviewEngine: ReviewEngine | null;
  private readonly bridge: SessionProjectBridge;
  private readonly config: VersionSelectorConfig;
  private readonly onProgress: VersionProgressCallback | null;
  private readonly onSelected: VersionSelectedCallback | null;

  constructor(
    styleManager: StyleManager,
    bridge: SessionProjectBridge,
    reviewEngine?: ReviewEngine | null,
    config?: Partial<VersionSelectorConfig>,
    onProgress?: VersionProgressCallback | null,
    onSelected?: VersionSelectedCallback | null,
  ) {
    this.bridge = bridge;
    this.reviewEngine = reviewEngine ?? null;
    this.config = { ...DEFAULT_VERSION_SELECTOR_CONFIG, ...config };
    this.onProgress = onProgress ?? null;
    this.onSelected = onSelected ?? null;
    this.writerEngine = new WriterEngine(styleManager, {
      antiAiCheck: true,
      streaming: true,
    });

    // 校验配置
    if (this.config.versionCount < 2 || this.config.versionCount > 5) {
      logger.warn(
        { versionCount: this.config.versionCount },
        "Version count out of recommended range (2-5), clamping",
      );
      this.config.versionCount = Math.max(2, Math.min(5, this.config.versionCount));
    }
  }

  /**
   * 执行多版本择优流程
   *
   * @param params 章节参数
   * @returns 择优结果
   */
  async selectBest(params: VersionGenerateParams): Promise<SelectionResult> {
    const { chapterNumber, arcNumber } = params;
    const temperatures = this.calculateTemperatures(params.styleId, params.chapterType);

    logger.info(
      {
        chapter: chapterNumber,
        arc: arcNumber,
        versions: this.config.versionCount,
        temperatures,
      },
      "Multi-version selection starting",
    );

    // 生成所有版本
    const candidates: VersionCandidate[] = this.config.parallel
      ? await this.generateParallel(params, temperatures)
      : await this.generateSequential(params, temperatures);

    // 按分数降序排序；分数相同看 burstiness
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aBurst = a.reviewResult?.burstiness ?? 0;
      const bBurst = b.reviewResult?.burstiness ?? 0;
      return bBurst - aBurst;
    });

    const passingVersions = candidates.filter((c) => c.passed).length;
    const selected = candidates[0];
    if (!selected) {
      throw new Error("No candidates generated");
    }

    // 通知选择完成
    if (this.onSelected) {
      this.onSelected({
        selectedIndex: selected.versionIndex,
        totalVersions: candidates.length,
        passingVersions,
        selectedScore: selected.score,
      });
    }

    logger.info(
      {
        chapter: chapterNumber,
        selectedVersion: selected.versionIndex,
        selectedScore: selected.score,
        selectedPassed: selected.passed,
        passingVersions,
        totalVersions: candidates.length,
      },
      "Multi-version selection completed",
    );

    return {
      hasPassingVersion: passingVersions > 0,
      selected,
      candidates,
      totalVersions: candidates.length,
      passingVersions,
    };
  }

  // ── 内部实现 ──────────────────────────────────────────

  /**
   * 计算各版本的 temperature
   *
   * 以风格配置的基础 temperature 为中心，加减扰动
   */
  private calculateTemperatures(styleId: string, chapterType: ChapterType): number[] {
    const baseTemp = this.writerEngine.getStyleManager().calculateTemperature(styleId, chapterType);
    const n = this.config.versionCount;
    const step = this.config.temperaturePerturbation;

    if (n === 1) return [baseTemp];

    const temps: number[] = [];
    for (let i = 0; i < n; i++) {
      // 均匀分布在 [base - step, base + step]
      const offset = n === 1 ? 0 : (i / (n - 1)) * 2 * step - step;
      const temp = Math.max(0.1, Math.min(1.5, baseTemp + offset));
      // 精确到小数点后 3 位
      temps.push(Math.round(temp * 1000) / 1000);
    }

    return temps;
  }

  /** 串行生成所有版本 */
  private async generateSequential(
    params: VersionGenerateParams,
    temperatures: number[],
  ): Promise<VersionCandidate[]> {
    const candidates: VersionCandidate[] = [];

    for (let i = 0; i < temperatures.length; i++) {
      const temp = temperatures[i];
      if (temp === undefined) continue;
      const candidate = await this.generateOne(params, i + 1, temp);
      candidates.push(candidate);
    }

    return candidates;
  }

  /** 并行生成所有版本 */
  private async generateParallel(
    params: VersionGenerateParams,
    temperatures: number[],
  ): Promise<VersionCandidate[]> {
    const promises = temperatures.map((temp, i) =>
      this.generateOne(params, i + 1, temp),
    );
    return Promise.all(promises);
  }

  /** 生成单个版本（写作 + 审校） */
  private async generateOne(
    params: VersionGenerateParams,
    versionIndex: number,
    temperature: number,
  ): Promise<VersionCandidate> {
    logger.info(
      { version: versionIndex, temperature, chapter: params.chapterNumber },
      "Generating version",
    );

    // 推送写作进度
    this.emitProgress(versionIndex, "writing");

    // 1. 准备上下文
    const context = this.writerEngine.prepareContext({
      projectId: params.projectId,
      chapterNumber: params.chapterNumber,
      arcNumber: params.arcNumber,
      chapterType: params.chapterType,
      styleId: params.styleId,
      brief: params.brief,
      assembledContext: params.assembledContext,
      moduleContents: params.moduleContents,
    });

    // 覆盖温度
    context.temperature = temperature;

    // 2. 写作
    const writerResult = await this.writerEngine.write(
      context,
      this.bridge,
      (_chunk: WritingChunk) => {
        // 多版本模式下 chunk 不推送到 SSE（避免混乱），仅做内部记录
      },
    );

    // 3. 审校
    this.emitProgress(versionIndex, "reviewing");

    let reviewResult: FullReviewResult | null = null;
    let score = 0;
    let passed = false;

    if (!this.config.skipFullReview && this.reviewEngine) {
      // 完整审校
      reviewResult = await this.reviewEngine.review(
        {
          content: writerResult.content,
          chapterNumber: params.chapterNumber,
          arcNumber: params.arcNumber,
          forbidden: params.forbidden,
          consistencyContext: params.consistencyContext,
        },
        this.bridge,
      );
      score = reviewResult.score;
      passed = reviewResult.passed;
    } else {
      // 快速审校：仅用 Anti-AI 分数
      score = writerResult.antiAiCheck.passed ? 80 + writerResult.antiAiCheck.burstiness * 20 : 50;
      passed = writerResult.antiAiCheck.passed;
    }

    // 推送完成进度
    this.emitProgress(versionIndex, "done", score, passed);

    logger.info(
      {
        version: versionIndex,
        temperature,
        wordCount: writerResult.wordCount,
        score,
        passed,
      },
      "Version generated",
    );

    return {
      versionIndex,
      content: writerResult.content,
      wordCount: writerResult.wordCount,
      temperature,
      writerResult,
      reviewResult,
      score,
      passed,
    };
  }

  // ── 进度通知 ──────────────────────────────────────────

  private emitProgress(
    versionIndex: number,
    phase: "writing" | "reviewing" | "done",
    score?: number,
    passed?: boolean,
  ): void {
    if (!this.onProgress) return;
    this.onProgress({
      versionIndex,
      totalVersions: this.config.versionCount,
      phase,
      score,
      passed,
    });
  }
}
