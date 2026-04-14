/**
 * 点睛模块导出
 */

// Engine
export { DianjingEngine, parseLiteraryDiagnosis } from "./dianjing-engine.js";

// Prompts
export { DIANJING_SYSTEM_PROMPT, buildDiagnosisMessage } from "./prompts.js";

// Types
export type {
  DianjingEngineConfig,
  DiagnosisInput,
  DiagnosisDimension,
  DimensionDiagnosis,
  CoreIssue,
  LiteraryDiagnosis,
} from "./types.js";

export {
  DEFAULT_DIANJING_CONFIG,
  ALL_DIAGNOSIS_DIMENSIONS,
  DIAGNOSIS_DIMENSION_LABELS,
} from "./types.js";
