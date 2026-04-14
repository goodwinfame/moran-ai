/**
 * ZaishiEngine — 载史归档引擎
 *
 * 分层处理模型：
 *   1. Haiku 初筛：低成本快速提取出场角色、关键事件、设定变化、情感节点
 *   2. Sonnet 核心归档：基于初筛结果生成结构化归档数据（章节摘要、角色delta、伏笔、时间线、关系变化）
 *
 * 设计要点：
 * - 增量归档——只记录变化量 (delta)，不重复全量
 * - 两层 LLM 调用——降本 40%+（Haiku 处理提取，Sonnet 处理推理）
 * - 所有解析器支持 camelCase + snake_case 双格式，安全 fallback
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { extractJson } from "../lingxi/lingxi-engine.js";
import { createLogger } from "../logger/index.js";
import {
  buildArchivingPrompt,
  buildArcSummaryPrompt,
  buildScreeningPrompt,
  ZAISHI_ARCHIVING_SYSTEM_PROMPT,
  ZAISHI_SCREENING_SYSTEM_PROMPT,
} from "./prompts.js";
import type {
  ArchiveProgress,
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
import { DEFAULT_ZAISHI_CONFIG } from "./types.js";

const logger = createLogger("zaishi-engine");

/**
 * ZaishiEngine — 载史归档引擎
 */
export class ZaishiEngine {
  private readonly config: ZaishiEngineConfig;

  constructor(config?: Partial<ZaishiEngineConfig>) {
    this.config = { ...DEFAULT_ZAISHI_CONFIG, ...config };
  }

  /** 获取配置（只读） */
  getConfig(): Readonly<ZaishiEngineConfig> {
    return this.config;
  }

  /**
   * 执行完整归档流程（Haiku 初筛 → Sonnet 核心归档）
   */
  async archiveChapter(
    input: ScreeningInput,
    bridge: SessionProjectBridge,
    options?: {
      previousSummaries?: string[];
      knownCharacterNames?: string[];
    },
    onProgress?: (progress: ArchiveProgress) => void,
  ): Promise<FullArchiveResult> {
    logger.info(
      { projectId: input.projectId, chapterNumber: input.chapterNumber },
      "Starting chapter archive",
    );

    // ── Stage 1: Haiku 初筛 ──────────────────────

    onProgress?.({
      stage: "screening",
      message: `正在初筛第${input.chapterNumber}章关键要素…`,
    });

    const screening = await this.screen(input, bridge);

    logger.info(
      {
        characters: screening.appearingCharacters.length,
        events: screening.keyEvents.length,
      },
      "Screening complete",
    );

    // ── Stage 2: Sonnet 核心归档 ─────────────────

    onProgress?.({
      stage: "archiving",
      message: `正在生成第${input.chapterNumber}章归档数据…`,
    });

    const archivingInput: ArchivingInput = {
      projectId: input.projectId,
      chapterNumber: input.chapterNumber,
      chapterContent: input.chapterContent,
      chapterTitle: input.chapterTitle,
      screening,
      previousSummaries: options?.previousSummaries,
      knownCharacterNames: options?.knownCharacterNames,
    };

    const archiving = await this.archive(archivingInput, bridge);

    logger.info(
      {
        summaryLength: archiving.chapterSummary.length,
        deltas: archiving.characterDeltas.length,
        threads: archiving.plotThreadUpdates.length,
      },
      "Archiving complete",
    );

    return {
      chapterNumber: input.chapterNumber,
      screening,
      archiving,
      totalUsage: {
        inputTokens: screening.usage.inputTokens + archiving.usage.inputTokens,
        outputTokens: screening.usage.outputTokens + archiving.usage.outputTokens,
      },
    };
  }

  /**
   * Stage 1: Haiku 初筛——快速提取关键要素
   */
  async screen(
    input: ScreeningInput,
    bridge: SessionProjectBridge,
  ): Promise<ScreeningResult> {
    const prompt = buildScreeningPrompt(
      input.chapterNumber,
      input.chapterContent,
      input.chapterTitle,
    );

    const response = await bridge.invokeAgent({
      agentId: this.config.screeningAgentId,
      message: prompt,
      systemPrompt: ZAISHI_SCREENING_SYSTEM_PROMPT,
    });

    return parseScreeningResponse(response.content, response.usage);
  }

  /**
   * Stage 2: Sonnet 核心归档——生成结构化归档数据
   */
  async archive(
    input: ArchivingInput,
    bridge: SessionProjectBridge,
  ): Promise<ArchivingResult> {
    const screeningJson = JSON.stringify({
      appearingCharacters: input.screening.appearingCharacters,
      keyEvents: input.screening.keyEvents,
      settingChanges: input.screening.settingChanges,
      emotionalShifts: input.screening.emotionalShifts,
    }, null, 2);

    const prompt = buildArchivingPrompt(
      input.chapterNumber,
      input.chapterContent,
      screeningJson,
      {
        chapterTitle: input.chapterTitle,
        previousSummaries: input.previousSummaries,
        knownCharacterNames: input.knownCharacterNames,
        summaryTargetWords: this.config.summaryTargetWords,
      },
    );

    const response = await bridge.invokeAgent({
      agentId: this.config.archivingAgentId,
      message: prompt,
      systemPrompt: ZAISHI_ARCHIVING_SYSTEM_PROMPT,
    });

    return parseArchivingResponse(response.content, response.usage);
  }

