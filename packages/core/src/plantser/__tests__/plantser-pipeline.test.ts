/**
 * PlantserPipeline — 测试
 *
 * 覆盖：
 * - 规则引擎：硬约束提取、情感地雷规则生成、Scene-Sequel 标注
 * - LLM 响应解析：情感地雷解析、Brief 增强解析
 * - Prompt 构建：buildPlantserBriefPrompt、buildLandminePrompt
 * - Pipeline 完整流程（模拟 bridge）
 */

import { describe, it, expect, vi } from "vitest";
import { PlantserPipeline } from "../plantser-pipeline.js";
import {
  generateLandminesFromRules,
  parseLandmineResponse,
  parseBriefEnhancementResponse,
} from "../plantser-pipeline.js";
import {
  buildPlantserBriefPrompt,
  buildLandminePrompt,
  isValidLandmineType,
  PLANTSER_SYSTEM_PROMPT,
} from "../prompts.js";
import { DEFAULT_PLANTSER_CONFIG } from "../types.js";
import type {
  PlantserInput,
  CharacterState,
  EmotionalLandmineType,
} from "../types.js";
import type { ArcPlan, ChapterOutline } from "../../jiangxin/types.js";

// ── 测试数据 ──────────────────────────────────────────

function makeArcPlan(overrides?: Partial<ArcPlan>): ArcPlan {
  return {
    arcNumber: 1,
    name: "初入江湖",
    goal: "主角发现门派秘密",
    chapterCount: 30,
    explosionPoints: [
      {
        chapterIndex: 15,
        description: "发现师兄密会陌生人",
        type: "revelation",
        resolvedForeshadowing: ["fs-001"],
      },
    ],
    foreshadowing: [
      {
        id: "fs-001",
        description: "张远袖中的信物",
        plantedInArc: 1,
        resolvedInArc: 1,
        relatedCharacters: ["zhang-yuan"],
      },
      {
        id: "fs-002",
        description: "山洞中的古文字",
        plantedInArc: 1,
        relatedCharacters: ["lin-xiao"],
      },
    ],
    characterArcs: [
      { characterId: "lin-xiao", characterName: "林晓", arcProgress: "从信任到怀疑" },
      { characterId: "zhang-yuan", characterName: "张远", arcProgress: "秘密逐渐暴露" },
    ],
    chapterOutlines: Array.from({ length: 30 }, (_, i) => ({
      index: i + 1,
      description: `第${i + 1}章大纲描述`,
      chapterType: (i === 14 ? "explosion" : i % 5 === 0 ? "emotional" : "normal") as ChapterOutline["chapterType"],
      isExplosion: i === 14,
    })),
    ...overrides,
  };
}

function makeCharacterStates(): CharacterState[] {
  return [
    {
      id: "lin-xiao",
      name: "林晓",
      emotionalState: "困惑",
      arcProgress: 0.5,
      psychology: {
        want: "成为最强修仙者",
        need: "接纳自己的平凡",
        lie: "只有强大才能被爱",
        ghost: "幼年被强者抛弃",
      },
      recentRelationshipChanges: ["与张远的信任出现裂痕"],
    },
    {
      id: "zhang-yuan",
      name: "张远",
      emotionalState: "焦虑",
      arcProgress: 0.4,
      psychology: {
        want: "守护门派秘密",
        need: "坦诚面对兄弟",
        lie: "秘密是为了保护所有人",
        ghost: "亲眼目睹泄密导致的灾难",
      },
    },
  ];
}

function makePlantserInput(overrides?: Partial<PlantserInput>): PlantserInput {
  return {
    projectId: "proj-test",
    arcPlan: makeArcPlan(),
    chapterIndexInArc: 10,
    chapterNumber: 10,
    characterStates: makeCharacterStates(),
    openForeshadowing: ["张远袖中的信物", "山洞中的古文字"],
    previousChapterSummary: "林晓在修炼中感受到异常灵力波动，向张远提出疑问但被搪塞。",
    previousEndMood: "隐约不安",
    ...overrides,
  };
}

function makeMockBridge() {
  return {
    invokeAgent: vi.fn().mockResolvedValue({
      content: "mock response",
      usage: { inputTokens: 100, outputTokens: 200 },
    }),
    getProjectId: vi.fn().mockReturnValue("proj-test"),
    getSessionId: vi.fn().mockReturnValue("ses-test"),
  };
}

// ── Tests: 常量与配置 ──────────────────────────────────

