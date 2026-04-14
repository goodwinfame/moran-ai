/**
 * Plantser Pipeline — 模块导出
 */

export { PlantserPipeline } from "./plantser-pipeline.js";

export type {
  PlantserBrief,
  PlantserConfig,
  PlantserInput,
  PlantserProgress,
  HardConstraints,
  SoftGuidance,
  FreeZone,
  EmotionalLandmine,
  EmotionalLandmineType,
  SceneSequelAnnotation,
  SceneSequelCycle,
  SceneUnit,
  SequelUnit,
  CharacterState,
} from "./types.js";

export { DEFAULT_PLANTSER_CONFIG } from "./types.js";

export {
  buildPlantserBriefPrompt,
  buildLandminePrompt,
  isValidLandmineType,
  PLANTSER_SYSTEM_PROMPT,
} from "./prompts.js";

export {
  generateLandminesFromRules,
  parseLandmineResponse,
  parseBriefEnhancementResponse,
} from "./plantser-pipeline.js";
