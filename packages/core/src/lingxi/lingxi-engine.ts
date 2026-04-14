/**
 * LingxiEngine — 灵犀创意脑暴引擎
 *
 * 四阶段创意流程：
 *   1. 发散：生成 5+ 个差异化概念方案
 *   2. 推演：What-if 极端推演（可选）
 *   3. 聚焦：收敛至 2-3 个最佳方案
 *   4. 结晶：输出结构化创意简报
 *
 * 每个阶段独立调用 LLM（通过 Bridge），中间结果可以通过回调推送到 SSE。
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import {
  buildConvergencePrompt,
  buildCrystallizationPrompt,
  buildDivergencePrompt,
  buildWhatIfPrompt,
  LINGXI_SYSTEM_PROMPT,
} from "./prompts.js";
import type {
  BrainstormInput,
  BrainstormResult,
  ConceptProposal,
  ConvergenceResult,
  CreativeBrief,
  DivergenceResult,
  LingxiEngineConfig,
} from "./types.js";
import { DEFAULT_LINGXI_CONFIG } from "./types.js";

const logger = createLogger("lingxi-engine");

/** 阶段进度回调 */
export interface BrainstormProgress {
  stage: "divergence" | "whatif" | "convergence" | "crystallization";
  message: string;
}

/**
 * LingxiEngine — 灵犀创意脑暴引擎
 */
export class LingxiEngine {
  private readonly config: LingxiEngineConfig;

  constructor(config?: Partial<LingxiEngineConfig>) {
    this.config = { ...DEFAULT_LINGXI_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<LingxiEngineConfig> {
    return this.config;
  }

  /**
   * 执行完整四阶段创意脑暴
   *
   * @param input 脑暴输入（关键词、偏好等）
   * @param bridge LLM 调用桥接
   * @param onProgress 阶段进度回调（用于 SSE）
   */
  async brainstorm(
    input: BrainstormInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: BrainstormProgress) => void,
  ): Promise<BrainstormResult> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    logger.info({ keywords: input.keywords, projectId: input.projectId }, "Starting brainstorm");

    // ── Stage 1: 发散 ──────────────────────────────

    onProgress?.({
      stage: "divergence",
      message: `正在发散创意，目标 ${this.config.minConcepts}+ 个方案…`,
    });

    const divergence = await this.diverge(input, bridge);
    totalInputTokens += divergence.usage.inputTokens;
    totalOutputTokens += divergence.usage.outputTokens;

    logger.info(
      { conceptCount: divergence.result.concepts.length },
      "Divergence complete",
    );

    // ── Stage 2: What-if 推演（可选） ────────────────

    let enrichedConcepts = divergence.result.concepts;

    if (this.config.enableWhatIf) {
      onProgress?.({
        stage: "whatif",
        message: `正在进行 What-if 极端推演…`,
      });

      const whatIfResult = await this.whatIf(enrichedConcepts, input, bridge);
      enrichedConcepts = whatIfResult.concepts;
      totalInputTokens += whatIfResult.usage.inputTokens;
      totalOutputTokens += whatIfResult.usage.outputTokens;

      logger.info("What-if extrapolation complete");
    }

    // ── Stage 3: 聚焦 ──────────────────────────────

    onProgress?.({
      stage: "convergence",
      message: `正在从 ${enrichedConcepts.length} 个方案中聚焦至 ${this.config.finalCandidates} 个…`,
    });

    const convergence = await this.converge(enrichedConcepts, input, bridge);
    totalInputTokens += convergence.usage.inputTokens;
    totalOutputTokens += convergence.usage.outputTokens;

    logger.info(
      { selectedCount: convergence.result.selectedConcepts.length },
      "Convergence complete",
    );

    // ── Stage 4: 结晶 ──────────────────────────────

    onProgress?.({
      stage: "crystallization",
      message: "正在结晶创意简报…",
    });

    const brief = await this.crystallize(convergence.result.selectedConcepts, input, bridge);
    totalInputTokens += brief.usage.inputTokens;
    totalOutputTokens += brief.usage.outputTokens;

    logger.info("Crystallization complete — creative brief ready");

    return {
      brief: brief.result,
      totalConceptsGenerated: divergence.result.concepts.length,
      selectedCount: convergence.result.selectedConcepts.length,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  }

  // ── 内部阶段方法 ──────────────────────────────────

  /**
   * Stage 1: 发散
   */
  async diverge(
    input: BrainstormInput,
    bridge: SessionProjectBridge,
  ): Promise<{ result: DivergenceResult; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildDivergencePrompt(input, this.config.minConcepts);

    const response = await bridge.invokeAgent({
      agentId: "lingxi",
      message: prompt,
      context: LINGXI_SYSTEM_PROMPT,
    });

    const concepts = parseDivergenceResponse(response.content);

    return {
      result: {
        concepts,
        rawOutput: response.content,
      },
      usage: response.usage,
    };
  }

  /**
   * Stage 2: What-if 推演
   */
  async whatIf(
    concepts: ConceptProposal[],
    input: BrainstormInput,
    bridge: SessionProjectBridge,
  ): Promise<{ concepts: ConceptProposal[]; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildWhatIfPrompt(concepts);

    const response = await bridge.invokeAgent({
      agentId: "lingxi",
      sessionId: `lingxi-${input.projectId}`,
      message: prompt,
      context: LINGXI_SYSTEM_PROMPT,
    });

    const enriched = parseConceptArray(response.content, concepts);

    return {
      concepts: enriched,
      usage: response.usage,
    };
  }

  /**
   * Stage 3: 聚焦
   */
  async converge(
    concepts: ConceptProposal[],
    input: BrainstormInput,
    bridge: SessionProjectBridge,
  ): Promise<{ result: ConvergenceResult; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildConvergencePrompt(concepts, this.config.finalCandidates);

    const response = await bridge.invokeAgent({
      agentId: "lingxi",
      sessionId: `lingxi-${input.projectId}`,
      message: prompt,
      context: LINGXI_SYSTEM_PROMPT,
    });

    const convergence = parseConvergenceResponse(response.content);

    return {
      result: convergence,
      usage: response.usage,
    };
  }

  /**
   * Stage 4: 结晶
   */
  async crystallize(
    selectedConcepts: ConceptProposal[],
    input: BrainstormInput,
    bridge: SessionProjectBridge,
  ): Promise<{ result: CreativeBrief; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildCrystallizationPrompt(selectedConcepts, input);

    const response = await bridge.invokeAgent({
      agentId: "lingxi",
      sessionId: `lingxi-${input.projectId}`,
      message: prompt,
      context: LINGXI_SYSTEM_PROMPT,
    });

    const brief = parseBriefResponse(response.content, selectedConcepts);

    return {
      result: brief,
      usage: response.usage,
    };
  }
}

// ── JSON 解析辅助 ──────────────────────────────────────

/**
 * 从 LLM 输出中提取 JSON
 *
 * 处理可能包含 markdown 代码块或前后文字的情况
 */
export function extractJson(raw: string): string {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(raw);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // 尝试找到第一个 [ 或 { 到最后一个 ] 或 }
  const firstBracket = raw.search(/[{[]/);
  const lastBracket = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return raw.slice(firstBracket, lastBracket + 1);
  }

  return raw.trim();
}

/** 解析发散阶段响应 — 概念方案数组 */
export function parseDivergenceResponse(raw: string): ConceptProposal[] {
  try {
    const json = extractJson(raw);
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      logger.warn("Divergence response is not an array, wrapping");
      return [toConceptProposal(parsed)];
    }
    return parsed.map((item: unknown) => toConceptProposal(item));
  } catch (error) {
    logger.warn({ error }, "Failed to parse divergence response, creating fallback");
    return [{
      name: "解析失败方案",
      premise: raw.slice(0, 200),
      whatIf: "",
      risk: "LLM 输出格式异常",
      uniqueHook: "待重新生成",
    }];
  }
}

/** 解析概念方案数组（带 fallback） */
export function parseConceptArray(raw: string, fallback: ConceptProposal[]): ConceptProposal[] {
  try {
    const json = extractJson(raw);
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map((item: unknown) => toConceptProposal(item));
  } catch {
    logger.warn("Failed to parse concept array, using fallback");
    return fallback;
  }
}

/** 解析聚焦阶段响应 */
export function parseConvergenceResponse(raw: string): ConvergenceResult {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const selected = Array.isArray(parsed.selectedConcepts)
      ? (parsed.selectedConcepts as unknown[]).map((item: unknown) => toConceptProposal(item))
      : [];
    return {
      selectedConcepts: selected,
      selectionReasoning: typeof parsed.selectionReasoning === "string"
        ? parsed.selectionReasoning
        : "",
      rawOutput: raw,
    };
  } catch {
    logger.warn("Failed to parse convergence response, returning empty");
    return {
      selectedConcepts: [],
      selectionReasoning: "解析失败",
      rawOutput: raw,
    };
  }
}

