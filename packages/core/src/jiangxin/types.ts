/**
 * 匠心 (JiangxinEngine) — 类型定义
 *
 * §4.3.3 匠心 — 世界/角色/结构设计
 *
 * 三大设计领域：
 *   A. 世界观构建（开放式子系统）
 *   B. 角色设计（传记法 + 四维心理模型）
 *   C. 结构规划（弧段-章节两级）
 */

// ── A. 世界观 ──────────────────────────────────────────

/** 世界观子系统 */
export interface WorldSubsystem {
  /** 子系统标识 (如 "power-system", "social-hierarchy") */
  id: string;
  /** 子系统名称 */
  name: string;
  /** 标签 (如 ["核心", "战斗"]) */
  tags: string[];
  /** 详细描述 */
  description: string;
  /** 规则和约束 */
  rules: string[];
}

/** 世界观设计输入 */
export interface WorldDesignInput {
  /** 项目 ID */
  projectId: string;
  /** 创意简报（来自灵犀） */
  briefSummary: string;
  /** 用户额外的世界设定要求 */
  requirements?: string;
  /** 参考知识（析典沉淀） */
  referenceKnowledge?: string[];
}

/** 世界观设计结果 */
export interface WorldDesignResult {
  /** 世界概述 */
  overview: string;
  /** 子系统列表 */
  subsystems: WorldSubsystem[];
  /** 原始 LLM 输出 */
  rawOutput: string;
  /** Token 消耗 */
  usage: { inputTokens: number; outputTokens: number };
}

// ── B. 角色 ──────────────────────────────────────────

/** 四维心理模型 */
export interface PsychologyModel {
  /** 表面渴望（角色自以为想要的） */
  want: string;
  /** 真实需求（角色真正需要的） */
  need: string;
  /** 信奉的谎言（驱动行为的错误信念） */
  lie: string;
  /** 创伤来源（LIE 的根源事件） */
  ghost: string;
}

/** 角色档案 */
export interface CharacterProfile {
  /** 角色标识 */
  id: string;
  /** 姓名 */
  name: string;
  /** 角色定位 (主角/配角/反派/龙套) */
  role: "protagonist" | "deuteragonist" | "antagonist" | "supporting" | "minor";
  /** 简短描述 */
  description: string;
  /** 传记（出生到故事开始前） */
  biography: string;
  /** 四维心理模型 */
  psychology: PsychologyModel;
  /** 非功能性特征 */
  quirks: {
    /** 口头禅 */
    catchphrase?: string;
    /** 小动作/习惯 */
    habits: string[];
    /** 怪癖 */
    eccentricities: string[];
  };
  /** 与其他角色的关系 */
  relationships: CharacterRelationship[];
  /** 角色弧线描述 (LIE → TRUTH) */
  arcDescription: string;
}

/** 角色关系 */
export interface CharacterRelationship {
  /** 目标角色 ID */
  targetId: string;
  /** 目标角色名 */
  targetName: string;
  /** 关系类型 */
  type: string;
  /** 关系描述 */
  description: string;
  /** 张力描述（冲突/矛盾源） */
  tension?: string;
}

/** 角色设计输入 */
export interface CharacterDesignInput {
  /** 项目 ID */
  projectId: string;
  /** 创意简报摘要 */
  briefSummary: string;
  /** 世界观概述 */
  worldOverview: string;
  /** 已有角色（用于关系设计） */
  existingCharacters?: CharacterProfile[];
  /** 用户额外要求 */
  requirements?: string;
  /** 参考知识 */
  referenceKnowledge?: string[];
}

/** 角色设计结果 */
export interface CharacterDesignResult {
  /** 角色列表 */
  characters: CharacterProfile[];
  /** 原始 LLM 输出 */
  rawOutput: string;
  /** Token 消耗 */
  usage: { inputTokens: number; outputTokens: number };
}

// ── C. 结构 ──────────────────────────────────────────

/** 伏笔 */
export interface Foreshadowing {
  /** 伏笔标识 */
  id: string;
  /** 伏笔描述 */
  description: string;
  /** 埋设弧段 */
  plantedInArc: number;
  /** 预计回收弧段 */
  resolvedInArc?: number;
  /** 关联角色 */
  relatedCharacters: string[];
}

