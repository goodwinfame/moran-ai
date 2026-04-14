/**
 * PlantserPipeline — Plantser 写作流程核心
 *
 * Plantser = Planner + Pantser
 * 三层 Brief 生成 + 情感地雷自动植入 + Scene-Sequel 标注
 *
 * 流程：
 *   1. 分析弧段计划和章节大纲 → 提取硬约束
 *   2. 生成情感地雷 → 植入 Brief
 *   3. 标注 Scene-Sequel → 丰富 Brief
 *   4. (可选) LLM 增强 → 完善三层结构
 */

import type { SessionProjectBridge } from "../bridge/bridge.js";
import { createLogger } from "../logger/index.js";
import { extractJson } from "../lingxi/lingxi-engine.js";
import type { ChapterOutline } from "../jiangxin/types.js";
import type {
  PlantserBrief,
  PlantserConfig,
  PlantserInput,
  PlantserProgress,
  HardConstraints,
  SoftGuidance,
  FreeZone,
  EmotionalLandmine,
  SceneSequelAnnotation,
  SceneSequelCycle,
} from "./types.js";
import { DEFAULT_PLANTSER_CONFIG } from "./types.js";
import { buildPlantserBriefPrompt, buildLandminePrompt, isValidLandmineType, PLANTSER_SYSTEM_PROMPT } from "./prompts.js";

const logger = createLogger("plantser-pipeline");

/**
 * PlantserPipeline — 三层 Brief 生成引擎
 */
export class PlantserPipeline {
  private readonly config: PlantserConfig;

  constructor(config?: Partial<PlantserConfig>) {
    this.config = { ...DEFAULT_PLANTSER_CONFIG, ...config };
  }

  /** 获取配置 */
  getConfig(): Readonly<PlantserConfig> {
    return this.config;
  }