/** 解析创意简报响应 */
export function parseBriefResponse(raw: string, fallbackConcepts: ConceptProposal[]): CreativeBrief {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      titleCandidates: Array.isArray(parsed.titleCandidates)
        ? (parsed.titleCandidates as unknown[]).map(String)
        : ["未命名"],
      genre: typeof parsed.genre === "string" ? parsed.genre : "未指定",
      logline: typeof parsed.logline === "string" ? parsed.logline : "",
      coreConflict: typeof parsed.coreConflict === "string" ? parsed.coreConflict : "",
      uniqueHook: typeof parsed.uniqueHook === "string" ? parsed.uniqueHook : "",
      tone: typeof parsed.tone === "string" ? parsed.tone : "",
      targetAudience: typeof parsed.targetAudience === "string" ? parsed.targetAudience : "",
      estimatedScale: typeof parsed.estimatedScale === "string" ? parsed.estimatedScale : "",
      selectedConcepts: Array.isArray(parsed.selectedConcepts)
        ? (parsed.selectedConcepts as unknown[]).map((item: unknown) => toConceptProposal(item))
        : fallbackConcepts,
    };
  } catch {
    logger.warn("Failed to parse brief response, returning minimal brief");
    return {
      titleCandidates: ["未命名"],
      genre: "未指定",
      logline: "",
      coreConflict: "",
      uniqueHook: "",
      tone: "",
      targetAudience: "",
      estimatedScale: "",
      selectedConcepts: fallbackConcepts,
    };
  }
}

/** 安全转换为 ConceptProposal */
function toConceptProposal(item: unknown): ConceptProposal {
  if (typeof item !== "object" || item === null) {
    return { name: "未知", premise: String(item), whatIf: "", risk: "", uniqueHook: "" };
  }
  const obj = item as Record<string, unknown>;
  return {
    name: typeof obj.name === "string" ? obj.name : "未命名",
    premise: typeof obj.premise === "string" ? obj.premise : "",
    whatIf: typeof obj.whatIf === "string"
      ? obj.whatIf
      : typeof obj.what_if === "string"
        ? obj.what_if
        : "",
    risk: typeof obj.risk === "string" ? obj.risk : "",
    uniqueHook: typeof obj.uniqueHook === "string"
      ? obj.uniqueHook
      : typeof obj.unique_hook === "string"
        ? obj.unique_hook
        : "",
  };
}