describe("常量与配置", () => {
  it("DEFAULT_PLANTSER_CONFIG 有合理默认值", () => {
    expect(DEFAULT_PLANTSER_CONFIG.minLandminesPerChapter).toBe(1);
    expect(DEFAULT_PLANTSER_CONFIG.maxLandminesPerChapter).toBe(3);
    expect(DEFAULT_PLANTSER_CONFIG.autoSceneSequel).toBe(true);
    expect(DEFAULT_PLANTSER_CONFIG.maxCyclesPerChapter).toBe(3);
    expect(DEFAULT_PLANTSER_CONFIG.briefAgentId).toBe("jiangxin");
    expect(DEFAULT_PLANTSER_CONFIG.useLLMEnhancement).toBe(true);
  });

  it("PLANTSER_SYSTEM_PROMPT 包含 Plantser 理念", () => {
    expect(PLANTSER_SYSTEM_PROMPT).toContain("Plantser");
    expect(PLANTSER_SYSTEM_PROMPT).toContain("三层");
  });
});

// ── Tests: isValidLandmineType ──────────────────────────

describe("isValidLandmineType", () => {
  it("接受有效类型", () => {
    const validTypes: EmotionalLandmineType[] = [
      "emotional_simultaneity",
      "irrational_behavior",
      "anti_expectation",
      "body_first",
    ];
    for (const t of validTypes) {
      expect(isValidLandmineType(t)).toBe(true);
    }
  });

  it("拒绝无效类型", () => {
    expect(isValidLandmineType("invalid")).toBe(false);
    expect(isValidLandmineType(123)).toBe(false);
    expect(isValidLandmineType(null)).toBe(false);
  });
});

// ── Tests: Prompt 构建 ──────────────────────────────────

describe("Prompt 构建", () => {
  it("buildPlantserBriefPrompt 包含基本信息", () => {
    const input = makePlantserInput();
    const prompt = buildPlantserBriefPrompt(input);
    expect(prompt).toContain("章节编号：10");
    expect(prompt).toContain("弧段：1");
    expect(prompt).toContain("初入江湖");
    expect(prompt).toContain("10 / 30");
    expect(prompt).toContain("林晓");
    expect(prompt).toContain("张远");
    expect(prompt).toContain("JSON");
  });

  it("buildPlantserBriefPrompt 包含前一章摘要和基调", () => {
    const input = makePlantserInput();
    const prompt = buildPlantserBriefPrompt(input);
    expect(prompt).toContain("前一章摘要");
    expect(prompt).toContain("隐约不安");
  });

  it("buildPlantserBriefPrompt 爆点章有特殊提示", () => {
    const input = makePlantserInput({ chapterIndexInArc: 15, chapterNumber: 15 });
    const prompt = buildPlantserBriefPrompt(input);
    expect(prompt).toContain("爆点章");
  });

  it("buildPlantserBriefPrompt 无前一章信息时不报错", () => {
    const input = makePlantserInput({
      previousChapterSummary: undefined,
      previousEndMood: undefined,
      characterStates: [],
      openForeshadowing: [],
    });
    const prompt = buildPlantserBriefPrompt(input);
    expect(prompt).toContain("章节编号");
    expect(prompt).not.toContain("前一章摘要");
  });

  it("buildLandminePrompt 包含角色心理模型", () => {
    const states = makeCharacterStates();
    const prompt = buildLandminePrompt(10, "emotional", states, "发现秘密", "不安");
    expect(prompt).toContain("WANT");
    expect(prompt).toContain("LIE");
    expect(prompt).toContain("林晓");
    expect(prompt).toContain("emotional_simultaneity");
    expect(prompt).toContain("body_first");
  });

  it("buildLandminePrompt 无角色时不报错", () => {
    const prompt = buildLandminePrompt(5, "normal", [], "日常章节");
    expect(prompt).toContain("第 5 章");
  });
});

// ── Tests: 规则引擎 - 情感地雷 ──────────────────────────

