/**
 * JiangxinEngine — 匠心设计引擎
 *
 * 三大设计领域：
 *   A. designWorld() — 世界观构建
 *   B. designCharacters() — 角色设计
 *   C. planStructure() — 弧段结构规划
 *   D. generateBrief() — 章节 Brief 生成
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import {
  buildChapterBriefPrompt,
  buildCharacterDesignPrompt,
  buildStructurePlanPrompt,
  buildWorldDesignPrompt,
  JIANGXIN_SYSTEM_PROMPT,
} from "./prompts.js";
import type {
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
import { DEFAULT_JIANGXIN_CONFIG } from "./types.js";
import { extractJson } from "../lingxi/lingxi-engine.js";

const logger = createLogger("jiangxin-engine");

/** 设计阶段进度回调 */
export interface DesignProgress {
  stage: "world" | "characters" | "structure" | "brief";
  message: string;
}

/**
 * JiangxinEngine — 匠心设计引擎
 */
export class JiangxinEngine {
  private readonly config: JiangxinEngineConfig;

  constructor(config?: Partial<JiangxinEngineConfig>) {
    this.config = { ...DEFAULT_JIANGXIN_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<JiangxinEngineConfig> {
    return this.config;
  }

  // ── A. 世界观设计 ──────────────────────────────────

  /**
   * 设计世界观
   *
   * 从创意简报出发，构建开放式子系统世界观
   */
  async designWorld(
    input: WorldDesignInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: DesignProgress) => void,
  ): Promise<WorldDesignResult> {
    onProgress?.({
      stage: "world",
      message: "正在构建世界观…",
    });

    const prompt = buildWorldDesignPrompt(input);

    const response = await bridge.invokeAgent({
      agentId: "jiangxin",
      message: prompt,
      context: JIANGXIN_SYSTEM_PROMPT,
    });

    const result = parseWorldDesignResponse(response.content);

    logger.info(
      { subsystemCount: result.subsystems.length },
      "World design complete",
    );

    return {
      ...result,
      rawOutput: response.content,
      usage: response.usage,
    };
  }

  // ── B. 角色设计 ──────────────────────────────────

  /**
   * 设计角色
   *
   * 传记法 + WANT/NEED/LIE/GHOST 四维心理模型
   */
  async designCharacters(
    input: CharacterDesignInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: DesignProgress) => void,
  ): Promise<CharacterDesignResult> {
    onProgress?.({
      stage: "characters",
      message: "正在设计角色…",
    });

    const prompt = buildCharacterDesignPrompt(input);

    const response = await bridge.invokeAgent({
      agentId: "jiangxin",
      sessionId: `jiangxin-${input.projectId}`,
      message: prompt,
      context: JIANGXIN_SYSTEM_PROMPT,
    });

    const characters = parseCharacterDesignResponse(response.content);

    logger.info(
      { characterCount: characters.length },
      "Character design complete",
    );

    return {
      characters,
      rawOutput: response.content,
      usage: response.usage,
    };
  }

  // ── C. 结构规划 ──────────────────────────────────

  /**
   * 规划弧段结构
   *
   * 弧段-章节两级规划，含爆点和伏笔
   */
  async planStructure(
    input: StructurePlanInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: DesignProgress) => void,
  ): Promise<StructurePlanResult> {
    onProgress?.({
      stage: "structure",
      message: `正在规划弧段 ${input.arcNumber} 结构…`,
    });

    const prompt = buildStructurePlanPrompt(input);

    const response = await bridge.invokeAgent({
      agentId: "jiangxin",
      sessionId: `jiangxin-${input.projectId}`,
      message: prompt,
      context: JIANGXIN_SYSTEM_PROMPT,
    });

    const arcPlan = parseStructurePlanResponse(response.content, input.arcNumber);

    // 验证弧段计划
    validateArcPlan(arcPlan, this.config);

    logger.info(
      {
        arc: arcPlan.arcNumber,
        chapters: arcPlan.chapterCount,
        explosions: arcPlan.explosionPoints.length,
        foreshadowing: arcPlan.foreshadowing.length,
      },
      "Structure planning complete",
    );

    return {
      arcPlan,
      rawOutput: response.content,
      usage: response.usage,
    };
  }

  // ── D. 章节 Brief 生成 ────────────────────────────

  /**
   * 生成章节 Brief
   *
   * 从弧段计划 + 上下文生成具体章节写作指导
   */
  async generateBrief(
    arcPlanSummary: string,
    chapterOutline: string,
    chapterNumber: number,
    arcNumber: number,
    characterStates: string,
    openForeshadowing: string,
    bridge: SessionProjectBridge,
    projectId: string,
    onProgress?: (progress: DesignProgress) => void,
  ): Promise<{ brief: ChapterBrief; usage: { inputTokens: number; outputTokens: number } }> {
    onProgress?.({
      stage: "brief",
      message: `正在生成第 ${chapterNumber} 章 Brief…`,
    });

    const prompt = buildChapterBriefPrompt(
      arcPlanSummary,
      chapterOutline,
      chapterNumber,
      arcNumber,
      characterStates,
      openForeshadowing,
    );

    const response = await bridge.invokeAgent({
      agentId: "jiangxin",
      sessionId: `jiangxin-${projectId}`,
      message: prompt,
      context: JIANGXIN_SYSTEM_PROMPT,
    });

    const brief = parseChapterBriefResponse(response.content, chapterNumber, arcNumber);

    logger.info(
      { chapter: chapterNumber, arc: arcNumber },
      "Chapter brief generated",
    );

    return {
      brief,
      usage: response.usage,
    };
  }
}