  /**
   * 生成弧段摘要——综合弧段内所有章节摘要
   */
  async generateArcSummary(
    input: ArcSummaryInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: ArchiveProgress) => void,
  ): Promise<ArcSummaryResult> {
    logger.info(
      { projectId: input.projectId, arcIndex: input.arcIndex, chapters: input.chapterSummaries.length },
      "Generating arc summary",
    );

    onProgress?.({
      stage: "arc_summary",
      message: `正在生成第${input.arcIndex}弧段摘要…`,
    });

    const prompt = buildArcSummaryPrompt(
      input.arcIndex,
      input.arcTitle,
      input.arcDescription,
      input.chapterSummaries,
    );

    const response = await bridge.invokeAgent({
      agentId: this.config.archivingAgentId,
      message: prompt,
      systemPrompt: ZAISHI_ARCHIVING_SYSTEM_PROMPT,
    });

    // 弧段摘要是纯文本，不是 JSON
    const content = response.content.trim();

    logger.info(
      { arcIndex: input.arcIndex, summaryLength: content.length },
      "Arc summary generated",
    );

    return {
      content,
      usage: response.usage,
    };
  }
}

// ── 解析函数 ──────────────────────────────────────

/** 解析 Haiku 初筛响应 */
export function parseScreeningResponse(
  raw: string,
  usage: { inputTokens: number; outputTokens: number },
): ScreeningResult {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    return {
      appearingCharacters: parseStringArray(
        parsed.appearingCharacters ?? parsed.appearing_characters,
      ),
      keyEvents: parseKeyEvents(parsed.keyEvents ?? parsed.key_events),
      settingChanges: parseSettingChanges(parsed.settingChanges ?? parsed.setting_changes),
      emotionalShifts: parseEmotionalShifts(parsed.emotionalShifts ?? parsed.emotional_shifts),
      usage,
    };
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse screening response, returning empty result");
    return {
      appearingCharacters: [],
      keyEvents: [],
      settingChanges: [],
      emotionalShifts: [],
      usage,
    };
  }
}

/** 解析 Sonnet 核心归档响应 */
export function parseArchivingResponse(
  raw: string,
  usage: { inputTokens: number; outputTokens: number },
): ArchivingResult {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    return {
      chapterSummary: typeof parsed.chapterSummary === "string"
        ? parsed.chapterSummary
        : typeof parsed.chapter_summary === "string"
          ? parsed.chapter_summary
          : "",
      characterDeltas: parseCharacterDeltas(parsed.characterDeltas ?? parsed.character_deltas),
      plotThreadUpdates: parsePlotThreadUpdates(parsed.plotThreadUpdates ?? parsed.plot_thread_updates),
      timelineEvents: parseTimelineEvents(parsed.timelineEvents ?? parsed.timeline_events),
      relationshipChanges: parseRelationshipChanges(
        parsed.relationshipChanges ?? parsed.relationship_changes,
      ),
      usage,
    };
  } catch (err) {
    logger.warn({ error: err }, "Failed to parse archiving response, returning empty result");
    return {
      chapterSummary: "",
      characterDeltas: [],
      plotThreadUpdates: [],
      timelineEvents: [],
      relationshipChanges: [],
      usage,
    };
  }
}

// ── 安全类型解析辅助函数 ──────────────────────────

function parseStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string");
}

function parseKeyEvents(val: unknown): KeyEvent[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toKeyEvent(item));
}

function toKeyEvent(item: unknown): KeyEvent {
  if (typeof item !== "object" || item === null) {
    return { description: String(item), characters: [], significance: "minor" };
  }
  const obj = item as Record<string, unknown>;
  return {
    description: typeof obj.description === "string" ? obj.description : "",
    characters: parseStringArray(obj.characters),
    significance: isSignificance(obj.significance) ? obj.significance : "minor",
  };
}

function parseSettingChanges(val: unknown): SettingChange[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toSettingChange(item));
}

function toSettingChange(item: unknown): SettingChange {
  if (typeof item !== "object" || item === null) {
    return { domain: "未知", description: String(item) };
  }
  const obj = item as Record<string, unknown>;
  return {
    domain: typeof obj.domain === "string" ? obj.domain : "未知",
    description: typeof obj.description === "string" ? obj.description : "",
  };
}

function parseEmotionalShifts(val: unknown): EmotionalShift[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toEmotionalShift(item));
}

function toEmotionalShift(item: unknown): EmotionalShift {
  if (typeof item !== "object" || item === null) {
    return { character: "未知", from: "", to: "", trigger: "" };
  }
  const obj = item as Record<string, unknown>;
  return {
    character: typeof obj.character === "string" ? obj.character : "未知",
    from: typeof obj.from === "string" ? obj.from : "",
    to: typeof obj.to === "string" ? obj.to : "",
    trigger: typeof obj.trigger === "string" ? obj.trigger : "",
  };
}

