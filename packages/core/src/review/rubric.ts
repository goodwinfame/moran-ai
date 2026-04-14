/**
 * RUBRIC 评分框架 — 7 维度文学质量评估
 *
 * §4.5 Round 3：文学质量评分
 *
 * 7 维度 (权重总计 100%):
 *   叙事节奏 15% | 冲突张力 15% | 人物深度 15% | 对话自然度 15%
 *   情感共鸣 15% | 呆板度检测 15% | 创意独特性 10%
 *
 * 通过标准（§4.5 审校通过标准）:
 *   1. 无 CRITICAL 级问题
 *   2. MAJOR < maxMajorIssues (默认 2)
 *   3. 综合分 ≥ passingScore (默认 7.5)
 *   4. Burstiness ≥ burstinessThreshold (默认 0.3)
 */

import type { ReviewIssue } from "../events/types.js";
import type {
  ReviewEngineConfig,
  ReviewRoundResult,
  RubricDimension,
  RubricDimensionScore,
  RubricScore,
} from "./types.js";
import { DEFAULT_REVIEW_CONFIG } from "./types.js";

// ── RUBRIC 7 维度定义 ──────────────────────────────────

/** 7 维度定义（不可变，随代码发布） */
export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  {
    id: "narrative_rhythm",
    name: "叙事节奏",
    weight: 0.15,
    description: "场景转换频率、紧张-松弛交替、段落长度变化",
  },
  {
    id: "conflict_tension",
    name: "冲突张力",
    weight: 0.15,
    description: "是否有明确的冲突推进、悬念维持、利益碰撞",
  },
  {
    id: "character_depth",
    name: "人物深度",
    weight: 0.15,
    description: "行为是否体现内在矛盾、是否有性格层次",
  },
  {
    id: "dialogue_natural",
    name: "对话自然度",
    weight: 0.15,
    description: "每个角色说话是否有辨识度、是否'一人分饰N角'",
  },
  {
    id: "emotional_resonance",
    name: "情感共鸣",
    weight: 0.15,
    description: "情感是否通过行为/环境间接传达（而非直接告知）",
  },
  {
    id: "staleness",
    name: "呆板度检测",
    weight: 0.15,
    description: "行为可预测性、情感同时性、反期待缺失、非理性行为缺失",
  },
  {
    id: "creative_novelty",
    name: "创意独特性",
    weight: 0.10,
    description: "是否有超出预期的处理方式、是否有'金句'",
  },
] as const;

// ── 评分计算 ──────────────────────────────────────────

/**
 * 计算 RUBRIC 加权综合分
 */
export function calculateWeightedScore(dimensions: RubricDimensionScore[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const definition = RUBRIC_DIMENSIONS.find((d) => d.id === dim.dimensionId);
    if (!definition) continue;
    weightedSum += dim.score * definition.weight;
    totalWeight += definition.weight;
  }

  if (totalWeight === 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(2));
}

/**
 * 创建空的 RUBRIC 评分（所有维度默认分）
 */
export function createDefaultRubricScore(defaultScore = 7.5): RubricScore {
  return {
    dimensions: RUBRIC_DIMENSIONS.map((d) => ({
      dimensionId: d.id,
      score: defaultScore,
      rationale: "默认评分（未执行 LLM 评估）",
    })),
    weightedScore: defaultScore,
    overallComment: "未执行 RUBRIC 评估",
  };
}

// ── 通过标准判定 ──────────────────────────────────────────

/** 判定失败原因 */
export interface PassingJudgment {
  passed: boolean;
  reasons: string[];
}

/**
 * 判定章节是否通过审校
 *
 * 通过标准（§4.5 审校通过标准）:
 *   1. 无 CRITICAL 级问题
 *   2. MAJOR < maxMajorIssues
 *   3. 综合分 ≥ passingScore
 *   4. Burstiness ≥ burstinessThreshold
 */