// ── JSON 解析辅助 ──────────────────────────────────────

/** 解析世界观设计响应 */
export function parseWorldDesignResponse(raw: string): { overview: string; subsystems: WorldSubsystem[] } {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const overview = typeof parsed.overview === "string" ? parsed.overview : "";
    const subsystems = Array.isArray(parsed.subsystems)
      ? (parsed.subsystems as unknown[]).map((item: unknown) => toWorldSubsystem(item))
      : [];
    return { overview, subsystems };
  } catch {
    logger.warn("Failed to parse world design response");
    return { overview: raw.slice(0, 500), subsystems: [] };
  }
}

/** 解析角色设计响应 */
export function parseCharacterDesignResponse(raw: string): CharacterProfile[] {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const chars = Array.isArray(parsed.characters) ? parsed.characters as unknown[] :
      Array.isArray(parsed) ? parsed as unknown[] : [];
    return chars.map((item: unknown) => toCharacterProfile(item));
  } catch {
    logger.warn("Failed to parse character design response");
    return [];
  }
}

/** 解析弧段结构规划响应 */
export function parseStructurePlanResponse(raw: string, fallbackArc: number): ArcPlan {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const plan = typeof parsed.arcPlan === "object" && parsed.arcPlan !== null
      ? parsed.arcPlan as Record<string, unknown>
      : parsed;
    return toArcPlan(plan, fallbackArc);
  } catch {
    logger.warn("Failed to parse structure plan response");
    return {
      arcNumber: fallbackArc,
      name: `弧段 ${fallbackArc}`,
      goal: "",
      chapterCount: 0,
      explosionPoints: [],
      foreshadowing: [],
      characterArcs: [],
      chapterOutlines: [],
    };
  }
}

/** 解析章节 Brief 响应 */
export function parseChapterBriefResponse(raw: string, chapterNumber: number, arcNumber: number): ChapterBrief {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      chapterNumber: typeof parsed.chapterNumber === "number" ? parsed.chapterNumber : chapterNumber,
      arcNumber: typeof parsed.arcNumber === "number" ? parsed.arcNumber : arcNumber,
      outline: typeof parsed.outline === "string" ? parsed.outline : "",
      chapterType: isChapterType(parsed.chapterType) ? parsed.chapterType : "normal",
      involvedCharacters: toStringArray(parsed.involvedCharacters),
      foreshadowingToResolve: toStringArray(parsed.foreshadowingToResolve),
      foreshadowingToPlant: toStringArray(parsed.foreshadowingToPlant),
      emotionalMines: parsed.emotionalMines ? toStringArray(parsed.emotionalMines) : undefined,
      sceneSequel: typeof parsed.sceneSequel === "string" ? parsed.sceneSequel : undefined,
    };
  } catch {
    logger.warn("Failed to parse chapter brief response");
    return {
      chapterNumber,
      arcNumber,
      outline: "",
      chapterType: "normal",
      involvedCharacters: [],
      foreshadowingToResolve: [],
      foreshadowingToPlant: [],
    };
  }
}

/** 验证弧段计划 */
function validateArcPlan(plan: ArcPlan, config: JiangxinEngineConfig): void {
  if (config.requireExplosionPoints && plan.explosionPoints.length === 0) {
    logger.warn({ arc: plan.arcNumber }, "Arc plan has no explosion points");
  }
  if (plan.chapterCount < config.minChaptersPerArc) {
    logger.warn(
      { arc: plan.arcNumber, chapters: plan.chapterCount, min: config.minChaptersPerArc },
      "Arc plan has fewer chapters than minimum",
    );
  }
  if (plan.chapterCount > config.maxChaptersPerArc) {
    logger.warn(
      { arc: plan.arcNumber, chapters: plan.chapterCount, max: config.maxChaptersPerArc },
      "Arc plan exceeds maximum chapters",
    );
  }
}

