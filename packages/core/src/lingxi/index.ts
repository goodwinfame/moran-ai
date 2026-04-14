/**
 * 灵犀模块导出
 */

export { LingxiEngine } from "./lingxi-engine.js";
export type { BrainstormProgress } from "./lingxi-engine.js";
export {
  extractJson,
  parseBriefResponse,
  parseConceptArray,
  parseConvergenceResponse,
  parseDivergenceResponse,
} from "./lingxi-engine.js";
export {
  buildConvergencePrompt,
  buildCrystallizationPrompt,
  buildDivergencePrompt,
  buildWhatIfPrompt,
  LINGXI_SYSTEM_PROMPT,
} from "./prompts.js";
export type {
  BrainstormInput,
  BrainstormResult,
  ConceptProposal,
  ConvergenceResult,
  CreativeBrief,
  DivergenceResult,
  LingxiEngineConfig,
} from "./types.js";
export { DEFAULT_LINGXI_CONFIG } from "./types.js";
