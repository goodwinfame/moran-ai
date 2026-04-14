/**
 * XidianEngine — 析典参考作品深度分析引擎
 *
 * 四阶段工作流：
 *   1. 搜索：自主搜索收集参考作品素材
 *   2. 分析：九维理论驱动分析
 *   3. 报告：生成结构化分析报告 + 综合摘要
 *   4. 沉淀：提炼为知识库条目
 *
 * 设计要点：
 * - 用户只需提供作品名/作者名，析典自己搜索素材
 * - 每个分析维度对应学术理论框架
 * - 所有解析器支持 camelCase + snake_case 双格式
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { extractJson } from "../lingxi/lingxi-engine.js";
import { createLogger } from "../logger/index.js";
import {
  buildDimensionPrompt,
  buildSearchPrompt,
  buildSettlementPrompt,
  buildSummaryPrompt,
  XIDIAN_SEARCH_PROMPT,
  XIDIAN_SETTLE_PROMPT,
  XIDIAN_SYSTEM_PROMPT,
} from "./prompts.js";
import {
  ALL_DIMENSIONS,
  DIMENSION_LABELS,
  DEFAULT_XIDIAN_CONFIG,
} from "./types.js";
import type {
  AnalysisDimension,
  AnalysisInput,
  AnalysisProgress,
  AnalysisReport,
  ConsumerAgent,
  DimensionAnalysis,
  SettlementEntry,
  SearchMaterial,
  SearchResult,
  SettlementResult,
  WorkMetadata,
  XidianEngineConfig,
} from "./types.js";

const logger = createLogger("xidian-engine");

/**
 * XidianEngine — 析典参考作品深度分析引擎
 */
export class XidianEngine {
  private readonly config: XidianEngineConfig;

