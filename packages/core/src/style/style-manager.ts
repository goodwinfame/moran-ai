/**
 * StyleManager — 风格引擎管理器
 *
 * 职责：
 * 1. 加载内置风格预设 (builtin)
 * 2. 加载用户自定义风格 (DB)
 * 3. 合并 builtin + user override
 * 4. 温度场景化计算
 * 5. 风格上下文组装（供 ContextAssembler 使用）
 */

import { createLogger } from "../logger/index.js";
import { BUILTIN_PRESETS, DEFAULT_STYLE_ID } from "./presets/index.js";
import type {
  ChapterType,
  ContextWeights,
  MergedStyleConfig,
  StyleConfig,
  StylePreset,
  StyleSource,
  ToneControl,
  UserStyleConfig,
} from "./types.js";
import {
  DEFAULT_CONTEXT_WEIGHTS,
  DEFAULT_TEMPERATURE_MAP,
  DEFAULT_TONE,
} from "./types.js";

const logger = createLogger("style-manager");

/**
 * StyleManager — 风格引擎核心
 */
export class StyleManager {
  /** 运行时风格缓存：styleId → MergedStyleConfig */
  private cache: Map<string, MergedStyleConfig> = new Map();

  constructor() {
    // 预加载所有 builtin 到缓存
    for (const [id, preset] of BUILTIN_PRESETS) {
      this.cache.set(id, { ...preset, source: "builtin" });
    }
    logger.info({ count: BUILTIN_PRESETS.size }, "Built-in style presets loaded");
  }

  // ── 查询 ──────────────────────────────────────────────

  /** 获取风格配置（先查缓存，未命中返回默认） */
  getStyle(styleId: string): MergedStyleConfig {
    const cached = this.cache.get(styleId);
    if (cached) return cached;
    logger.warn({ styleId }, "Style not found, falling back to default");
    return this.getDefaultStyle();
  }

  /** 获取默认风格（云墨） */
  getDefaultStyle(): MergedStyleConfig {
    const defaultStyle = this.cache.get(DEFAULT_STYLE_ID);
    if (!defaultStyle) {
      throw new Error(`Default style "${DEFAULT_STYLE_ID}" not found — this should never happen`);
    }
    return defaultStyle;
  }

  /** 列出所有可用风格 */
  listStyles(): Array<{ styleId: string; displayName: string; genre: string; source: StyleSource }> {
    return Array.from(this.cache.values()).map((s) => ({
      styleId: s.styleId,
      displayName: s.displayName,
      genre: s.genre,
      source: s.source,
    }));
  }

  /** 检查风格是否存在 */
  hasStyle(styleId: string): boolean {
    return this.cache.has(styleId);
  }

  /** 获取内置风格预设 */
  getBuiltinPreset(styleId: string): StylePreset | undefined {
    return BUILTIN_PRESETS.get(styleId);
  }

  // ── 用户风格管理 ──────────────────────────────────────

  /**
   * 注册用户自定义风格
   *
   * 如果 source='fork'，则以 forkedFrom 指定的 builtin 为基座合并。
   * 如果 source='user'，则使用默认风格（云墨）为基座合并。
   */
  registerUserStyle(userConfig: UserStyleConfig): MergedStyleConfig {
    let base: StyleConfig;

    if (userConfig.source === "fork" && userConfig.forkedFrom) {
      const builtin = BUILTIN_PRESETS.get(userConfig.forkedFrom);
      if (!builtin) {
        logger.warn(
          { forkedFrom: userConfig.forkedFrom },
          "Fork source not found, using default",
        );
        base = this.getDefaultStyle();
      } else {
        base = builtin;
      }
    } else {
      base = this.getDefaultStyle();
    }

    const merged = this.mergeStyles(base, userConfig);
    this.cache.set(merged.styleId, merged);
    logger.info(
      { styleId: merged.styleId, source: merged.source },
      "User style registered",
    );
    return merged;
  }

