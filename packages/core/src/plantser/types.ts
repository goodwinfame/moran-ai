/**
 * Plantser Pipeline — 类型定义
 *
 * §4.10 Plantser Pipeline — 三层 Brief 设计 + 情感地雷 + Scene-Sequel
 *
 * Plantser = Planner + Pantser
 * 解决"干预多了呆板，不干预又无聊"的核心痛点
 */

import type { AgentId } from "../agents/types.js";
import type { ArcPlan, CharacterProfile } from "../jiangxin/types.js";

// ── 三层 Brief 结构 ──────────────────────────────────

/** 硬约束层 — 不可突破 */
export interface HardConstraints {
  /** 必须出场的角色 ID */
  mustAppear: string[];
  /** 必须推进的情节线 */
  mustAdvance: Array<{
    /** 线索/情节线名 */
    thread: string;
    /** 推进描述 */
    progress: string;
  }>;
  /** 必须发生的关键事件 */
  mustHappen: string[];
  /** 禁止事项 */
  mustNot: string[];
  /** 情感地雷（必须体现） */
  emotionalLandmines: EmotionalLandmine[];
}

/** 软引导层 — 方向性建议，可适度偏离 */
export interface SoftGuidance {
  /** 建议的情感基调 */
  mood: string;
  /** 建议的场景顺序 */
  suggestedScenes: string[];
  /** 伏笔埋设提示 */
  foreshadowingHints: Array<{
    /** 埋设描述 */
    plant: string;
    /** 预计回收章节/弧段 */
    resolveHint?: string;
  }>;
  /** Scene-Sequel 标注 */
  sceneSequel: SceneSequelAnnotation[];
  /** 建议的叙事视角 */
  suggestedPOV?: string;
}

/** 自由区 — 写手自主发挥 */
export interface FreeZone {
  /** 允许自由发挥的领域 */
  areas: string[];
  /** 鼓励的创意方向 */
  encouragements: string[];
}

// ── 情感地雷 ──────────────────────────────────────────

/** 情感地雷类型 */
export type EmotionalLandmineType =
  | "emotional_simultaneity"   // 情感同时性：同一时刻矛盾情感
  | "irrational_behavior"     // 非理性行为：合乎情感但不合逻辑
  | "anti_expectation"        // 反期待时刻：打破读者预期
  | "body_first";             // 身体先行：身体反应先于理性

/** 情感地雷 */
export interface EmotionalLandmine {
  /** 地雷类型 */
  type: EmotionalLandmineType;
  /** 具体描述 */
  description: string;
  /** 涉及角色 */
  involvedCharacters: string[];
  /** 触发条件（简述） */
  trigger?: string;
}

// ── Scene-Sequel ──────────────────────────────────────

/** Scene 行动段 */
export interface SceneUnit {
  /** 角色目标 (= WANT) */
  goal: string;
  /** 冲突/阻碍 (= LIE 被挑战) */
  conflict: string;
  /** 灾难/转折 (结果比预期更糟) */
  disaster: string;
}

/** Sequel 反应段 */
export interface SequelUnit {
  /** 情感反应 */
  reaction: string;
  /** 困境/两难 (WANT vs NEED) */
  dilemma: string;
  /** 决定 (朝 LIE 或 TRUTH 偏移) */
  decision: string;
}

/** Scene-Sequel 完整循环 */
export interface SceneSequelCycle {
  /** 循环序号 */
  index: number;
  /** Scene 部分 */
  scene: SceneUnit;
  /** Sequel 部分 */
  sequel: SequelUnit;
}

/** Scene-Sequel 标注（简化版，用于 Brief） */
export interface SceneSequelAnnotation {
  /** 标注序号 */
  index: number;
  /** 类型 */
  type: "scene" | "sequel" | "mixed";
  /** 摘要描述 */
  summary: string;
}

// ── 增强型 Brief ──────────────────────────────────────

/** Plantser 三层章节 Brief */
export interface PlantserBrief {
  /** 章节编号 */
  chapterNumber: number;
  /** 弧段编号 */
  arcNumber: number;
  /** 弧段内位置 (如 "15/30") */
  positionInArc: string;
  /** 建议标题 */
  suggestedTitle?: string;
  /** 章节类型 */
  chapterType: "daily" | "normal" | "emotional" | "action" | "explosion";
  /** 是否为爆点章 */
  isExplosion: boolean;

  /** 🔴 硬约束层 */
  hardConstraints: HardConstraints;
  /** 🟡 软引导层 */
  softGuidance: SoftGuidance;
  /** 🟢 自由区 */
  freeZone: FreeZone;

  /** 完整 Scene-Sequel 循环（详细版） */
  sceneSequelCycles?: SceneSequelCycle[];

  /** 原始匠心 Brief outline (兼容) */
  outline: string;
}

// ── Pipeline 输入 ──────────────────────────────────────

/** 角色状态信息（用于生成情感地雷） */
export interface CharacterState {
  /** 角色 ID */
  id: string;
  /** 角色名 */
  name: string;
  /** 当前情感状态 */
  emotionalState?: string;
  /** 当前 LIE→TRUTH 进度 (0-1) */
  arcProgress?: number;
  /** 四维心理模型 */
  psychology?: {
    want: string;
    need: string;
    lie: string;
    ghost: string;
  };
  /** 近期关系变化 */
  recentRelationshipChanges?: string[];
}

/** Plantser Pipeline 输入 */
export interface PlantserInput {
  /** 项目 ID */
  projectId: string;
  /** 弧段计划 */
  arcPlan: ArcPlan;
  /** 当前章节在弧段内的序号 (1-based) */
  chapterIndexInArc: number;
  /** 全局章节编号 */
  chapterNumber: number;
  /** 参与角色的状态 */
  characterStates: CharacterState[];
  /** 角色完整档案（用于 Scene-Sequel 的角色驱动融合） */
  characterProfiles?: CharacterProfile[];
  /** 开放的伏笔列表 */
  openForeshadowing: string[];
  /** 前一章的摘要 */
  previousChapterSummary?: string;
  /** 前一章的情感结束基调 */
  previousEndMood?: string;
  /** 参考知识库条目（析典沉淀） */
  referenceKnowledge?: string[];
}

/** Plantser Pipeline 配置 */
export interface PlantserConfig {
  /** 情感地雷：每章最少数量 */
  minLandminesPerChapter: number;
  /** 情感地雷：每章最多数量 */
  maxLandminesPerChapter: number;
  /** Scene-Sequel：是否自动标注 */
  autoSceneSequel: boolean;
  /** Scene-Sequel：每章最大循环数 */
  maxCyclesPerChapter: number;
  /** Brief 生成使用的 Agent */
  briefAgentId: AgentId;
  /** 是否使用 LLM 增强 Brief (true: 调用 LLM 生成三层 Brief; false: 纯规则生成) */
  useLLMEnhancement: boolean;
}

export const DEFAULT_PLANTSER_CONFIG: PlantserConfig = {
  minLandminesPerChapter: 1,
  maxLandminesPerChapter: 3,
  autoSceneSequel: true,
  maxCyclesPerChapter: 3,
  briefAgentId: "jiangxin",
  useLLMEnhancement: true,
};

/** Brief 生成进度 */
export interface PlantserProgress {
  stage: "analyzing" | "constraints" | "landmines" | "scene_sequel" | "enhancing" | "complete";
  message: string;
}