  /**
   * 生成 Plantser 三层 Brief
   *
   * 完整流程：分析 → 约束提取 → 情感地雷 → Scene-Sequel → (LLM增强)
   */
  async generateBrief(
    input: PlantserInput,
    bridge: SessionProjectBridge,
    onProgress?: (progress: PlantserProgress) => void,
  ): Promise<{ brief: PlantserBrief; usage: { inputTokens: number; outputTokens: number } }> {
    let totalInput = 0;
    let totalOutput = 0;

    // Step 1: 分析弧段计划，提取基础约束
    onProgress?.({ stage: "analyzing", message: "分析弧段计划和章节位置…" });
    const chapterOutline = input.arcPlan.chapterOutlines[input.chapterIndexInArc - 1];
    const baseConstraints = extractBaseConstraints(input, chapterOutline);
    const baseSoftGuidance = extractBaseSoftGuidance(input, chapterOutline);
    const baseFreeZone = buildBaseFreeZone(chapterOutline);

    // Step 2: 生成情感地雷
    onProgress?.({ stage: "landmines", message: "植入情感地雷…" });
    let landmines: EmotionalLandmine[];
    if (this.config.useLLMEnhancement && input.characterStates.length > 0) {
      const landmineResult = await this.generateLandminesViaLLM(input, chapterOutline, bridge);
      landmines = landmineResult.landmines;
      totalInput += landmineResult.usage.inputTokens;
      totalOutput += landmineResult.usage.outputTokens;
    } else {
      landmines = generateLandminesFromRules(input);
    }
    // Enforce min/max limits
    landmines = landmines.slice(0, this.config.maxLandminesPerChapter);
    if (landmines.length < this.config.minLandminesPerChapter && input.characterStates.length > 0) {
      const fallbacks = generateFallbackLandmines(input, landmines.length);
      landmines = [...landmines, ...fallbacks].slice(0, this.config.maxLandminesPerChapter);
    }
    baseConstraints.emotionalLandmines = landmines;

    // Step 3: Scene-Sequel 标注
    onProgress?.({ stage: "scene_sequel", message: "标注 Scene-Sequel 结构…" });
    let sceneSequelAnnotations: SceneSequelAnnotation[] = [];
    let sceneSequelCycles: SceneSequelCycle[] | undefined;
    if (this.config.autoSceneSequel) {
      const ssResult = generateSceneSequelAnnotations(input, chapterOutline);
      sceneSequelAnnotations = ssResult.annotations;
      sceneSequelCycles = ssResult.cycles;
    }
    baseSoftGuidance.sceneSequel = sceneSequelAnnotations;

    // Step 4: LLM 增强（可选）
    if (this.config.useLLMEnhancement) {
      onProgress?.({ stage: "enhancing", message: "LLM 增强三层 Brief…" });
      const enhanceResult = await this.enhanceBriefViaLLM(input, baseConstraints, baseSoftGuidance, baseFreeZone, bridge);
      totalInput += enhanceResult.usage.inputTokens;
      totalOutput += enhanceResult.usage.outputTokens;

      // Merge LLM enhancements (LLM can add to soft guidance and free zone, but cannot override hard constraints)
      if (enhanceResult.enhancedGuidance) {
        mergeSoftGuidance(baseSoftGuidance, enhanceResult.enhancedGuidance);
      }
      if (enhanceResult.enhancedFreeZone) {
        mergeFreeZone(baseFreeZone, enhanceResult.enhancedFreeZone);
      }
      if (enhanceResult.enhancedConstraints) {
        mergeHardConstraints(baseConstraints, enhanceResult.enhancedConstraints);
      }
    }

    onProgress?.({ stage: "complete", message: "Brief 生成完成" });

    const brief: PlantserBrief = {
      chapterNumber: input.chapterNumber,
      arcNumber: input.arcPlan.arcNumber,
      positionInArc: `${input.chapterIndexInArc}/${input.arcPlan.chapterCount}`,
      chapterType: chapterOutline?.chapterType ?? "normal",
      isExplosion: chapterOutline?.isExplosion ?? false,
      hardConstraints: baseConstraints,
      softGuidance: baseSoftGuidance,
      freeZone: baseFreeZone,
      sceneSequelCycles,
      outline: chapterOutline?.description ?? "",
    };

    logger.info(
      {
        chapter: input.chapterNumber,
        arc: input.arcPlan.arcNumber,
        landmines: landmines.length,
        sceneSequels: sceneSequelAnnotations.length,
      },
      "Plantser Brief generated",
    );

    return { brief, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
  }

  // ── Private: LLM 情感地雷 ──────────────────────────

  private async generateLandminesViaLLM(
    input: PlantserInput,
    chapterOutline: ChapterOutline | undefined,
    bridge: SessionProjectBridge,
  ): Promise<{ landmines: EmotionalLandmine[]; usage: { inputTokens: number; outputTokens: number } }> {
    const prompt = buildLandminePrompt(
      input.chapterNumber,
      chapterOutline?.chapterType ?? "normal",
      input.characterStates,
      chapterOutline?.description ?? "（无大纲）",
      input.previousEndMood,
    );

    const response = await bridge.invokeAgent({
      agentId: this.config.briefAgentId,
      sessionId: `plantser-landmine-${input.projectId}`,
      message: prompt,
      systemPrompt: PLANTSER_SYSTEM_PROMPT,
    });

    const landmines = parseLandmineResponse(response.content);

    return {
      landmines,
      usage: response.usage,
    };
  }

  // ── Private: LLM Brief 增强 ──────────────────────────

  private async enhanceBriefViaLLM(
    input: PlantserInput,
    _constraints: HardConstraints,
    _guidance: SoftGuidance,
    _freeZone: FreeZone,
    bridge: SessionProjectBridge,
  ): Promise<{
    enhancedConstraints?: Partial<HardConstraints>;
    enhancedGuidance?: Partial<SoftGuidance>;
    enhancedFreeZone?: Partial<FreeZone>;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    const prompt = buildPlantserBriefPrompt(input);

    const response = await bridge.invokeAgent({
      agentId: this.config.briefAgentId,
      sessionId: `plantser-brief-${input.projectId}`,
      message: prompt,
      systemPrompt: PLANTSER_SYSTEM_PROMPT,
    });

    const parsed = parseBriefEnhancementResponse(response.content);

    return {
      ...parsed,
      usage: response.usage,
    };
  }
}

// ── 规则引擎：硬约束提取 ──────────────────────────────

function extractBaseConstraints(
  input: PlantserInput,
  _chapterOutline: ChapterOutline | undefined,
): HardConstraints {
  const mustAppear: string[] = [];
  const mustAdvance: HardConstraints["mustAdvance"] = [];
  const mustHappen: string[] = [];
  const mustNot: string[] = [];

  // 从弧段计划的爆点中提取约束
  for (const explosion of input.arcPlan.explosionPoints) {
    if (explosion.chapterIndex === input.chapterIndexInArc) {
      mustHappen.push(explosion.description);
      // 爆点章回收的伏笔
      for (const fId of explosion.resolvedForeshadowing) {
        mustAdvance.push({
          thread: fId,
          progress: "回收此伏笔",
        });
      }
    }
  }

  // 从弧段计划的角色弧线提取出场角色
  for (const arc of input.arcPlan.characterArcs) {
    // 主要角色在大多数章节都应出场（根据弧段进度）
    mustAppear.push(arc.characterName);
  }

  // 从角色状态中识别有活跃关系变化的角色（强约束其出场）
  for (const cs of input.characterStates) {
    if (cs.recentRelationshipChanges && cs.recentRelationshipChanges.length > 0) {
      if (!mustAppear.includes(cs.name)) {
        mustAppear.push(cs.name);
      }
    }
  }

  // 从开放伏笔中检查是否有需要推进的
  // （弧段中后期章节应考虑推进积累的伏笔）
  const progressRatio = input.chapterIndexInArc / input.arcPlan.chapterCount;
  if (progressRatio > 0.7 && input.openForeshadowing.length > 0) {
    // 弧段后30%，提示推进开放伏笔
    const hint = input.openForeshadowing[0];
    if (hint) {
      mustAdvance.push({
        thread: hint,
        progress: "推进或回收此伏笔（弧段接近尾声）",
      });
    }
  }

  return {
    mustAppear: [...new Set(mustAppear)], // deduplicate
    mustAdvance,
    mustHappen,
    mustNot,
    emotionalLandmines: [], // will be filled in step 2
  };
}

// ── 规则引擎：软引导提取 ──────────────────────────────

function extractBaseSoftGuidance(
  input: PlantserInput,
  chapterOutline: ChapterOutline | undefined,
): SoftGuidance {
  const suggestedScenes: string[] = [];
  const foreshadowingHints: SoftGuidance["foreshadowingHints"] = [];

  // 根据前一章的情感结束基调，建议开头氛围
  const mood = input.previousEndMood
    ? `从"${input.previousEndMood}"自然过渡`
    : chapterOutline?.chapterType === "explosion"
      ? "紧张感逐步升高"
      : chapterOutline?.chapterType === "emotional"
        ? "情感氛围酝酿"
        : chapterOutline?.chapterType === "action"
          ? "节奏逐步加快"
          : "自然铺陈";

  // 从弧段伏笔中找适合在本章埋设的
  for (const fs of input.arcPlan.foreshadowing) {
    // 伏笔应在弧段前半段埋设
    const plantWindow = Math.min(
      Math.floor(input.arcPlan.chapterCount * 0.5),
      input.chapterIndexInArc + 2,
    );
    if (input.chapterIndexInArc <= plantWindow) {
      foreshadowingHints.push({
        plant: fs.description,
        resolveHint: fs.resolvedInArc ? `弧段 ${fs.resolvedInArc}` : undefined,
      });
    }
  }

  // 大纲描述作为场景建议
  if (chapterOutline?.description) {
    suggestedScenes.push(chapterOutline.description);
  }

  return {
    mood,
    suggestedScenes,
    foreshadowingHints,
    sceneSequel: [], // will be filled in step 3
  };
}

// ── 规则引擎：自由区 ──────────────────────────────────

function buildBaseFreeZone(chapterOutline: ChapterOutline | undefined): FreeZone {
  const areas = [
    "具体对话内容由执笔自行创作",
    "描写方式和修辞手法",
    "过渡段落的处理",
    "可添加不在计划中的小事件（不与硬约束冲突即可）",
  ];

  const encouragements: string[] = [];

  switch (chapterOutline?.chapterType) {
    case "daily":
      encouragements.push("鼓励加入生活化的有趣细节");
      encouragements.push("可以用幽默轻松的笔触");
      break;
    case "emotional":
      encouragements.push("鼓励深入挖掘角色内心矛盾");
      encouragements.push("追求'意料之外、情理之中'的情感表达");
      break;
    case "action":
      encouragements.push("鼓励用电影感的动作描写");
      encouragements.push("可以打破常规的战斗套路");
      break;
    case "explosion":
      encouragements.push("这是爆点章，鼓励大胆的转折和情感爆发");
      encouragements.push("追求'金句'和让读者震撼的瞬间");
      break;
    default:
      encouragements.push("鼓励加入意想不到但合乎逻辑的小细节");
      break;
  }

  return { areas, encouragements };
}

// ── 规则引擎：情感地雷（无 LLM） ──────────────────────

/** 纯规则生成情感地雷 */
export function generateLandminesFromRules(input: PlantserInput): EmotionalLandmine[] {
  const landmines: EmotionalLandmine[] = [];
  const chapterOutline = input.arcPlan.chapterOutlines[input.chapterIndexInArc - 1];
  const chapterType = chapterOutline?.chapterType ?? "normal";

  for (const cs of input.characterStates) {
    if (!cs.psychology) continue;

    // 角色有 LIE+GHOST → 容易触发情感同时性
    if (cs.psychology.lie && cs.psychology.ghost) {
      landmines.push({
        type: "emotional_simultaneity",
        description: `${cs.name}的LIE("${truncate(cs.psychology.lie, 30)}")被触发，同时感受到矛盾情感`,
        involvedCharacters: [cs.name],
      });
    }

    // 弧线进度中期(30-70%) → 适合非理性行为
    if (cs.arcProgress !== undefined && cs.arcProgress > 0.3 && cs.arcProgress < 0.7) {
      landmines.push({
        type: "irrational_behavior",
        description: `${cs.name}做出不合逻辑但合乎其WANT("${truncate(cs.psychology.want, 30)}")的选择`,
        involvedCharacters: [cs.name],
      });
    }

    // 弧线后期(70%+) → 适合反期待
    if (cs.arcProgress !== undefined && cs.arcProgress >= 0.7) {
      landmines.push({
        type: "anti_expectation",
        description: `${cs.name}的行为打破此前建立的预期模式`,
        involvedCharacters: [cs.name],
      });
    }
  }

  // 动作章/爆点章 → 身体先行
  if (chapterType === "action" || chapterType === "explosion") {
    const mainChar = input.characterStates[0];
    if (mainChar) {
      landmines.push({
        type: "body_first",
        description: `${mainChar.name}的身体反应先于意识做出判断`,
        involvedCharacters: [mainChar.name],
      });
    }
  }

  return landmines;
}

/** 当 LLM 生成的地雷不够最小数量时，用规则补充 */
function generateFallbackLandmines(
  input: PlantserInput,
  existingCount: number,
): EmotionalLandmine[] {
  const allFromRules = generateLandminesFromRules(input);
  // Return only the ones needed to reach minimum
  return allFromRules.slice(existingCount);
}

// ── Scene-Sequel 规则引擎 ──────────────────────────────

function generateSceneSequelAnnotations(
  input: PlantserInput,
  chapterOutline: ChapterOutline | undefined,
): { annotations: SceneSequelAnnotation[]; cycles: SceneSequelCycle[] } {
  const chapterType = chapterOutline?.chapterType ?? "normal";
  const annotations: SceneSequelAnnotation[] = [];
  const cycles: SceneSequelCycle[] = [];

  // 根据章节类型决定 Scene-Sequel 分配
  switch (chapterType) {
    case "action":
    case "explosion":
      // 动作/爆点章：多 Scene 少 Sequel
      annotations.push(
        { index: 1, type: "scene", summary: "核心冲突行动段" },
        { index: 2, type: "scene", summary: "冲突升级或第二战场" },
        { index: 3, type: "sequel", summary: "行动后果的情感处理" },
      );
      break;
    case "emotional":
      // 情感章：Scene-Sequel 交替
      annotations.push(
        { index: 1, type: "scene", summary: "触发情感的事件" },
        { index: 2, type: "sequel", summary: "情感反应和内心挣扎" },
        { index: 3, type: "mixed", summary: "决定+新事件（承上启下）" },
      );
      break;
    case "daily":
      // 日常章：轻量 Scene-Sequel
      annotations.push(
        { index: 1, type: "mixed", summary: "日常互动中暗含线索推进" },
        { index: 2, type: "sequel", summary: "角色反思或关系微调" },
      );
      break;
    default:
      // 常规章：标准一个循环
      annotations.push(
        { index: 1, type: "scene", summary: "推进情节的行动段" },
        { index: 2, type: "sequel", summary: "消化结果并做出新决定" },
      );
      break;
  }

  // 生成详细的 Scene-Sequel 循环
  // 基于角色心理模型的驱动融合
  const mainChar = input.characterStates[0];
  if (mainChar?.psychology) {
    const p = mainChar.psychology;
    cycles.push({
      index: 1,
      scene: {
        goal: p.want || "推进核心目标",
        conflict: p.lie ? `"${truncate(p.lie, 40)}"被外部挑战` : "遭遇阻碍",
        disaster: "按旧模式行事带来更大问题",
      },
      sequel: {
        reaction: "情感冲击处理",
        dilemma: p.need
          ? `WANT("${truncate(p.want, 25)}")与NEED("${truncate(p.need, 25)}")的冲突`
          : "两难选择",
        decision: "朝 LIE 或 TRUTH 方向偏移一步",
      },
    });
  }

  return { annotations, cycles };
}

// ── LLM 响应解析 ──────────────────────────────────────

/** 解析情感地雷 LLM 响应 */
export function parseLandmineResponse(raw: string): EmotionalLandmine[] {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map((item: unknown) => toLandmine(item)).filter(
      (l): l is EmotionalLandmine => l !== null,
    );
  } catch {
    logger.warn("Failed to parse landmine response");
    return [];
  }
}