  /**
   * 从 DB 行数据加载用户风格
   */
  loadFromDbRow(row: {
    styleId: string;
    displayName: string;
    genre: string | null;
    description: string | null;
    source: string;
    forkedFrom: string | null;
    version: number | null;
    modules: unknown;
    reviewerFocus: unknown;
    contextWeights: unknown;
    tone: unknown;
    forbidden: unknown;
    encouraged: unknown;
    proseGuide: string | null;
    examples: string | null;
  }): MergedStyleConfig {
    const userConfig: UserStyleConfig = {
      styleId: row.styleId,
      displayName: row.displayName,
      genre: row.genre ?? undefined,
      description: row.description ?? undefined,
      source: row.source as StyleSource,
      forkedFrom: row.forkedFrom ?? undefined,
      version: row.version ?? 1,
      modules: (row.modules as string[] | null) ?? undefined,
      reviewerFocus: (row.reviewerFocus as string[] | null) ?? undefined,
      contextWeights: (row.contextWeights as Record<string, number> | null) ?? undefined,
      tone: (row.tone as Record<string, number> | null) ?? undefined,
      forbidden: (row.forbidden as { words?: string[]; patterns?: string[] } | null) ?? undefined,
      encouraged: (row.encouraged as string[] | null) ?? undefined,
      proseGuide: row.proseGuide ?? undefined,
      examples: row.examples ?? undefined,
    };
    return this.registerUserStyle(userConfig);
  }

  /** 移除用户风格（不能移除 builtin） */
  removeStyle(styleId: string): boolean {
    if (BUILTIN_PRESETS.has(styleId)) {
      logger.warn({ styleId }, "Cannot remove built-in style");
      return false;
    }
    return this.cache.delete(styleId);
  }

  // ── 温度场景化 ──────────────────────────────────────────

  /**
   * 根据章节类型计算温度
   *
   * 算法：取对应章节类型的温度范围的中间值。
   * 如果风格预设有自定义温度范围，则优先使用。
   */
  calculateTemperature(styleId: string, chapterType: ChapterType): number {
    const style = this.getStyle(styleId);
    const preset = BUILTIN_PRESETS.get(style.forkedFrom ?? style.styleId);
    const customMap = preset?.temperatureMap;

    const range = customMap?.[chapterType] ?? DEFAULT_TEMPERATURE_MAP[chapterType];
    if (!range) {
      return DEFAULT_TEMPERATURE_MAP.normal[0];
    }

    // 取范围中间值（带微小随机偏移）
    const [min, max] = range;
    return Number(((min + max) / 2).toFixed(3));
  }

  /**
   * 获取温度范围（用于展示）
   */
  getTemperatureRange(styleId: string, chapterType: ChapterType): [number, number] {
    const style = this.getStyle(styleId);
    const preset = BUILTIN_PRESETS.get(style.forkedFrom ?? style.styleId);
    const customMap = preset?.temperatureMap;
    return customMap?.[chapterType] ?? DEFAULT_TEMPERATURE_MAP[chapterType];
  }

  // ── 风格上下文组装 ──────────────────────────────────────

  /**
   * 组装风格上下文字符串（注入执笔 system prompt）
   *
   * 按照 §4.4 ContextAssembler 优先级：
   * 1. 结构化约束（~200 tokens）
   * 2. 散文风格描述（~800 tokens）
   * 3. 示例段落（~1200 tokens）
   *
   * 总上下文 ≤ 3500 tokens ≈ 7000 中文字符
   */
  assembleStyleContext(styleId: string): string {
    const style = this.getStyle(styleId);
    const sections: string[] = [];

    // 1. 结构化约束
    sections.push(this.formatConstraints(style));

    // 2. 散文风格描述
    if (style.proseGuide) {
      sections.push(style.proseGuide);
    }

    // 3. 示例段落
    if (style.examples) {
      sections.push(style.examples);
    }

    return sections.join("\n\n---\n\n");
  }

  // ── 内部方法 ──────────────────────────────────────────

