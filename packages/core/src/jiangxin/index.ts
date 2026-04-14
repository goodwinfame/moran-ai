/**
 * 匠心模块导出
 */

export { JiangxinEngine } from "./jiangxin-engine.js";
export type { DesignProgress } from "./jiangxin-engine.js";
export {
  parseChapterBriefResponse,
  parseCharacterDesignResponse,
  parseStructurePlanResponse,
  parseWorldDesignResponse,
} from "./jiangxin-engine.js";
export {
  buildChapterBriefPrompt,
  buildCharacterDesignPrompt,
  buildStructurePlanPrompt,
  buildWorldDesignPrompt,
  JIANGXIN_SYSTEM_PROMPT,
} from "./prompts.js";
export type {
  ArcPlan,
  ChapterBrief,
  ChapterOutline,
  CharacterDesignInput,
  CharacterDesignResult,
  CharacterProfile,
  CharacterRelationship,
  ExplosionPoint,
  Foreshadowing,
  JiangxinEngineConfig,
  PsychologyModel,
  StructurePlanInput,
  StructurePlanResult,
  WorldDesignInput,
  WorldDesignResult,
  WorldSubsystem,
} from "./types.js";
export { DEFAULT_JIANGXIN_CONFIG } from "./types.js";