describe("generateLandminesFromRules", () => {
  it("角色有 LIE+GHOST 时生成 emotional_simultaneity", () => {
    const input = makePlantserInput();
    const landmines = generateLandminesFromRules(input);
    const esMines = landmines.filter(l => l.type === "emotional_simultaneity");
    expect(esMines.length).toBeGreaterThanOrEqual(1);
    expect(esMines[0]!.involvedCharacters.length).toBeGreaterThan(0);
  });

  it("弧线中期角色生成 irrational_behavior", () => {
    const input = makePlantserInput();
    const landmines = generateLandminesFromRules(input);
    const irMines = landmines.filter(l => l.type === "irrational_behavior");
    expect(irMines.length).toBeGreaterThanOrEqual(1);
  });

  it("弧线后期角色生成 anti_expectation", () => {
    const states = makeCharacterStates();
    states[0]!.arcProgress = 0.8; // 后期
    const input = makePlantserInput({ characterStates: states });
    const landmines = generateLandminesFromRules(input);
    const aeMines = landmines.filter(l => l.type === "anti_expectation");
    expect(aeMines.length).toBeGreaterThanOrEqual(1);
  });

  it("动作章生成 body_first", () => {
    const arcPlan = makeArcPlan();
    arcPlan.chapterOutlines[9] = {
      index: 10,
      description: "战斗",
      chapterType: "action",
      isExplosion: false,
    };
    const input = makePlantserInput({ arcPlan });
    const landmines = generateLandminesFromRules(input);
    const bfMines = landmines.filter(l => l.type === "body_first");
    expect(bfMines.length).toBeGreaterThanOrEqual(1);
  });

  it("无角色状态时返回空数组", () => {
    const input = makePlantserInput({ characterStates: [] });
    const landmines = generateLandminesFromRules(input);
    expect(landmines).toEqual([]);
  });

  it("角色无心理模型时跳过", () => {
    const input = makePlantserInput({
      characterStates: [{ id: "test", name: "测试" }],
    });
    const landmines = generateLandminesFromRules(input);
    // No psychology → no landmines from LIE/GHOST rules
    // But action/explosion chapter can still generate body_first
    // With normal chapter and no psychology, should be empty
    expect(landmines).toEqual([]);
  });
});

// ── Tests: LLM 响应解析 — 情感地雷 ──────────────────────

describe("parseLandmineResponse", () => {
  it("正常解析情感地雷数组", () => {
    const raw = JSON.stringify([
      {
        type: "emotional_simultaneity",
        description: "林晓又愤怒又心疼",
        involvedCharacters: ["林晓"],
        trigger: "发现张远的秘密",
      },
      {
        type: "body_first",
        description: "拳头先于意识握紧",
        involvedCharacters: ["林晓"],
      },
    ]);
    const result = parseLandmineResponse(raw);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe("emotional_simultaneity");
    expect(result[0]!.description).toContain("又愤怒又心疼");
    expect(result[1]!.type).toBe("body_first");
  });

  it("处理 markdown 代码块包裹", () => {
    const raw = "```json\n" + JSON.stringify([
      { type: "anti_expectation", description: "意外转折", involvedCharacters: ["张远"] },
    ]) + "\n```";
    const result = parseLandmineResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("anti_expectation");
  });

  it("无效 type 回退 emotional_simultaneity", () => {
    const raw = JSON.stringify([
      { type: "invalid_type", description: "测试", involvedCharacters: [] },
    ]);
    const result = parseLandmineResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("emotional_simultaneity");
  });

  it("解析失败返回空数组", () => {
    expect(parseLandmineResponse("not json")).toEqual([]);
    expect(parseLandmineResponse("")).toEqual([]);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify([
      { type: "body_first", description: "test", involved_characters: ["A"] },
    ]);
    const result = parseLandmineResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.involvedCharacters).toEqual(["A"]);
  });
});

// ── Tests: LLM 响应解析 — Brief 增强 ──────────────────

describe("parseBriefEnhancementResponse", () => {
  it("正常解析三层结构", () => {
    const raw = JSON.stringify({
      hardConstraints: {
        mustAppear: ["林晓"],
        mustAdvance: [{ thread: "门派秘密", progress: "推进一步" }],
        mustHappen: ["发现线索"],
        mustNot: ["不能暴露身份"],
      },
      softGuidance: {
        mood: "从平静到紧张",
        suggestedScenes: ["修炼场景", "密会场景"],
        foreshadowingHints: [{ plant: "信物线索" }],
        suggestedPOV: "林晓视角",
      },
      freeZone: {
        areas: ["对话内容"],
        encouragements: ["加入幽默"],
      },
    });
    const result = parseBriefEnhancementResponse(raw);
    expect(result.enhancedConstraints?.mustAppear).toEqual(["林晓"]);
    expect(result.enhancedConstraints?.mustAdvance).toHaveLength(1);
    expect(result.enhancedGuidance?.mood).toBe("从平静到紧张");
    expect(result.enhancedGuidance?.suggestedScenes).toHaveLength(2);
    expect(result.enhancedFreeZone?.areas).toEqual(["对话内容"]);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      hard_constraints: {
        must_appear: ["张远"],
        must_advance: [{ thread: "线索", progress: "推进" }],
        must_happen: ["事件"],
        must_not: ["禁止"],
      },
    });
    const result = parseBriefEnhancementResponse(raw);
    expect(result.enhancedConstraints?.mustAppear).toEqual(["张远"]);
  });

  it("解析失败返回空对象", () => {
    const result = parseBriefEnhancementResponse("not json");
    expect(result.enhancedConstraints).toBeUndefined();
    expect(result.enhancedGuidance).toBeUndefined();
    expect(result.enhancedFreeZone).toBeUndefined();
  });

  it("部分字段缺失不报错", () => {
    const raw = JSON.stringify({
      softGuidance: { mood: "紧张" },
    });
    const result = parseBriefEnhancementResponse(raw);
    expect(result.enhancedGuidance?.mood).toBe("紧张");
    expect(result.enhancedConstraints).toBeUndefined();
  });
});