// ── 类型转换辅助 ──────────────────────────────────────

function toWorldSubsystem(item: unknown): WorldSubsystem {
  if (typeof item !== "object" || item === null) {
    return { id: "unknown", name: "未知", tags: [], description: String(item), rules: [] };
  }
  const obj = item as Record<string, unknown>;
  return {
    id: typeof obj.id === "string" ? obj.id : "unknown",
    name: typeof obj.name === "string" ? obj.name : "未命名",
    tags: toStringArray(obj.tags),
    description: typeof obj.description === "string" ? obj.description : "",
    rules: toStringArray(obj.rules),
  };
}

function toCharacterProfile(item: unknown): CharacterProfile {
  if (typeof item !== "object" || item === null) {
    return emptyCharacterProfile();
  }
  const obj = item as Record<string, unknown>;
  return {
    id: typeof obj.id === "string" ? obj.id : "unknown",
    name: typeof obj.name === "string" ? obj.name : "未命名",
    role: isCharacterRole(obj.role) ? obj.role : "supporting",
    description: typeof obj.description === "string" ? obj.description : "",
    biography: typeof obj.biography === "string" ? obj.biography : "",
    psychology: toPsychologyModel(obj.psychology),
    quirks: toQuirks(obj.quirks),
    relationships: toRelationships(obj.relationships),
    arcDescription: typeof obj.arcDescription === "string"
      ? obj.arcDescription
      : typeof obj.arc_description === "string"
        ? obj.arc_description
        : "",
  };
}

function toPsychologyModel(item: unknown): PsychologyModel {
  if (typeof item !== "object" || item === null) {
    return { want: "", need: "", lie: "", ghost: "" };
  }
  const obj = item as Record<string, unknown>;
  return {
    want: typeof obj.want === "string" ? obj.want : "",
    need: typeof obj.need === "string" ? obj.need : "",
    lie: typeof obj.lie === "string" ? obj.lie : "",
    ghost: typeof obj.ghost === "string" ? obj.ghost : "",
  };
}

function toQuirks(item: unknown): CharacterProfile["quirks"] {
  if (typeof item !== "object" || item === null) {
    return { habits: [], eccentricities: [] };
  }
  const obj = item as Record<string, unknown>;
  return {
    catchphrase: typeof obj.catchphrase === "string" ? obj.catchphrase : undefined,
    habits: toStringArray(obj.habits),
    eccentricities: toStringArray(obj.eccentricities),
  };
}

function toRelationships(item: unknown): CharacterRelationship[] {
  if (!Array.isArray(item)) return [];
  return item.map((rel: unknown) => {
    if (typeof rel !== "object" || rel === null) return emptyRelationship();
    const obj = rel as Record<string, unknown>;
    return {
      targetId: typeof obj.targetId === "string"
        ? obj.targetId
        : typeof obj.target_id === "string"
          ? obj.target_id
          : "",
      targetName: typeof obj.targetName === "string"
        ? obj.targetName
        : typeof obj.target_name === "string"
          ? obj.target_name
          : "",
      type: typeof obj.type === "string" ? obj.type : "",
      description: typeof obj.description === "string" ? obj.description : "",
      tension: typeof obj.tension === "string" ? obj.tension : undefined,
    };
  });
}

function toArcPlan(item: unknown, fallbackArc: number): ArcPlan {
  if (typeof item !== "object" || item === null) {
    return emptyArcPlan(fallbackArc);
  }
  const obj = item as Record<string, unknown>;
  const chapterOutlines = Array.isArray(obj.chapterOutlines)
    ? (obj.chapterOutlines as unknown[]).map((c: unknown) => toChapterOutline(c))
    : [];
  return {
    arcNumber: typeof obj.arcNumber === "number"
      ? obj.arcNumber
      : typeof obj.arc_number === "number"
        ? obj.arc_number
        : fallbackArc,
    name: typeof obj.name === "string" ? obj.name : `弧段 ${fallbackArc}`,
    goal: typeof obj.goal === "string" ? obj.goal : "",
    chapterCount: typeof obj.chapterCount === "number"
      ? obj.chapterCount
      : typeof obj.chapter_count === "number"
        ? obj.chapter_count
        : chapterOutlines.length,
    explosionPoints: Array.isArray(obj.explosionPoints)
      ? (obj.explosionPoints as unknown[]).map((e: unknown) => toExplosionPoint(e))
      : [],
    foreshadowing: Array.isArray(obj.foreshadowing)
      ? (obj.foreshadowing as unknown[]).map((f: unknown) => toForeshadowing(f))
      : [],
    characterArcs: Array.isArray(obj.characterArcs)
      ? (obj.characterArcs as unknown[]).map((a: unknown) => toCharacterArc(a))
      : [],
    chapterOutlines,
  };
}

