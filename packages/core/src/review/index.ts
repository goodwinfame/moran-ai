/**
 * 明镜审校系统 — 模块导出
 */

// Types
export type {
  ReviewRound,
  RubricDimensionId,
  RubricDimension,
  RubricDimensionScore,
  RubricScore,
  ReviewEngineConfig,
  ConsistencyContext,
  Round1Result,
  Round2Result,
  Round3Result,
  ReviewRoundResult,
  FullReviewResult,
  ReviewInput,
} from "./types.js";

export { REVIEW_ROUND_NAMES, DEFAULT_REVIEW_CONFIG } from "./types.js";

// RUBRIC framework
export {
  RUBRIC_DIMENSIONS,
  calculateWeightedScore,
  createDefaultRubricScore,
  judgeReviewResult,
  antiAiIssueToReviewIssue,
  parseRubricResponse,
  parseConsistencyResponse,
  collectAllIssues,
  getCompositeScore,
  getBurstiness,
} from "./rubric.js";

export type { PassingJudgment } from "./rubric.js";

// Prompts
export {
  buildConsistencySystemPrompt,
  buildConsistencyUserMessage,
  buildRubricSystemPrompt,
  buildRubricUserMessage,
} from "./prompts.js";

// ReviewEngine
export { ReviewEngine } from "./review-engine.js";