  constructor(config?: Partial<XidianEngineConfig>) {
    this.config = { ...DEFAULT_XIDIAN_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<XidianEngineConfig> {
    return this.config;
  }

  /**
   * 执行完整分析流程：搜索 → 分析 → 报告 → 沉淀
   */
  async analyzeWork(
    input: AnalysisInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<{ report: AnalysisReport; settlement?: SettlementResult }> {
    logger.info(
      { projectId: input.projectId, workTitle: input.workTitle },
      "Starting work analysis",
    );

    const dimensions = input.dimensions ?? ALL_DIMENSIONS;
    const totalSteps = dimensions.length + 3; // search + N dims + summary + settle
    let completedSteps = 0;

    // ── Stage 1: 搜索素材 ────────────────────

    onProgress?.({
      stage: "search",
      message: `正在搜索《${input.workTitle}》相关素材…`,
      progress: 0,
    });

    const searchResult = await this.search(input, bridge);

    completedSteps++;
    logger.info(
      { materials: searchResult.materials.length },
      "Search complete",
    );

    // 合并用户提供的文本和搜索结果
    const allMaterials = this.buildMaterialsText(searchResult, input.providedTexts);

    // ── Stage 2: 逐维度分析 ──────────────────

    const dimensionResults: DimensionAnalysis[] = [];
    let totalInputTokens = searchResult.usage.inputTokens;
    let totalOutputTokens = searchResult.usage.outputTokens;

    for (const dim of dimensions) {
      onProgress?.({
        stage: "analyze",
        dimension: dim,
        message: `正在分析${DIMENSION_LABELS[dim]}…`,
        progress: completedSteps / totalSteps,
      });

      const result = await this.analyzeDimension(
        dim,
        input.workTitle,
        allMaterials,
        bridge,
        input.userNotes,
      );

      dimensionResults.push(result.analysis);
      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;

      completedSteps++;
      logger.info(
        { dimension: dim, insightsCount: result.analysis.actionableInsights.length },
        "Dimension analysis complete",
      );
    }

    // ── Stage 3: 综合摘要 ────────────────────

    onProgress?.({
      stage: "report",
      message: "正在生成综合摘要…",
      progress: completedSteps / totalSteps,
    });

    const summaryResult = await this.generateSummary(
      input.workTitle,
      dimensionResults,
      bridge,
    );

    totalInputTokens += summaryResult.usage.inputTokens;
    totalOutputTokens += summaryResult.usage.outputTokens;
    completedSteps++;

    const report: AnalysisReport = {
      projectId: input.projectId,
      work: searchResult.metadata,
      dimensions: dimensionResults,
      overallSummary: summaryResult.content,
      totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };

    // ── Stage 4: 知识沉淀 ────────────────────

    let settlement: SettlementResult | undefined;

    if (this.config.autoSettle) {
      onProgress?.({
        stage: "settle",
        message: "正在沉淀知识库条目…",
        progress: completedSteps / totalSteps,
      });

      settlement = await this.settle(input, report, bridge);
      totalInputTokens += settlement.usage.inputTokens;
      totalOutputTokens += settlement.usage.outputTokens;

      report.totalUsage = { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };

      logger.info(
        { entries: settlement.entries.length },
        "Knowledge settlement complete",
      );
    }

    logger.info(
      {
        dimensions: dimensionResults.length,
        totalInputTokens,
        totalOutputTokens,
      },
      "Work analysis complete",
    );

    return { report, settlement };
  }

  /**
   * Stage 1: 搜索素材
   */
  async search(
    input: AnalysisInput,
    bridge: SessionProjectBridge,
  ): Promise<SearchResult> {
    const prompt = buildSearchPrompt(
      input.workTitle,
      input.authorName,
      input.userNotes,
    );

    const response = await bridge.invokeAgent({
      agentId: this.config.searchAgentId,
      message: prompt,
      systemPrompt: XIDIAN_SEARCH_PROMPT,
    });

    return parseSearchResponse(response.content, response.usage);
  }

  /**
   * Stage 2: 分析单个维度
   */
  async analyzeDimension(
    dimension: AnalysisDimension,
    workTitle: string,
    materials: string,
    bridge: SessionProjectBridge,
    userNotes?: string,
  ): Promise<{ analysis: DimensionAnalysis; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildDimensionPrompt(dimension, workTitle, materials, userNotes);

    const response = await bridge.invokeAgent({
      agentId: this.config.analysisAgentId,
      message: prompt,
      systemPrompt: XIDIAN_SYSTEM_PROMPT,
    });

    const analysis = parseDimensionResponse(dimension, response.content);

    return { analysis, usage: response.usage };
  }

  /**
   * Stage 3: 生成综合摘要
   */
  async generateSummary(
    workTitle: string,
    dimensions: DimensionAnalysis[],
    bridge: SessionProjectBridge,
  ): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
    const summaries = dimensions
      .map((d) => `### ${d.label}\n${d.content.slice(0, 500)}…`)
      .join("\n\n");

    const prompt = buildSummaryPrompt(workTitle, summaries);

    const response = await bridge.invokeAgent({
      agentId: this.config.analysisAgentId,
      message: prompt,
      systemPrompt: XIDIAN_SYSTEM_PROMPT,
    });

    return { content: response.content.trim(), usage: response.usage };
  }

  /**
   * Stage 4: 知识沉淀
   */
  async settle(
    input: AnalysisInput,
    report: AnalysisReport,
    bridge: SessionProjectBridge,
  ): Promise<SettlementResult> {
    const dimensionData = report.dimensions.map((d) => ({
      dimension: d.dimension,
      label: d.label,
      content: d.content,
      insights: d.actionableInsights,
    }));

    const prompt = buildSettlementPrompt(input.workTitle, dimensionData);

    const response = await bridge.invokeAgent({
      agentId: this.config.analysisAgentId,
      message: prompt,
      systemPrompt: XIDIAN_SETTLE_PROMPT,
    });

    const entries = parseSettlementResponse(
      response.content,
      input.workTitle,
      input.projectId,
    );

    return { entries, usage: response.usage };
  }

  // ── 内部辅助 ──────────────────────────────────

  private buildMaterialsText(
    searchResult: SearchResult,
    providedTexts?: string[],
  ): string {
    const parts: string[] = [];

    // 元数据
    const meta = searchResult.metadata;
    parts.push(`## 作品元数据\n- 作品名: ${meta.title}\n- 作者: ${meta.author}\n- 标签: ${meta.tags.join("、")}\n- 简介: ${meta.synopsis}`);
    if (meta.wordCount) parts.push(`- 总字数: ${meta.wordCount}`);
    if (meta.rating) parts.push(`- 评分: ${meta.rating}`);
    if (meta.platform) parts.push(`- 平台: ${meta.platform}`);

    // 用户提供的文本优先
    if (providedTexts && providedTexts.length > 0) {
      parts.push("\n## 用户提供的文本片段");
      for (const [i, text] of providedTexts.entries()) {
        parts.push(`\n### 片段 ${i + 1}\n${text}`);
      }
    }

    // 搜索到的素材
    if (searchResult.materials.length > 0) {
      parts.push("\n## 搜索收集的素材");
      for (const mat of searchResult.materials) {
        const sourceLine = mat.url ? `来源: ${mat.source} (${mat.url})` : `来源: ${mat.source}`;
        parts.push(`\n### [${mat.type}] ${sourceLine}\n${mat.content}`);
      }
    }

    return parts.join("\n");
  }
}

// ── 解析函数 ──────────────────────────────────────

/** 解析搜索响应 */
export function parseSearchResponse(
  raw: string,
  usage: { inputTokens: number; outputTokens: number },
): SearchResult {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    return {
      metadata: parseWorkMetadata(parsed.metadata),
      materials: parseSearchMaterials(parsed.materials),
      usage,
    };
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse search response, returning empty result");
    return {
      metadata: {
        title: "",
        author: "",
        tags: [],
        synopsis: "",
      },
      materials: [],
      usage,
    };
  }
}

/** 解析单维度分析响应 */
export function parseDimensionResponse(
  dimension: AnalysisDimension,
  raw: string,
): DimensionAnalysis {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    return {
      dimension,
      label: DIMENSION_LABELS[dimension],
      content: typeof parsed.content === "string" ? parsed.content : "",
      structuredData: typeof parsed.structuredData === "string"
        ? parsed.structuredData
        : typeof parsed.structured_data === "string"
          ? parsed.structured_data
          : undefined,
      actionableInsights: parseStringArray(
        parsed.actionableInsights ?? parsed.actionable_insights,
      ),
      consumers: parseConsumers(parsed.consumers),
    };
  } catch (err) {
    logger.warn({ error: err, dimension }, "Failed to parse dimension response");
    return {
      dimension,
      label: DIMENSION_LABELS[dimension],
      content: raw.trim(),
      actionableInsights: [],
      consumers: [],
    };
  }
}

