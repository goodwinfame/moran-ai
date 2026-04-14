/**
 * 书虫模块导出
 */

// Engine
export { ShuchongEngine, parseReaderFeedback } from "./shuchong-engine.js";

// Prompts
export { SHUCHONG_SYSTEM_PROMPT, buildReaderReviewMessage } from "./prompts.js";

// Types
export type {
  ShuchongEngineConfig,
  ReaderReviewInput,
  BoringSpot,
  TouchingMoment,
  FavoriteCharacter,
  ReaderFeedback,
} from "./types.js";

export { DEFAULT_SHUCHONG_CONFIG } from "./types.js";
