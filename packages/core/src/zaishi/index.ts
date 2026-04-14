/**
 * 载史模块导出
 */

export { ZaishiEngine } from "./zaishi-engine.js";
export type { ArchiveProgress } from "./types.js";
export {
  parseArchivingResponse,
  parseScreeningResponse,
} from "./zaishi-engine.js";
export {
  buildArchivingPrompt,
  buildArcSummaryPrompt,
  buildScreeningPrompt,
  ZAISHI_ARCHIVING_SYSTEM_PROMPT,
  ZAISHI_SCREENING_SYSTEM_PROMPT,
} from "./prompts.js";
export type {
  ArchivingInput,
  ArchivingResult,
  ArcSummaryInput,
  ArcSummaryResult,
  CharacterDelta,
  EmotionalShift,
  FullArchiveResult,
  KeyEvent,
  PlotThreadUpdate,
  RelationshipChange,
  ScreeningInput,
  ScreeningResult,
  SettingChange,
  TimelineEventData,
  ZaishiEngineConfig,
} from "./types.js";
export { DEFAULT_ZAISHI_CONFIG } from "./types.js";
