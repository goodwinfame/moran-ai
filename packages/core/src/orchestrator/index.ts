/**
 * Orchestrator 模块 — 导出编排器和相关类型
 */

export type {
  OrchestratorPhase,
  OrchestratorState,
  OrchestratorConfig,
  CostRecord,
  ChapterCostSummary,
  WriteChapterRequest,
  WriteChapterResult,
} from "./types.js";

export { DEFAULT_ORCHESTRATOR_CONFIG } from "./types.js";

export { CostTracker } from "./cost-tracker.js";
export { Orchestrator } from "./orchestrator.js";
export { ChapterPipeline, type ChapterPipelineConfig } from "./chapter-pipeline.js";

// M4.1: 多版本择优
export {
  VersionSelector,
  DEFAULT_VERSION_SELECTOR_CONFIG,
  type VersionCandidate,
  type SelectionResult,
  type VersionSelectorConfig,
  type VersionGenerateParams,
  type VersionProgressEvent,
  type VersionSelectedEvent,
} from "./version-selector.js";