// ── Tests: PlantserPipeline 类 ──────────────────────────

describe("PlantserPipeline", () => {
  it("构造函数使用默认配置", () => {
    const pipeline = new PlantserPipeline();
    const config = pipeline.getConfig();
    expect(config.minLandminesPerChapter).toBe(1);
    expect(config.useLLMEnhancement).toBe(true);
  });

  it("构造函数接受自定义配置", () => {
    const pipeline = new PlantserPipeline({
      minLandminesPerChapter: 2,
      useLLMEnhancement: false,
    });
    const config = pipeline.getConfig();
    expect(config.minLandminesPerChapter).toBe(2);
    expect(config.useLLMEnhancement).toBe(false);
    // 其他字段保持默认
    expect(config.autoSceneSequel).toBe(true);
  });

  it("generateBrief（无LLM模式）完整生成三层 Brief", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();
    const input = makePlantserInput();

    const progressStages: string[] = [];
    const { brief, usage } = await pipeline.generateBrief(
      input,
      bridge as any,
      (p) => progressStages.push(p.stage),
    );

    // 检查进度回调
    expect(progressStages).toContain("analyzing");
    expect(progressStages).toContain("landmines");
    expect(progressStages).toContain("scene_sequel");
    expect(progressStages).toContain("complete");
    expect(progressStages).not.toContain("enhancing"); // 无 LLM 模式

    // 检查 Brief 结构
    expect(brief.chapterNumber).toBe(10);
    expect(brief.arcNumber).toBe(1);
    expect(brief.positionInArc).toBe("10/30");
    expect(brief.chapterType).toBe("normal");
    expect(brief.isExplosion).toBe(false);

    // 硬约束
    expect(brief.hardConstraints.mustAppear.length).toBeGreaterThan(0);
    expect(brief.hardConstraints.emotionalLandmines.length).toBeGreaterThanOrEqual(1);

    // 软引导
    expect(brief.softGuidance.mood).toBeTruthy();
    expect(brief.softGuidance.sceneSequel.length).toBeGreaterThan(0);

    // 自由区
    expect(brief.freeZone.areas.length).toBeGreaterThan(0);
    expect(brief.freeZone.encouragements.length).toBeGreaterThan(0);

    // 无 LLM 调用
    expect(bridge.invokeAgent).not.toHaveBeenCalled();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
  });

  it("generateBrief（LLM模式）调用 bridge 并合并结果", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: true });
    const bridge = makeMockBridge();

    // 情感地雷 LLM 返回
    bridge.invokeAgent
      .mockResolvedValueOnce({
        content: JSON.stringify([
          {
            type: "emotional_simultaneity",
            description: "LLM生成的情感地雷",
            involvedCharacters: ["林晓"],
          },
        ]),
        usage: { inputTokens: 50, outputTokens: 100 },
      })
      // Brief 增强 LLM 返回
      .mockResolvedValueOnce({
        content: JSON.stringify({
          hardConstraints: { mustNot: ["不能杀死林晓"] },
          softGuidance: { mood: "LLM增强的情感基调" },
          freeZone: { encouragements: ["LLM鼓励的创意"] },
        }),
        usage: { inputTokens: 80, outputTokens: 150 },
      });

    const input = makePlantserInput();
    const { brief, usage } = await pipeline.generateBrief(input, bridge as any);

    // LLM 被调用两次（地雷 + 增强）
    expect(bridge.invokeAgent).toHaveBeenCalledTimes(2);

    // 情感地雷来自 LLM
    expect(brief.hardConstraints.emotionalLandmines.length).toBeGreaterThanOrEqual(1);
    const llmMine = brief.hardConstraints.emotionalLandmines.find(
      l => l.description === "LLM生成的情感地雷",
    );
    expect(llmMine).toBeDefined();

    // 合并了 LLM 增强的约束
    expect(brief.hardConstraints.mustNot).toContain("不能杀死林晓");
    expect(brief.softGuidance.mood).toBe("LLM增强的情感基调");
    expect(brief.freeZone.encouragements).toContain("LLM鼓励的创意");

    // Token 消耗累计
    expect(usage.inputTokens).toBe(130); // 50 + 80
    expect(usage.outputTokens).toBe(250); // 100 + 150
  });

  it("爆点章 Brief 正确标注", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();
    const input = makePlantserInput({
      chapterIndexInArc: 15,
      chapterNumber: 15,
    });

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    expect(brief.isExplosion).toBe(true);
    expect(brief.chapterType).toBe("explosion");

    // 爆点章应有 mustHappen（从 explosionPoints 提取）
    expect(brief.hardConstraints.mustHappen.length).toBeGreaterThan(0);
    expect(brief.hardConstraints.mustHappen[0]).toContain("发现师兄密会陌生人");

    // 爆点章的伏笔回收
    expect(brief.hardConstraints.mustAdvance.some(a => a.thread === "fs-001")).toBe(true);
  });

  it("弧段后期章节提示推进伏笔", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();
    const input = makePlantserInput({
      chapterIndexInArc: 25, // 25/30 = 83% > 70%
      chapterNumber: 25,
    });

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    const foreshadowAdvance = brief.hardConstraints.mustAdvance.find(
      a => a.progress.includes("弧段接近尾声"),
    );
    expect(foreshadowAdvance).toBeDefined();
  });

  it("情感地雷数量受 min/max 限制", async () => {
    const pipeline = new PlantserPipeline({
      useLLMEnhancement: false,
      minLandminesPerChapter: 1,
      maxLandminesPerChapter: 2,
    });
    const bridge = makeMockBridge();
    const input = makePlantserInput();

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    expect(brief.hardConstraints.emotionalLandmines.length).toBeGreaterThanOrEqual(1);
    expect(brief.hardConstraints.emotionalLandmines.length).toBeLessThanOrEqual(2);
  });

  it("Scene-Sequel 禁用时不生成标注", async () => {
    const pipeline = new PlantserPipeline({
      useLLMEnhancement: false,
      autoSceneSequel: false,
    });
    const bridge = makeMockBridge();
    const input = makePlantserInput();

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    expect(brief.softGuidance.sceneSequel).toEqual([]);
  });

  it("不同章节类型生成不同 Scene-Sequel 模式", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();

    // 动作章
    const arcPlanAction = makeArcPlan();
    arcPlanAction.chapterOutlines[9] = {
      index: 10,
      description: "战斗",
      chapterType: "action",
      isExplosion: false,
    };
    const inputAction = makePlantserInput({ arcPlan: arcPlanAction });
    const { brief: briefAction } = await pipeline.generateBrief(inputAction, bridge as any);
    const actionScenes = briefAction.softGuidance.sceneSequel.filter(s => s.type === "scene");
    expect(actionScenes.length).toBeGreaterThanOrEqual(2); // 多 scene 少 sequel

    // 日常章
    const arcPlanDaily = makeArcPlan();
    arcPlanDaily.chapterOutlines[9] = {
      index: 10,
      description: "日常",
      chapterType: "daily",
      isExplosion: false,
    };
    const inputDaily = makePlantserInput({ arcPlan: arcPlanDaily });
    const { brief: briefDaily } = await pipeline.generateBrief(inputDaily, bridge as any);
    expect(briefDaily.softGuidance.sceneSequel.length).toBeLessThanOrEqual(2); // 轻量
  });

  it("角色有近期关系变化时强制出场", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();
    const input = makePlantserInput();

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    // 林晓有 recentRelationshipChanges，应在 mustAppear
    expect(brief.hardConstraints.mustAppear).toContain("林晓");
  });
});

// ── Tests: Scene-Sequel 角色驱动融合 ──────────────────

describe("Scene-Sequel 角色驱动融合", () => {
  it("sceneSequelCycles 与角色心理模型对齐", async () => {
    const pipeline = new PlantserPipeline({ useLLMEnhancement: false });
    const bridge = makeMockBridge();
    const input = makePlantserInput();

    const { brief } = await pipeline.generateBrief(input, bridge as any);
    expect(brief.sceneSequelCycles).toBeDefined();
    expect(brief.sceneSequelCycles!.length).toBeGreaterThanOrEqual(1);

    const cycle = brief.sceneSequelCycles![0]!;
    // Scene goal 应反映角色 WANT
    expect(cycle.scene.goal).toBeTruthy();
    // Sequel dilemma 应反映 WANT vs NEED 冲突
    expect(cycle.sequel.dilemma).toBeTruthy();
  });
});