function toLandmine(item: unknown): EmotionalLandmine | null {
  if (typeof item !== "object" || item === null) return null;
  const obj = item as Record<string, unknown>;
  const rawType = obj.type;
  const type = isValidLandmineType(rawType) ? rawType : "emotional_simultaneity";
  return {
    type,
    description: typeof obj.description === "string" ? obj.description : "",
    involvedCharacters: toStringArray(obj.involvedCharacters ?? obj.involved_characters),
    trigger: typeof obj.trigger === "string" ? obj.trigger : undefined,
  };
}

/** 解析 Brief 增强 LLM 响应 */
export function parseBriefEnhancementResponse(raw: string): {
  enhancedConstraints?: Partial<HardConstraints>;
  enhancedGuidance?: Partial<SoftGuidance>;
  enhancedFreeZone?: Partial<FreeZone>;
} {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      enhancedConstraints: parsePartialConstraints(parsed.hardConstraints ?? parsed.hard_constraints),
      enhancedGuidance: parsePartialGuidance(parsed.softGuidance ?? parsed.soft_guidance),
      enhancedFreeZone: parsePartialFreeZone(parsed.freeZone ?? parsed.free_zone),
    };
  } catch {
    logger.warn("Failed to parse brief enhancement response");
    return {};
  }
}