function toChapterOutline(item: unknown): ChapterOutline {
  if (typeof item !== "object" || item === null) {
    return { index: 0, description: "", chapterType: "normal", isExplosion: false };
  }
  const obj = item as Record<string, unknown>;
  return {
    index: typeof obj.index === "number" ? obj.index : 0,
    description: typeof obj.description === "string" ? obj.description : "",
    chapterType: isChapterType(obj.chapterType)
      ? obj.chapterType
      : isChapterType(obj.chapter_type)
        ? obj.chapter_type as ChapterOutline["chapterType"]
        : "normal",
    isExplosion: typeof obj.isExplosion === "boolean"
      ? obj.isExplosion
      : typeof obj.is_explosion === "boolean"
        ? obj.is_explosion
        : false,
  };
}

function toExplosionPoint(item: unknown): ExplosionPoint {
  if (typeof item !== "object" || item === null) {
    return { chapterIndex: 0, description: "", type: "other", resolvedForeshadowing: [] };
  }
  const obj = item as Record<string, unknown>;
  return {
    chapterIndex: typeof obj.chapterIndex === "number"
      ? obj.chapterIndex
      : typeof obj.chapter_index === "number"
        ? obj.chapter_index
        : 0,
    description: typeof obj.description === "string" ? obj.description : "",
    type: isExplosionType(obj.type) ? obj.type : "other",
    resolvedForeshadowing: toStringArray(obj.resolvedForeshadowing ?? obj.resolved_foreshadowing),
  };
}

function toForeshadowing(item: unknown): Foreshadowing {
  if (typeof item !== "object" || item === null) {
    return { id: "unknown", description: "", plantedInArc: 0, relatedCharacters: [] };
  }
  const obj = item as Record<string, unknown>;
  return {
    id: typeof obj.id === "string" ? obj.id : "unknown",
    description: typeof obj.description === "string" ? obj.description : "",
    plantedInArc: typeof obj.plantedInArc === "number"
      ? obj.plantedInArc
      : typeof obj.planted_in_arc === "number"
        ? obj.planted_in_arc
        : 0,
    resolvedInArc: typeof obj.resolvedInArc === "number"
      ? obj.resolvedInArc
      : typeof obj.resolved_in_arc === "number"
        ? obj.resolved_in_arc
        : undefined,
    relatedCharacters: toStringArray(obj.relatedCharacters ?? obj.related_characters),
  };
}

function toCharacterArc(item: unknown): { characterId: string; characterName: string; arcProgress: string } {
  if (typeof item !== "object" || item === null) {
    return { characterId: "", characterName: "", arcProgress: "" };
  }
  const obj = item as Record<string, unknown>;
  return {
    characterId: typeof obj.characterId === "string"
      ? obj.characterId
      : typeof obj.character_id === "string"
        ? obj.character_id
        : "",
    characterName: typeof obj.characterName === "string"
      ? obj.characterName
      : typeof obj.character_name === "string"
        ? obj.character_name
        : "",
    arcProgress: typeof obj.arcProgress === "string"
      ? obj.arcProgress
      : typeof obj.arc_progress === "string"
        ? obj.arc_progress
        : "",
  };
}

function toStringArray(item: unknown): string[] {
  if (!Array.isArray(item)) return [];
  return item.filter((v): v is string => typeof v === "string");
}

function isCharacterRole(v: unknown): v is CharacterProfile["role"] {
  return typeof v === "string" && ["protagonist", "deuteragonist", "antagonist", "supporting", "minor"].includes(v);
}

function isChapterType(v: unknown): v is ChapterOutline["chapterType"] {
  return typeof v === "string" && ["daily", "normal", "emotional", "action", "explosion"].includes(v);
}

function isExplosionType(v: unknown): v is ExplosionPoint["type"] {
  return typeof v === "string" && ["reversal", "revelation", "climax", "confrontation", "sacrifice", "other"].includes(v);
}

function emptyCharacterProfile(): CharacterProfile {
  return {
    id: "unknown",
    name: "未命名",
    role: "supporting",
    description: "",
    biography: "",
    psychology: { want: "", need: "", lie: "", ghost: "" },
    quirks: { habits: [], eccentricities: [] },
    relationships: [],
    arcDescription: "",
  };
}

function emptyRelationship(): CharacterRelationship {
  return { targetId: "", targetName: "", type: "", description: "" };
}

function emptyArcPlan(arcNumber: number): ArcPlan {
  return {
    arcNumber,
    name: `弧段 ${arcNumber}`,
    goal: "",
    chapterCount: 0,
    explosionPoints: [],
    foreshadowing: [],
    characterArcs: [],
    chapterOutlines: [],
  };
}
