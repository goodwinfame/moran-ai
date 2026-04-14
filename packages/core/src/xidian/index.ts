/**
 * 析典模块导出
 */

export { XidianEngine } from "./xidian-engine.js";
export type { AnalysisProgress } from "./types.js";
export {
  parseDimensionResponse,
  parseSearchResponse,
  parseSettlementResponse,
} from "./xidian-engine.js";
export {
  buildDimensionPrompt,
  buildSearchPrompt,
  buildSettlementPrompt,
  buildSummaryPrompt,
  getDimensionConfig,
  XIDIAN_SEARCH_PROMPT,
  XIDIAN_SETTLE_PROMPT,
  XIDIAN_SYSTEM_PROMPT,
} from "./prompts.js";
export type {
  AnalysisDimension,
  AnalysisInput,
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
export {
  ALL_DIMENSIONS,
  DEFAULT_XIDIAN_CONFIG,
  DIMENSION_LABELS,
} from "./types.js";