function parsePartialConstraints(data: unknown): Partial<HardConstraints> | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const obj = data as Record<string, unknown>;
  const advanceRaw = obj.mustAdvance ?? obj.must_advance;
  const advanceArr = Array.isArray(advanceRaw) ? advanceRaw : undefined;
  const mustAppearRaw = obj.mustAppear ?? obj.must_appear;
  const mustHappenRaw = obj.mustHappen ?? obj.must_happen;
  const mustNotRaw = obj.mustNot ?? obj.must_not;
  return {
    mustAppear: mustAppearRaw ? toStringArray(mustAppearRaw) : undefined,
    mustAdvance: advanceArr
      ? advanceArr.map((item: unknown) => {
          if (typeof item !== "object" || item === null) return { thread: "", progress: "" };
          const o = item as Record<string, unknown>;
          return {
            thread: typeof o.thread === "string" ? o.thread : "",
            progress: typeof o.progress === "string" ? o.progress : "",
          };
        })
      : undefined,
    mustHappen: mustHappenRaw ? toStringArray(mustHappenRaw) : undefined,
    mustNot: mustNotRaw ? toStringArray(mustNotRaw) : undefined,
  };
}

function parsePartialGuidance(data: unknown): Partial<SoftGuidance> | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const obj = data as Record<string, unknown>;
  const hintsRaw = obj.foreshadowingHints ?? obj.foreshadowing_hints;
  const hintsArr = Array.isArray(hintsRaw) ? hintsRaw : undefined;
  const scenesRaw = obj.suggestedScenes ?? obj.suggested_scenes;
  return {
    mood: typeof obj.mood === "string" ? obj.mood : undefined,
    suggestedScenes: scenesRaw ? toStringArray(scenesRaw) : undefined,
    foreshadowingHints: hintsArr
      ? hintsArr.map((item: unknown) => {
          if (typeof item !== "object" || item === null) return { plant: "" };
          const o = item as Record<string, unknown>;
          return {
            plant: typeof o.plant === "string" ? o.plant : "",
            resolveHint: typeof o.resolveHint === "string" ? o.resolveHint : undefined,
          };
        })
      : undefined,
    suggestedPOV: typeof obj.suggestedPOV === "string" ? obj.suggestedPOV : undefined,
  };
}