  /**
   * 合并基座风格 + 用户覆盖
   */
  private mergeStyles(base: StyleConfig, override: UserStyleConfig): MergedStyleConfig {
    return {
      styleId: override.styleId,
      displayName: override.displayName,
      genre: override.genre ?? base.genre,
      description: override.description ?? base.description,
      version: override.version,
      source: override.source,
      forkedFrom: override.forkedFrom,

      modules: override.modules ?? base.modules,
      reviewerFocus: override.reviewerFocus ?? base.reviewerFocus,
      contextWeights: this.mergeContextWeights(
        base.contextWeights,
        override.contextWeights,
      ),
      tone: this.mergeTone(base.tone, override.tone),
      forbidden: this.mergeForbidden(base.forbidden, override.forbidden),
      encouraged: override.encouraged ?? base.encouraged,

      proseGuide: override.proseGuide ?? base.proseGuide,
      examples: override.examples ?? base.examples,
    };
  }

  private mergeContextWeights(
    base: ContextWeights,
    override?: Partial<ContextWeights>,
  ): ContextWeights {
    if (!override) return { ...base };
    const result: ContextWeights = {
      world: DEFAULT_CONTEXT_WEIGHTS.world,
      character: DEFAULT_CONTEXT_WEIGHTS.character,
      plot: DEFAULT_CONTEXT_WEIGHTS.plot,
    };
    // Apply base values
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined) result[k] = v;
    }
    // Apply override values
    for (const [k, v] of Object.entries(override)) {
      if (v !== undefined) result[k] = v;
    }
    return result;
  }

  private mergeTone(base: ToneControl, override?: Partial<ToneControl>): ToneControl {
    if (!override) return { ...base };
    const result: ToneControl = {
      humor: DEFAULT_TONE.humor,
      tension: DEFAULT_TONE.tension,
      romance: DEFAULT_TONE.romance,
      dark: DEFAULT_TONE.dark,
    };
    // Apply base values
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined) result[k] = v;
    }
    // Apply override values
    for (const [k, v] of Object.entries(override)) {
      if (v !== undefined) result[k] = v;
    }
    return result;
  }

  private mergeForbidden(
    base: { words?: string[]; patterns?: string[] },
    override?: { words?: string[]; patterns?: string[] },
  ): { words?: string[]; patterns?: string[] } {
    if (!override) return { ...base };
    return {
      words: [...(base.words ?? []), ...(override.words ?? [])],
      patterns: [...(base.patterns ?? []), ...(override.patterns ?? [])],
    };
  }

  /**
   * 格式化结构化约束为文本
   */
  private formatConstraints(style: StyleConfig): string {
    const lines: string[] = [];
    lines.push(`# 风格配置：${style.displayName}`);
    lines.push(`题材：${style.genre}`);
    lines.push("");

    if (style.modules.length > 0) {
      lines.push(`## 必选专项模块`);
      lines.push(style.modules.map((m) => `- ${m}`).join("\n"));
      lines.push("");
    }

    if (style.tone) {
      lines.push(`## 基调控制`);
      for (const [key, value] of Object.entries(style.tone)) {
        const bar = "█".repeat(Math.round(value * 10)) + "░".repeat(10 - Math.round(value * 10));
        lines.push(`- ${key}: ${bar} (${value})`);
      }
      lines.push("");
    }

    if (style.forbidden.words && style.forbidden.words.length > 0) {
      lines.push(`## 禁忌词`);
      lines.push(`绝对不允许出现以下词汇：${style.forbidden.words.join("、")}`);
      lines.push("");
    }

    if (style.forbidden.patterns && style.forbidden.patterns.length > 0) {
      lines.push(`## 禁忌模式`);
      lines.push(`避免以下表达模式：`);
      lines.push(style.forbidden.patterns.map((p) => `- \`${p}\``).join("\n"));
      lines.push("");
    }

    if (style.encouraged.length > 0) {
      lines.push(`## 鼓励的表达方式`);
      lines.push(style.encouraged.map((e) => `- ${e}`).join("\n"));
      lines.push("");
    }

    if (style.reviewerFocus.length > 0) {
      lines.push(`## 审校重点`);
      lines.push(style.reviewerFocus.map((r) => `- ${r}`).join("\n"));
    }

    return lines.join("\n");
  }

  /** 清除所有缓存（主要用于测试） */
  clearCache(): void {
    this.cache.clear();
    // 重新加载 builtin
    for (const [id, preset] of BUILTIN_PRESETS) {
      this.cache.set(id, { ...preset, source: "builtin" });
    }
  }
}
