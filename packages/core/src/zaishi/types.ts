/**
 * 载史 (zaishi) — 归档引擎类型定义
 *
 * 设计要点：
 * - 分层处理：Haiku 轻量初筛 + Sonnet 核心归档
 * - 增量归档：只记录变化量 (delta)，不重复全量
 * - 结构化输出：所有归档数据类型化，可直接入库
 */

import type { AgentId } from "../agents/types.js";

// ── 归档引擎配置 ──────────────────────────────

export interface ZaishiEngineConfig {
  /** Haiku 初筛使用的 agent ID（低成本快速提取） */
  screeningAgentId: AgentId;
  /** Sonnet 核心归档使用的 agent ID（高质量结构化输出） */
  archivingAgentId: AgentId;
  /** 章节摘要目标字数 (500-800) */
  summaryTargetWords: number;
  /** 是否在弧段末章时自动生成弧段摘要 */
  autoArcSummary: boolean;
}

export const DEFAULT_ZAISHI_CONFIG: ZaishiEngineConfig = {
  screeningAgentId: "zaishi",
  archivingAgentId: "zaishi",
  summaryTargetWords: 650,
  autoArcSummary: true,
};

// ── Haiku 初筛输入 ──────────────────────────────

export interface ScreeningInput {
  /** 项目 ID */
  projectId: string;
  /** 章节序号 */
  chapterNumber: number;
  /** 章节正文 */
  chapterContent: string;
  /** 章节标题 */
  chapterTitle?: string;
}

// ── Haiku 初筛输出 ──────────────────────────────

export interface ScreeningResult {
  /** 出场角色列表 (名字) */
  appearingCharacters: string[];
  /** 关键事件列表 */
  keyEvents: KeyEvent[];
  /** 新增/变化的设定 */
  settingChanges: SettingChange[];
  /** 情感变化节点 */
  emotionalShifts: EmotionalShift[];
  /** LLM 用量 */
  usage: { inputTokens: number; outputTokens: number };
}

export interface KeyEvent {
  /** 事件描述 */
  description: string;
  /** 相关角色 */
  characters: string[];
  /** 重要程度 */
  significance: "minor" | "moderate" | "major" | "critical";
}

export interface SettingChange {
  /** 变化的设定领域 */
  domain: string;
  /** 变化描述 */
  description: string;
}

export interface EmotionalShift {
  /** 角色名 */
  character: string;
  /** 从什么情感状态 */
  from: string;
  /** 到什么情感状态 */
  to: string;
  /** 触发原因 */
  trigger: string;
}

// ── Sonnet 核心归档输入 ──────────────────────────

export interface ArchivingInput {
  /** 项目 ID */
  projectId: string;
  /** 章节序号 */
  chapterNumber: number;
  /** 章节正文 */
  chapterContent: string;
  /** 章节标题 */
  chapterTitle?: string;
  /** Haiku 初筛结果 */
  screening: ScreeningResult;
  /** 前几章摘要（供上下文参考） */
  previousSummaries?: string[];
  /** 当前已知角色列表（供匹配） */
  knownCharacterNames?: string[];
}

// ── Sonnet 核心归档输出 ──────────────────────────

export interface ArchivingResult {
  /** 章节摘要 (500-800 字 Markdown) */
  chapterSummary: string;
  /** 角色状态变化 (增量) */
  characterDeltas: CharacterDelta[];
  /** 伏笔状态更新 */
  plotThreadUpdates: PlotThreadUpdate[];
  /** 时间线事件 */
  timelineEvents: TimelineEventData[];
  /** 关系变化 */
  relationshipChanges: RelationshipChange[];
  /** LLM 用量 */
  usage: { inputTokens: number; outputTokens: number };
}

export interface CharacterDelta {
  /** 角色名 */
  characterName: string;
  /** 位置变化 */
  location?: string;
  /** 情感状态 */
  emotionalState?: string;
  /** 获知的新信息 */
  knowledgeGained?: string[];
  /** 变化描述 */
  changes?: string[];
  /** LIE 进展描述 */
  lieProgress?: string;
  /** 力量等级变化 */
  powerLevel?: string;
  /** 身体状况 */
  physicalCondition?: string;
  /** 是否存活 */
  isAlive?: boolean;
}

export interface PlotThreadUpdate {
  /** 伏笔名称 */
  threadName: string;
  /** 新状态 */
  newStatus?: "planted" | "developing" | "resolved" | "stale";
  /** 本章关键进展 */
  keyMoment?: string;
  /** 描述 (新伏笔时提供) */
  description?: string;
  /** 相关角色 */
  relatedCharacters?: string[];
}

export interface TimelineEventData {
  /** 故事内时间 */
  storyTimestamp?: string;
  /** 事件描述 */
  description: string;
  /** 相关角色 */
  characterNames: string[];
  /** 发生地点 */
  locationName?: string;
  /** 重要程度 */
  significance: "minor" | "moderate" | "major" | "critical";
}

export interface RelationshipChange {
  /** 源角色 */
  sourceName: string;
  /** 目标角色 */
  targetName: string;
  /** 关系类型 */
  type: string;
  /** 强度变化（-1 到 1） */
  intensityDelta: number;
  /** 变化描述 */
  description: string;
}

// ── 完整归档结果（Screening + Archiving 合并） ──

export interface FullArchiveResult {
  /** 章节序号 */
  chapterNumber: number;
  /** 初筛结果 */
  screening: ScreeningResult;
  /** 核心归档结果 */
  archiving: ArchivingResult;
  /** 总 LLM 用量 */
  totalUsage: { inputTokens: number; outputTokens: number };
}

// ── 弧段摘要输入/输出 ──────────────────────────

export interface ArcSummaryInput {
  /** 项目 ID */
  projectId: string;
  /** 弧段序号 */
  arcIndex: number;
  /** 弧段标题 */
  arcTitle?: string;
  /** 弧段描述 */
  arcDescription?: string;
  /** 本弧段所有章节摘要 */
  chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
}

export interface ArcSummaryResult {
  /** 弧段摘要 */
  content: string;
  /** LLM 用量 */
  usage: { inputTokens: number; outputTokens: number };
}

// ── 归档进度回调 ──────────────────────────────

export interface ArchiveProgress {
  stage: "screening" | "archiving" | "arc_summary";
  message: string;
}
