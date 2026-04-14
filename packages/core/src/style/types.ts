/**
 * Style Engine 类型定义
 *
 * 风格引擎是墨染的核心差异化能力——通过混合格式配置
 * （YAML 约束 + 散文描述 + 示例段落）控制执笔的文风。
 *
 * 设计来源：§4.4 风格引擎、§4.5 风格配置格式
 */

/** 章节类型 — 用于温度场景化 */
export type ChapterType = "daily" | "normal" | "emotional" | "action" | "climax";

/** 温度范围 [min, max] */
export type TemperatureRange = [min: number, max: number];

/** 章节类型 → 温度范围映射 */
export type TemperatureMap = Record<ChapterType, TemperatureRange>;

/** 基调控制 (0-1 连续值) */
export interface ToneControl {
  humor: number;
  tension: number;
  romance: number;
  dark: number;
  [key: string]: number; // 允许自定义基调维度
}

/** 禁忌词/表达规则 */
export interface ForbiddenRules {
  /** 禁忌词列表 */
  words?: string[];
  /** 禁忌模式（正则） */
  patterns?: string[];
}

/** 上下文权重加成 */
export interface ContextWeights {
  world: number;
  character: number;
  plot: number;
  [key: string]: number;
}

/**
 * StyleConfig — 风格配置结构（三合一）
 *
 * 对应每个风格目录的 config.yaml + prose.md + examples.md
 */
export interface StyleConfig {
  /** 风格标识 (如 "剑心", "云墨") */
  styleId: string;
  /** 显示名 (如 "执笔·剑心") */
  displayName: string;
  /** 适用题材 */
  genre: string;
  /** 风格描述 */
  description: string;
  /** 版本号 */
  version: number;

  // ── 结构化约束（config.yaml 部分）──────────────────
  /** 必选专项模块 ID */
  modules: string[];
  /** 审校特别关注点 */
  reviewerFocus: string[];
  /** 上下文权重加成 */
  contextWeights: ContextWeights;
  /** 基调控制 */
  tone: ToneControl;
  /** 禁忌词/表达 */
  forbidden: ForbiddenRules;
  /** 鼓励的表达方式 */
  encouraged: string[];

  // ── 散文风格描述（prose.md 部分）──────────────────
  /** 散文风格指引 */
  proseGuide: string;

  // ── 示例段落（examples.md 部分）──────────────────
  /** 示例段落 */
  examples: string;
}

/** 风格来源 */
export type StyleSource = "builtin" | "user" | "fork";

/**
 * StylePreset — 内置风格预设
 *
 * 继承 StyleConfig 完整字段 + 预设元数据
 */
export interface StylePreset extends StyleConfig {
  source: "builtin";
  /** 温度场景化映射（内置风格可自定义温度范围） */
  temperatureMap?: Partial<TemperatureMap>;
}

/**
 * UserStyleConfig — 用户自定义风格（DB 存储格式）
 *
 * 所有字段可选（除 styleId/displayName），未指定的用 builtin 默认值填充
 */
export interface UserStyleConfig {
  styleId: string;
  displayName: string;
  genre?: string;
  description?: string;
  source: StyleSource;
  /** fork 来源 */
  forkedFrom?: string;
  version: number;

  modules?: string[];
  reviewerFocus?: string[];
  contextWeights?: Partial<ContextWeights>;
  tone?: Partial<ToneControl>;
  forbidden?: ForbiddenRules;
  encouraged?: string[];

  proseGuide?: string;
  examples?: string;
}

/**
 * MergedStyleConfig — 合并后的最终风格
 *
 * builtin 为基座 + user override 合并后的结果
 */
export interface MergedStyleConfig extends StyleConfig {
  /** 来源 */
  source: StyleSource;
  /** fork 来源 */
  forkedFrom?: string;
}

/**
 * Anti-AI 自检结果
 */
export interface AntiAiCheckResult {
  /** 是否通过 */
  passed: boolean;
  /** 句长变化率 (burstiness) */
  burstiness: number;
  /** 检测到的问题 */
  issues: AntiAiIssue[];
}

export interface AntiAiIssue {
  /** 问题类型 */
  type:
    | "low_burstiness"
    | "repetitive_structure"
    | "emotional_telling"
    | "sensory_overload"
    | "exposition_dump"
    | "repetitive_thoughts"
    | "forbidden_word"
    | "mixed_language";
  /** 问题描述 */
  description: string;
  /** 问题位置（段落索引） */
  location?: number;
  /** 证据原文片段 */
  evidence?: string;
}

/**
 * WriterContext — 传递给执笔的完整写作上下文
 */
export interface WriterContext {
  /** 项目 ID */
  projectId: string;
  /** 章节号 */
  chapterNumber: number;
  /** 弧段号 */
  arcNumber: number;
  /** 章节类型 */
  chapterType: ChapterType;
  /** 章节 Brief */
  brief?: string;
  /** 合并后的风格配置 */
  style: MergedStyleConfig;
  /** 动态计算的温度 */
  temperature: number;
  /** ContextAssembler 装配的上下文（摘要、设定、角色等） */
  assembledContext: string;
  /** 当前加载的专项模块内容 */
  moduleContents: Record<string, string>;
}

/**
 * WriterResult — 执笔产出
 */
export interface WriterResult {
  /** 章节内容 */
  content: string;
  /** 字数 */
  wordCount: number;
  /** Anti-AI 自检结果 */
  antiAiCheck: AntiAiCheckResult;
  /** token 使用量 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * 流式写作 chunk
 */
export interface WritingChunk {
  /** 文本片段 */
  text: string;
  /** 累计字数 */
  cumulativeWordCount: number;
}

/** 默认温度映射 (§4.4) */
export const DEFAULT_TEMPERATURE_MAP: TemperatureMap = {
  daily: [0.70, 0.75],
  normal: [0.78, 0.82],
  emotional: [0.85, 0.90],
  action: [0.83, 0.88],
  climax: [0.88, 0.95],
};

/** 默认上下文权重 */
export const DEFAULT_CONTEXT_WEIGHTS: ContextWeights = {
  world: 1.0,
  character: 1.0,
  plot: 1.0,
};

/** 默认基调 */
export const DEFAULT_TONE: ToneControl = {
  humor: 0.3,
  tension: 0.5,
  romance: 0.3,
  dark: 0.2,
};