function parsePartialFreeZone(data: unknown): Partial<FreeZone> | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const obj = data as Record<string, unknown>;
  return {
    areas: obj.areas ? toStringArray(obj.areas) : undefined,
    encouragements: obj.encouragements ? toStringArray(obj.encouragements) : undefined,
  };
}

// ── 合并辅助 ──────────────────────────────────────────

function mergeHardConstraints(base: HardConstraints, patch: Partial<HardConstraints>): void {
  if (patch.mustAppear) {
    for (const c of patch.mustAppear) {
      if (!base.mustAppear.includes(c)) base.mustAppear.push(c);
    }
  }
  if (patch.mustAdvance) {
    for (const a of patch.mustAdvance) {
      const exists = base.mustAdvance.some(b => b.thread === a.thread);
      if (!exists) base.mustAdvance.push(a);
    }
  }
  if (patch.mustHappen) {
    for (const h of patch.mustHappen) {
      if (!base.mustHappen.includes(h)) base.mustHappen.push(h);
    }
  }
  if (patch.mustNot) {
    for (const n of patch.mustNot) {
      if (!base.mustNot.includes(n)) base.mustNot.push(n);
    }
  }
}

function mergeSoftGuidance(base: SoftGuidance, patch: Partial<SoftGuidance>): void {
  if (patch.mood) base.mood = patch.mood;
  if (patch.suggestedScenes) {
    for (const s of patch.suggestedScenes) {
      if (!base.suggestedScenes.includes(s)) base.suggestedScenes.push(s);
    }
  }
  if (patch.foreshadowingHints) {
    for (const f of patch.foreshadowingHints) {
      base.foreshadowingHints.push(f);
    }
  }
  if (patch.suggestedPOV) base.suggestedPOV = patch.suggestedPOV;
}

function mergeFreeZone(base: FreeZone, patch: Partial<FreeZone>): void {
  if (patch.areas) {
    for (const a of patch.areas) {
      if (!base.areas.includes(a)) base.areas.push(a);
    }
  }
  if (patch.encouragements) {
    for (const e of patch.encouragements) {
      if (!base.encouragements.includes(e)) base.encouragements.push(e);
    }
  }
}

// ── 工具函数 ──────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v: unknown) => (typeof v === "string" ? v : String(v)))
    .filter((s: string) => s.length > 0);
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + "…";
}