/** 爆点设计 */
export interface ExplosionPoint {
  /** 章节位置（弧段内） */
  chapterIndex: number;
  /** 爆点描述 */
  description: string;
  /** 爆点类型 */
  type: "reversal" | "revelation" | "climax" | "confrontation" | "sacrifice" | "other";
  /** 回收的伏笔 ID */
  resolvedForeshadowing: string[];
}

/** 弧段计划 */
export interface ArcPlan {
  /** 弧段编号 */
  arcNumber: number;
  /** 弧段名称 */
  name: string;
  /** 弧段目标（核心冲突） */
  goal: string;
  /** 章节数量 */
  chapterCount: number;
  /** 爆点设计 */
  explosionPoints: ExplosionPoint[];
  /** 伏笔清单 */
  foreshadowing: Foreshadowing[];
  /** 角色发展（LIE→TRUTH 进度） */
  characterArcs: Array<{
    characterId: string;
    characterName: string;
    arcProgress: string;
  }>;
  /** 章节概要（每章 2-3 句方向性描述） */
  chapterOutlines: ChapterOutline[];
}

/** 章节概要 */
export interface ChapterOutline {
  /** 章节序号（弧段内，从 1 开始） */
  index: number;
  /** 方向性描述 */
  description: string;
  /** 章节类型 */
  chapterType: "daily" | "normal" | "emotional" | "action" | "explosion";
  /** 是否为爆点章 */
  isExplosion: boolean;
}

/** 结构规划输入 */
export interface StructurePlanInput {
  /** 项目 ID */
  projectId: string;
  /** 创意简报摘要 */
  briefSummary: string;
  /** 世界观概述 */
  worldOverview: string;
  /** 角色列表摘要 */
  charactersSummary: string;
  /** 要规划的弧段编号 */
  arcNumber: number;
  /** 前序弧段摘要（可选，用于连续性） */
  previousArcsSummary?: string;
  /** 用户额外要求 */
  requirements?: string;
  /** 参考知识 */
  referenceKnowledge?: string[];
}

/** 结构规划结果 */
export interface StructurePlanResult {
  /** 弧段计划 */
  arcPlan: ArcPlan;
  /** 原始 LLM 输出 */
  rawOutput: string;
  /** Token 消耗 */
  usage: { inputTokens: number; outputTokens: number };
}

// ── 章节 Brief ──────────────────────────────────────────

/** 章节 Brief — 写作前的具体指导 */
export interface ChapterBrief {
  /** 章节编号 */
  chapterNumber: number;
  /** 弧段编号 */
  arcNumber: number;
  /** 方向性描述（来自弧段计划） */
  outline: string;
  /** 章节类型 */
  chapterType: "daily" | "normal" | "emotional" | "action" | "explosion";
  /** 参与角色 */
  involvedCharacters: string[];
  /** 需要回收的伏笔 */
  foreshadowingToResolve: string[];
  /** 需要埋设的伏笔 */
  foreshadowingToPlant: string[];
  /** 情感地雷（Plantser Pipeline 植入） */
  emotionalMines?: string[];
  /** Scene-Sequel 标注（可选） */
  sceneSequel?: string;
}

// ── 引擎配置 ──────────────────────────────────────────

/** 匠心引擎配置 */
export interface JiangxinEngineConfig {
  /** 角色设计使用的心理模型 */
  psychologyModel: "WANT_NEED_LIE_GHOST";
  /** 是否要求弧段计划包含爆点 */
  requireExplosionPoints: boolean;
  /** 每个弧段最少章节数 */
  minChaptersPerArc: number;
  /** 每个弧段最多章节数 */
  maxChaptersPerArc: number;
}

export const DEFAULT_JIANGXIN_CONFIG: JiangxinEngineConfig = {
  psychologyModel: "WANT_NEED_LIE_GHOST",
  requireExplosionPoints: true,
  minChaptersPerArc: 20,
  maxChaptersPerArc: 50,
};
