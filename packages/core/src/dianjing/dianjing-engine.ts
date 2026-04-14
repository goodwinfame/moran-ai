/**
 * DianjingEngine — 点睛专业文学诊断引擎
 *
 * 深度诊断问题根因，提供专业文学批评视角。
 * 当明镜的常规审校无法诊断问题根因时介入。
 *
 * 设计要点：
 * - 关注 "为什么不好" 而非 "哪里不好"
 * - 核心问题数有上限（maxCoreIssues），防止信息过载
 * - 所有解析器支持 camelCase + snake_case 双格式
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { extractJson } from "../lingxi/lingxi-engine.js";
import { createLogger } from "../logger/index.js";
import { DIANJING_SYSTEM_PROMPT, buildDiagnosisMessage } from "./prompts.js";
import {
  ALL_DIAGNOSIS_DIMENSIONS,
  DEFAULT_DIANJING_CONFIG,
  DIAGNOSIS_DIMENSION_LABELS,
} from "./types.js";
import type {
  CoreIssue,
  DiagnosisDimension,
  DiagnosisInput,
  DianjingEngineConfig,
  DimensionDiagnosis,
  LiteraryDiagnosis,
} from "./types.js";

const logger = createLogger("dianjing-engine");

export class DianjingEngine {
  private readonly config: DianjingEngineConfig;

  constructor(config?: Partial<DianjingEngineConfig>) {
    this.config = { ...DEFAULT_DIANJING_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<DianjingEngineConfig> {
    return this.config;
  }

  /**
   * 执行文学诊断
   */
  async diagnose(
    input: DiagnosisInput,
    bridge: SessionProjectBridge,
  ): Promise<LiteraryDiagnosis> {
    logger.info(
      { chapterNumber: input.chapterNumber },
      "Starting literary diagnosis",
    );

    try {
      const userMessage = buildDiagnosisMessage(input);

      const response = await bridge.invokeAgent({
        agentId: this.config.agentId,
        message: userMessage,
        systemPrompt: DIANJING_SYSTEM_PROMPT,
        stream: false,
        temperature: 0.3,
      });

      const diagnosis = parseLiteraryDiagnosis(
        response.content,
        response.usage,
        this.config.maxCoreIssues,
      );

      logger.info(
        {
          chapterNumber: input.chapterNumber,
          dimensions: diagnosis.dimensionDiagnoses.length,
          coreIssues: diagnosis.coreIssues.length,
        },
        "Literary diagnosis complete",
      );

      return diagnosis;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: message, chapterNumber: input.chapterNumber },
        "Literary diagnosis failed",
      );

      return createFallbackDiagnosis(message);
    }
  }
}

// ── 解析函数 ──────────────────────────────────────

/**
 * 解析文学诊断 JSON
 *
 * 支持 camelCase + snake_case 双格式字段名
 */
export function parseLiteraryDiagnosis(
  raw: string,
  usage: { inputTokens: number; outputTokens: number },
  maxCoreIssues: number = 2,
): LiteraryDiagnosis {
  try {
    const json = extractJson(raw);
    const obj = JSON.parse(json) as Record<string, unknown>;

    const dimDiagRaw = obj.dimensionDiagnoses ?? obj.dimension_diagnoses;
    const dimensionDiagnoses = parseDimensionDiagnoses(dimDiagRaw);

    const coreIssuesRaw = obj.coreIssues ?? obj.core_issues;
    const coreIssues = parseCoreIssues(coreIssuesRaw, maxCoreIssues);

    const summary = typeof obj.summary === "string" ? obj.summary : "";

    return {
      dimensionDiagnoses,
      coreIssues,
      summary,
      rawResponse: raw,
      usage,
    };
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse literary diagnosis, using fallback");
    return createFallbackDiagnosis("解析失败", raw, usage);
  }
}

// ── 子解析器 ──────────────────────────────────────

function parseDimensionDiagnoses(val: unknown): DimensionDiagnosis[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => toDimensionDiagnosis(item))
    .filter((d): d is DimensionDiagnosis => d !== null);
}

function toDimensionDiagnosis(obj: Record<string, unknown>): DimensionDiagnosis | null {
  const dimRaw = obj.dimension;
  if (typeof dimRaw !== "string" || !isValidDimension(dimRaw)) return null;

  const dimension = dimRaw as DiagnosisDimension;

  const severityRaw = obj.severity;
  const severity = typeof severityRaw === "number"
    ? Math.max(1, Math.min(10, Math.round(severityRaw)))
    : 5;

  const rootCauseRaw = obj.rootCause ?? obj.root_cause;
  const rootCause = typeof rootCauseRaw === "string" ? rootCauseRaw : "";

  const improveDirRaw = obj.improvementDirection ?? obj.improvement_direction;
  const improvementDirection = typeof improveDirRaw === "string" ? improveDirRaw : "";

  const evidence = typeof obj.evidence === "string" ? obj.evidence : undefined;

  return {
    dimension,
    label: DIAGNOSIS_DIMENSION_LABELS[dimension],
    severity,
    rootCause,
    improvementDirection,
    evidence,
  };
}

function isValidDimension(val: string): val is DiagnosisDimension {
  return ALL_DIAGNOSIS_DIMENSIONS.includes(val as DiagnosisDimension);
}

function parseCoreIssues(val: unknown, maxCoreIssues: number): CoreIssue[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => toCoreIssue(item))
    .filter((issue): issue is CoreIssue => issue !== null)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, maxCoreIssues);
}

function toCoreIssue(obj: Record<string, unknown>): CoreIssue | null {
  const title = typeof obj.title === "string" ? obj.title : "";
  if (title.length === 0) return null;

  const dimsRaw = obj.dimensions;
  const dimensions = Array.isArray(dimsRaw)
    ? dimsRaw.filter((d): d is DiagnosisDimension => typeof d === "string" && isValidDimension(d))
    : [];

  const rootCauseRaw = obj.rootCause ?? obj.root_cause;
  const rootCause = typeof rootCauseRaw === "string" ? rootCauseRaw : "";

  const improveDirRaw = obj.improvementDirection ?? obj.improvement_direction;
  const improvementDirection = typeof improveDirRaw === "string" ? improveDirRaw : "";

  const impactRaw = obj.impact;
  const impact = typeof impactRaw === "number"
    ? Math.max(1, Math.min(10, Math.round(impactRaw)))
    : 5;

  return {
    title,
    dimensions,
    rootCause,
    improvementDirection,
    impact,
  };
}

// ── Fallback ──────────────────────────────────────

function createFallbackDiagnosis(
  errorMessage: string,
  rawResponse?: string,
  usage?: { inputTokens: number; outputTokens: number },
): LiteraryDiagnosis {
  return {
    dimensionDiagnoses: [],
    coreIssues: [],
    summary: `[点睛诊断失败] ${errorMessage}`,
    rawResponse,
    usage: usage ?? { inputTokens: 0, outputTokens: 0 },
  };
}