/** 解析知识沉淀响应 */
export function parseSettlementResponse(
  raw: string,
  sourceWork: string,
  projectId: string,
): SettlementEntry[] {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: unknown) => toSettlementEntry(item, sourceWork, projectId));
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse settlement response");
    return [];
  }
}

// ── 安全类型解析辅助函数 ──────────────────────────

function parseWorkMetadata(val: unknown): WorkMetadata {
  if (typeof val !== "object" || val === null) {
    return { title: "", author: "", tags: [], synopsis: "" };
  }
  const obj = val as Record<string, unknown>;
  const meta: WorkMetadata = {
    title: typeof obj.title === "string" ? obj.title : "",
    author: typeof obj.author === "string" ? obj.author : "",
    tags: parseStringArray(obj.tags),
    synopsis: typeof obj.synopsis === "string" ? obj.synopsis : "",
  };
  if (typeof obj.wordCount === "number") meta.wordCount = obj.wordCount;
  else if (typeof obj.word_count === "number") meta.wordCount = obj.word_count;
  if (typeof obj.rating === "number") meta.rating = obj.rating;
  if (typeof obj.platform === "string") meta.platform = obj.platform;
  return meta;
}

function parseSearchMaterials(val: unknown): SearchMaterial[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toSearchMaterial(item));
}

function toSearchMaterial(item: unknown): SearchMaterial {
  if (typeof item !== "object" || item === null) {
    return { source: "未知", type: "analysis", content: String(item) };
  }
  const obj = item as Record<string, unknown>;
  const mat: SearchMaterial = {
    source: typeof obj.source === "string" ? obj.source : "未知",
    type: isMaterialType(obj.type) ? obj.type : "analysis",
    content: typeof obj.content === "string" ? obj.content : "",
  };
  if (typeof obj.url === "string") mat.url = obj.url;
  return mat;
}

function isMaterialType(val: unknown): val is SearchMaterial["type"] {
  return val === "metadata" || val === "sample_text" || val === "review"
    || val === "analysis" || val === "user_provided";
}

function parseStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string");
}

const VALID_CONSUMERS = new Set<string>(["lingxi", "jiangxin", "zhibi", "mingjing", "bowen"]);

function parseConsumers(val: unknown): ConsumerAgent[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is ConsumerAgent =>
    typeof item === "string" && VALID_CONSUMERS.has(item),
  );
}

const VALID_CATEGORIES = new Set(["writing_technique", "genre_knowledge", "style_guide", "reference_analysis"]);

function toSettlementEntry(
  item: unknown,
  sourceWork: string,
  projectId: string,
): SettlementEntry {
  if (typeof item !== "object" || item === null) {
    return {
      title: "未命名",
      content: String(item),
      category: "reference_analysis",
      sourceDimension: "narrative_structure",
      sourceWork,
      consumers: [],
      scope: "global",
    };
  }
  const obj = item as Record<string, unknown>;
  const category = typeof obj.category === "string" && VALID_CATEGORIES.has(obj.category)
    ? obj.category as SettlementEntry["category"]
    : "reference_analysis";

  const scopeRaw = obj.scope;
  let scope: SettlementEntry["scope"] = "global";
  if (typeof scopeRaw === "string") {
    if (scopeRaw === "global") {
      scope = "global";
    } else if (scopeRaw.startsWith("project:")) {
      scope = scopeRaw as `project:${string}`;
    } else if (scopeRaw === "project") {
      scope = `project:${projectId}`;
    }
  }

  const sourceDimRaw = obj.sourceDimension ?? obj.source_dimension;
  const sourceDimension = typeof sourceDimRaw === "string" && ALL_DIMENSIONS.includes(sourceDimRaw as AnalysisDimension)
    ? sourceDimRaw as AnalysisDimension
    : "narrative_structure";

  return {
    title: typeof obj.title === "string" ? obj.title : "未命名",
    content: typeof obj.content === "string" ? obj.content : "",
    category,
    sourceDimension,
    sourceWork,
    consumers: parseConsumers(obj.consumers),
    scope,
  };
}