function parseCharacterDeltas(val: unknown): CharacterDelta[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toCharacterDelta(item));
}

function toCharacterDelta(item: unknown): CharacterDelta {
  if (typeof item !== "object" || item === null) {
    return { characterName: String(item) };
  }
  const obj = item as Record<string, unknown>;
  const delta: CharacterDelta = {
    characterName: typeof obj.characterName === "string"
      ? obj.characterName
      : typeof obj.character_name === "string"
        ? obj.character_name
        : "未知",
  };
  if (typeof obj.location === "string") delta.location = obj.location;
  if (typeof obj.emotionalState === "string") delta.emotionalState = obj.emotionalState;
  else if (typeof obj.emotional_state === "string") delta.emotionalState = obj.emotional_state;
  const knowledge = obj.knowledgeGained ?? obj.knowledge_gained;
  if (Array.isArray(knowledge)) delta.knowledgeGained = parseStringArray(knowledge);
  const changes = obj.changes;
  if (Array.isArray(changes)) delta.changes = parseStringArray(changes);
  if (typeof obj.lieProgress === "string") delta.lieProgress = obj.lieProgress;
  else if (typeof obj.lie_progress === "string") delta.lieProgress = obj.lie_progress;
  if (typeof obj.powerLevel === "string") delta.powerLevel = obj.powerLevel;
  else if (typeof obj.power_level === "string") delta.powerLevel = obj.power_level;
  if (typeof obj.physicalCondition === "string") delta.physicalCondition = obj.physicalCondition;
  else if (typeof obj.physical_condition === "string") delta.physicalCondition = obj.physical_condition;
  if (typeof obj.isAlive === "boolean") delta.isAlive = obj.isAlive;
  else if (typeof obj.is_alive === "boolean") delta.isAlive = obj.is_alive;
  return delta;
}

function parsePlotThreadUpdates(val: unknown): PlotThreadUpdate[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toPlotThreadUpdate(item));
}

function toPlotThreadUpdate(item: unknown): PlotThreadUpdate {
  if (typeof item !== "object" || item === null) {
    return { threadName: String(item) };
  }
  const obj = item as Record<string, unknown>;
  const update: PlotThreadUpdate = {
    threadName: typeof obj.threadName === "string"
      ? obj.threadName
      : typeof obj.thread_name === "string"
        ? obj.thread_name
        : "未知",
  };
  const status = obj.newStatus ?? obj.new_status;
  if (isPlotThreadStatus(status)) update.newStatus = status;
  const moment = obj.keyMoment ?? obj.key_moment;
  if (typeof moment === "string") update.keyMoment = moment;
  if (typeof obj.description === "string") update.description = obj.description;
  const related = obj.relatedCharacters ?? obj.related_characters;
  if (Array.isArray(related)) update.relatedCharacters = parseStringArray(related);
  return update;
}

function parseTimelineEvents(val: unknown): TimelineEventData[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toTimelineEventData(item));
}

function toTimelineEventData(item: unknown): TimelineEventData {
  if (typeof item !== "object" || item === null) {
    return { description: String(item), characterNames: [], significance: "minor" };
  }
  const obj = item as Record<string, unknown>;
  const event: TimelineEventData = {
    description: typeof obj.description === "string" ? obj.description : "",
    characterNames: parseStringArray(obj.characterNames ?? obj.character_names),
    significance: isSignificance(obj.significance) ? obj.significance : "minor",
  };
  const ts = obj.storyTimestamp ?? obj.story_timestamp;
  if (typeof ts === "string") event.storyTimestamp = ts;
  const loc = obj.locationName ?? obj.location_name;
  if (typeof loc === "string") event.locationName = loc;
  return event;
}

function parseRelationshipChanges(val: unknown): RelationshipChange[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: unknown) => toRelationshipChange(item));
}

function toRelationshipChange(item: unknown): RelationshipChange {
  if (typeof item !== "object" || item === null) {
    return { sourceName: "未知", targetName: "未知", type: "", intensityDelta: 0, description: "" };
  }
  const obj = item as Record<string, unknown>;
  return {
    sourceName: typeof obj.sourceName === "string"
      ? obj.sourceName
      : typeof obj.source_name === "string"
        ? obj.source_name
        : "未知",
    targetName: typeof obj.targetName === "string"
      ? obj.targetName
      : typeof obj.target_name === "string"
        ? obj.target_name
        : "未知",
    type: typeof obj.type === "string" ? obj.type : "",
    intensityDelta: typeof obj.intensityDelta === "number"
      ? obj.intensityDelta
      : typeof obj.intensity_delta === "number"
        ? obj.intensity_delta
        : 0,
    description: typeof obj.description === "string" ? obj.description : "",
  };
}

// ── Type guards ──────────────────────────────────

function isSignificance(val: unknown): val is "minor" | "moderate" | "major" | "critical" {
  return val === "minor" || val === "moderate" || val === "major" || val === "critical";
}

function isPlotThreadStatus(val: unknown): val is "planted" | "developing" | "resolved" | "stale" {
  return val === "planted" || val === "developing" || val === "resolved" || val === "stale";
}