export function judgeReviewResult(
  allIssues: ReviewIssue[],
  score: number,
  burstiness: number,
  config: ReviewEngineConfig = DEFAULT_REVIEW_CONFIG,
): PassingJudgment {
  const reasons: string[] = [];

  // 1. CRITICAL 检查
  const criticals = allIssues.filter((i) => i.severity === "critical");
  if (criticals.length > 0) {
    reasons.push(`存在 ${criticals.length} 个 CRITICAL 级问题: ${criticals.map((c) => c.issue).join("; ")}`);
  }

  // 2. MAJOR 检查
  const majors = allIssues.filter((i) => i.severity === "major");
  if (majors.length >= config.maxMajorIssues) {
    reasons.push(`MAJOR 级问题 ${majors.length} 个 (≥${config.maxMajorIssues}): ${majors.map((m) => m.issue).join("; ")}`);
  }

  // 3. 综合分检查
  if (score < config.passingScore) {
    reasons.push(`综合分 ${score.toFixed(2)} < ${config.passingScore} 通过线`);
  }

  // 4. Burstiness 检查
  if (burstiness < config.burstinessThreshold) {
    reasons.push(`Burstiness ${burstiness.toFixed(3)} < ${config.burstinessThreshold} 门槛（疑似 AI 生成）`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

// ── AntiAiIssue → ReviewIssue 转换 ──────────────────────────

/**
 * 将 Anti-AI 检测的 issue 转为标准 ReviewIssue
 *
 * severity 映射规则:
 *   - low_burstiness → major（硬门槛，直接影响通过）
 *   - forbidden_word → major（用户明确禁止）
 *   - 其余 → minor
 */
export function antiAiIssueToReviewIssue(
  issue: import("../style/types.js").AntiAiIssue,
): ReviewIssue {
  const isCriticalType = issue.type === "low_burstiness" || issue.type === "forbidden_word";

  return {
    issue: issue.description,
    severity: isCriticalType ? "major" : "minor",
    evidence: issue.evidence,
    suggestion: getSuggestionForAntiAiIssue(issue.type),
  };
}

function getSuggestionForAntiAiIssue(type: string): string {
  switch (type) {
    case "low_burstiness":
      return "增加句式长短变化，混合使用短句、长句和复合句，避免均匀句长";
    case "repetitive_structure":
      return "打破连续主语重复，用环境描写、感官描写或对话穿插替代";
    case "emotional_telling":
      return "将'他感到...'改为通过行为/表情/环境间接传达情感";
    case "sensory_overload":
      return "一段只聚焦 1-2 种感官，其余留给后续段落自然展开";
    case "repetitive_thoughts":
      return "减少内心独白频率，用动作或对话替代部分心理描写";
    case "forbidden_word":
      return "替换为风格配置中鼓励使用的表达方式";
    case "mixed_language":
      return "将非必要英文替换为中文对应词汇";
    default:
      return "参照风格指引调整";
  }
}

// ── LLM 响应解析 ──────────────────────────────────────────

/**
 * 解析 LLM 返回的 RUBRIC JSON 响应
 *
 * 预期 LLM 返回 JSON 格式（参见 prompts.ts 中的输出格式要求）:
 * {
 *   "dimensions": [
 *     { "dimensionId": "narrative_rhythm", "score": 8, "rationale": "..." },
 *     ...
 *   ],
 *   "overallComment": "...",
 *   "issues": [
 *     { "issue": "...", "severity": "major", "evidence": "...", "suggestion": "...", "expectedEffect": "..." }
 *   ]
 * }
 */
export function parseRubricResponse(rawResponse: string): {
  rubricScore: RubricScore;
  issues: ReviewIssue[];
} | null {
  try {
    // 尝试从 response 中提取 JSON 块
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)```/) ??
      rawResponse.match(/\{[\s\S]*"dimensions"[\s\S]*\}/);

    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1] ?? jsonMatch[0];
    const parsed = JSON.parse(jsonStr) as {
      dimensions?: Array<{ dimensionId?: string; score?: number; rationale?: string }>;
      overallComment?: string;
      issues?: Array<{
        issue?: string;
        severity?: string;
        evidence?: string;
        suggestion?: string;
        expectedEffect?: string;
      }>;
    };

    if (!parsed.dimensions || !Array.isArray(parsed.dimensions)) return null;

    // 解析维度评分
    const dimensions: RubricDimensionScore[] = [];
    for (const dim of parsed.dimensions) {
      if (!dim.dimensionId || typeof dim.score !== "number") continue;
      const validId = RUBRIC_DIMENSIONS.find((d) => d.id === dim.dimensionId);
      if (!validId) continue;

      dimensions.push({
        dimensionId: validId.id,
        score: Math.max(1, Math.min(10, dim.score)),
        rationale: dim.rationale ?? "",
      });
    }

    if (dimensions.length === 0) return null;

    const weightedScore = calculateWeightedScore(dimensions);

    // 解析 issues
    const issues: ReviewIssue[] = [];
    if (parsed.issues && Array.isArray(parsed.issues)) {
      for (const raw of parsed.issues) {
        if (!raw.issue) continue;
        const severity = validateSeverity(raw.severity);
        issues.push({
          issue: raw.issue,
          severity,
          evidence: raw.evidence,
          suggestion: raw.suggestion,
          expectedEffect: raw.expectedEffect,
        });
      }
    }

    return {
      rubricScore: {
        dimensions,
        weightedScore,
        overallComment: parsed.overallComment ?? "",
      },
      issues,
    };
  } catch {
    return null;
  }
}

/**
 * 解析 LLM 返回的一致性检查 JSON 响应
 *
 * 预期格式:
 * {
 *   "issues": [
 *     { "issue": "...", "severity": "critical", "evidence": "...", "suggestion": "...", "expectedEffect": "..." }
 *   ]
 * }
 */
export function parseConsistencyResponse(rawResponse: string): ReviewIssue[] | null {
  try {
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)```/) ??
      rawResponse.match(/\{[\s\S]*"issues"[\s\S]*\}/);

    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1] ?? jsonMatch[0];
    const parsed = JSON.parse(jsonStr) as {
      issues?: Array<{
        issue?: string;
        severity?: string;
        evidence?: string;
        suggestion?: string;
        expectedEffect?: string;
      }>;
    };

    if (!parsed.issues || !Array.isArray(parsed.issues)) return null;

    const issues: ReviewIssue[] = [];
    for (const raw of parsed.issues) {
      if (!raw.issue) continue;
      issues.push({
        issue: raw.issue,
        severity: validateSeverity(raw.severity),
        evidence: raw.evidence,
        suggestion: raw.suggestion,
        expectedEffect: raw.expectedEffect,
      });
    }

    return issues;
  } catch {
    return null;
  }
}

function validateSeverity(s: unknown): ReviewIssue["severity"] {
  if (s === "critical" || s === "major" || s === "minor" || s === "suggestion") {
    return s;
  }
  return "minor";
}

// ── 汇总工具 ──────────────────────────────────────────

/**
 * 从多轮结果中汇总所有 issues
 */
export function collectAllIssues(rounds: ReviewRoundResult[]): ReviewIssue[] {
  const all: ReviewIssue[] = [];
  for (const round of rounds) {
    all.push(...round.issues);
  }
  return all;
}

/**
 * 从多轮结果中获取综合分
 *
 * 优先取 Round 3 RUBRIC 加权分，其次 fallback 到 placeholder
 */
export function getCompositeScore(rounds: ReviewRoundResult[]): number {
  for (const round of rounds) {
    if (round.round === 3) {
      return round.rubricScore.weightedScore;
    }
  }
  return 7.5; // placeholder — Round 3 未执行时的默认分
}

/**
 * 从多轮结果中获取 burstiness
 */
export function getBurstiness(rounds: ReviewRoundResult[]): number {
  for (const round of rounds) {
    if (round.round === 1) {
      return round.antiAiCheck.burstiness;
    }
  }
  return 0.5; // placeholder
}
