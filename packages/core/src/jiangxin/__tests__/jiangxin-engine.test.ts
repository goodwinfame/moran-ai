/**
 * JiangxinEngine 测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiangxinEngine } from "../jiangxin-engine.js";
import {
  parseChapterBriefResponse,
  parseCharacterDesignResponse,
  parseStructurePlanResponse,
  parseWorldDesignResponse,
} from "../jiangxin-engine.js";
import {
  buildChapterBriefPrompt,
  buildCharacterDesignPrompt,
  buildStructurePlanPrompt,
  buildWorldDesignPrompt,
} from "../prompts.js";
import type {
  CharacterDesignInput,
  StructurePlanInput,
  WorldDesignInput,
} from "../types.js";
import { DEFAULT_JIANGXIN_CONFIG } from "../types.js";
import type { SessionProjectBridge } from "../../bridge/bridge.js";

// ── Mock Bridge ──────────────────────────────────────

function createMockBridge(response: string): SessionProjectBridge {
  return {
    invokeAgent: vi.fn().mockResolvedValue({
      content: response,
      sessionId: "test-session",
      usage: { inputTokens: 150, outputTokens: 300 },
      agentId: "jiangxin" as const,
    }),
    bind: vi.fn(),
    getBinding: vi.fn(),
    ensureSession: vi.fn(),
    setActiveAgent: vi.fn(),
    complete: vi.fn(),
    release: vi.fn(),
    dispose: vi.fn(),
    getConfig: vi.fn(),
  } as unknown as SessionProjectBridge;
}

// ── parseWorldDesignResponse ────────────────────────

describe("parseWorldDesignResponse", () => {
  it("正常解析世界观设计", () => {
    const raw = JSON.stringify({
      overview: "一个修仙世界",
      subsystems: [
        {
          id: "power-system",
          name: "力量体系",
          tags: ["核心", "战斗"],
          description: "灵气修炼",
          rules: ["凝气→筑基→金丹", "每次突破需要机缘"],
        },
        {
          id: "social-hierarchy",
          name: "宗门等级",
          tags: ["核心", "社会"],
          description: "宗门制度",
          rules: ["外门→内门→核心弟子"],
        },
      ],
    });

    const result = parseWorldDesignResponse(raw);
    expect(result.overview).toBe("一个修仙世界");
    expect(result.subsystems).toHaveLength(2);
    expect(result.subsystems[0]?.id).toBe("power-system");
    expect(result.subsystems[0]?.rules).toHaveLength(2);
    expect(result.subsystems[1]?.tags).toEqual(["核心", "社会"]);
  });

  it("解析失败返回空", () => {
    const result = parseWorldDesignResponse("无效JSON");
    expect(result.overview).toContain("无效JSON");
    expect(result.subsystems).toHaveLength(0);
  });
});

// ── parseCharacterDesignResponse ────────────────────

describe("parseCharacterDesignResponse", () => {
  it("正常解析角色设计", () => {
    const raw = JSON.stringify({
      characters: [
        {
          id: "li-chen",
          name: "李辰",
          role: "protagonist",
          description: "天才弟子",
          biography: "出生于普通家庭...",
          psychology: {
            want: "成为最强",
            need: "接纳自己",
            lie: "力量就是一切",
            ghost: "幼年被欺凌",
          },
          quirks: {
            catchphrase: "这不过是开始",
            habits: ["搓手指"],
            eccentricities: ["收集奇石"],
          },
          relationships: [
            {
              targetId: "wang-mei",
              targetName: "王梅",
              type: "师兄妹",
              description: "一起长大",
              tension: "价值观冲突",
            },
          ],
          arcDescription: "从追求力量到接纳平凡",
        },
      ],
    });

    const result = parseCharacterDesignResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("李辰");
    expect(result[0]?.role).toBe("protagonist");
    expect(result[0]?.psychology.want).toBe("成为最强");
    expect(result[0]?.psychology.ghost).toBe("幼年被欺凌");
    expect(result[0]?.quirks.catchphrase).toBe("这不过是开始");
    expect(result[0]?.relationships).toHaveLength(1);
    expect(result[0]?.relationships[0]?.tension).toBe("价值观冲突");
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      characters: [{
        id: "test",
        name: "测试",
        role: "supporting",
        description: "",
        biography: "",
        psychology: { want: "", need: "", lie: "", ghost: "" },
        quirks: { habits: [], eccentricities: [] },
        relationships: [{
          target_id: "other",
          target_name: "其他",
          type: "友",
          description: "朋友",
        }],
        arc_description: "成长",
      }],
    });

    const result = parseCharacterDesignResponse(raw);
    expect(result[0]?.arcDescription).toBe("成长");
    expect(result[0]?.relationships[0]?.targetId).toBe("other");
  });

  it("无效 role 回退 supporting", () => {
    const raw = JSON.stringify({
      characters: [{
        id: "x",
        name: "X",
        role: "invalid_role",
        description: "",
        biography: "",
        psychology: { want: "", need: "", lie: "", ghost: "" },
        quirks: { habits: [], eccentricities: [] },
        relationships: [],
        arcDescription: "",
      }],
    });

    const result = parseCharacterDesignResponse(raw);
    expect(result[0]?.role).toBe("supporting");
  });

  it("解析失败返回空数组", () => {
    const result = parseCharacterDesignResponse("不是JSON");
    expect(result).toEqual([]);
  });
});

// ── parseStructurePlanResponse ──────────────────────

describe("parseStructurePlanResponse", () => {
  it("正常解析弧段计划", () => {
    const raw = JSON.stringify({
      arcPlan: {
        arcNumber: 1,
        name: "初入宗门",
        goal: "主角加入宗门并站稳脚跟",
        chapterCount: 25,
        explosionPoints: [
          {
            chapterIndex: 20,
            description: "师父的真实身份揭露",
            type: "revelation",
            resolvedForeshadowing: ["fs-001"],
          },
        ],
        foreshadowing: [
          {
            id: "fs-001",
            description: "师父的神秘伤疤",
            plantedInArc: 1,
            resolvedInArc: null,
            relatedCharacters: ["li-chen"],
          },
        ],
        characterArcs: [
          {
            characterId: "li-chen",
            characterName: "李辰",
            arcProgress: "从外门弟子到内门新秀",
          },
        ],
        chapterOutlines: [
          { index: 1, description: "李辰被选入宗门", chapterType: "normal", isExplosion: false },
          { index: 2, description: "适应宗门生活", chapterType: "daily", isExplosion: false },
          { index: 20, description: "师父身份揭露", chapterType: "explosion", isExplosion: true },
        ],
      },
    });

    const result = parseStructurePlanResponse(raw, 1);
    expect(result.arcNumber).toBe(1);
    expect(result.name).toBe("初入宗门");
    expect(result.chapterCount).toBe(25);
    expect(result.explosionPoints).toHaveLength(1);
    expect(result.explosionPoints[0]?.type).toBe("revelation");
    expect(result.foreshadowing).toHaveLength(1);
    expect(result.foreshadowing[0]?.id).toBe("fs-001");
    expect(result.chapterOutlines).toHaveLength(3);
    expect(result.chapterOutlines[2]?.isExplosion).toBe(true);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      arcPlan: {
        arc_number: 2,
        name: "弧段2",
        goal: "",
        chapter_count: 30,
        explosionPoints: [],
        foreshadowing: [{
          id: "f1",
          description: "伏笔",
          planted_in_arc: 2,
          resolved_in_arc: 3,
          related_characters: ["x"],
        }],
        characterArcs: [{
          character_id: "x",
          character_name: "X",
          arc_progress: "进展",
        }],
        chapterOutlines: [{ index: 1, description: "第一章", chapter_type: "daily", is_explosion: false }],
      },
    });

    const result = parseStructurePlanResponse(raw, 2);
    expect(result.arcNumber).toBe(2);
    expect(result.chapterCount).toBe(30);
    expect(result.foreshadowing[0]?.plantedInArc).toBe(2);
    expect(result.foreshadowing[0]?.resolvedInArc).toBe(3);
    expect(result.characterArcs[0]?.characterId).toBe("x");
    expect(result.chapterOutlines[0]?.chapterType).toBe("daily");
  });

  it("解析失败返回空弧段", () => {
    const result = parseStructurePlanResponse("无效", 5);
    expect(result.arcNumber).toBe(5);
    expect(result.name).toBe("弧段 5");
    expect(result.chapterCount).toBe(0);
  });
});

// ── parseChapterBriefResponse ──────────────────────

describe("parseChapterBriefResponse", () => {
  it("正常解析章节 Brief", () => {
    const raw = JSON.stringify({
      chapterNumber: 5,
      arcNumber: 1,
      outline: "主角首次对决",
      chapterType: "action",
      involvedCharacters: ["李辰", "王梅"],
      foreshadowingToResolve: ["师父的暗示"],
      foreshadowingToPlant: ["新的线索"],
      emotionalMines: ["牺牲感"],
      sceneSequel: "先打后反思",
    });

    const result = parseChapterBriefResponse(raw, 5, 1);
    expect(result.chapterNumber).toBe(5);
    expect(result.chapterType).toBe("action");
    expect(result.involvedCharacters).toEqual(["李辰", "王梅"]);
    expect(result.emotionalMines).toEqual(["牺牲感"]);
    expect(result.sceneSequel).toBe("先打后反思");
  });

  it("解析失败使用默认值", () => {
    const result = parseChapterBriefResponse("无效", 3, 1);
    expect(result.chapterNumber).toBe(3);
    expect(result.arcNumber).toBe(1);
    expect(result.chapterType).toBe("normal");
    expect(result.involvedCharacters).toEqual([]);
  });
});

// ── Prompt 构建 ──────────────────────────────────────

describe("Prompt 构建", () => {
  it("buildWorldDesignPrompt 包含创意简报", () => {
    const input: WorldDesignInput = {
      projectId: "test",
      briefSummary: "修仙世界反派重生",
      requirements: "需要完整的力量体系",
    };
    const prompt = buildWorldDesignPrompt(input);
    expect(prompt).toContain("修仙世界反派重生");
    expect(prompt).toContain("需要完整的力量体系");
    expect(prompt).toContain("世界观设计");
  });

  it("buildCharacterDesignPrompt 包含已有角色", () => {
    const input: CharacterDesignInput = {
      projectId: "test",
      briefSummary: "简报",
      worldOverview: "世界概述",
      existingCharacters: [{
        id: "existing",
        name: "已有角色",
        role: "protagonist",
        description: "主角",
        biography: "",
        psychology: { want: "", need: "", lie: "", ghost: "" },
        quirks: { habits: [], eccentricities: [] },
        relationships: [],
        arcDescription: "",
      }],
    };
    const prompt = buildCharacterDesignPrompt(input);
    expect(prompt).toContain("已有角色");
    expect(prompt).toContain("protagonist");
    expect(prompt).toContain("WANT/NEED/LIE/GHOST");
  });

  it("buildStructurePlanPrompt 包含弧段编号", () => {
    const input: StructurePlanInput = {
      projectId: "test",
      briefSummary: "简报",
      worldOverview: "世界",
      charactersSummary: "角色列表",
      arcNumber: 3,
      previousArcsSummary: "前两个弧段...",
    };
    const prompt = buildStructurePlanPrompt(input);
    expect(prompt).toContain("弧段 3");
    expect(prompt).toContain("前两个弧段...");
    expect(prompt).toContain("爆点");
    expect(prompt).toContain("伏笔");
  });

  it("buildChapterBriefPrompt 包含章节信息", () => {
    const prompt = buildChapterBriefPrompt(
      "弧段摘要",
      "本章概要",
      10,
      1,
      "角色状态",
      "待处理伏笔",
    );
    expect(prompt).toContain("第 10 章");
    expect(prompt).toContain("弧段 1");
    expect(prompt).toContain("弧段摘要");
    expect(prompt).toContain("情感地雷");
    expect(prompt).toContain("Scene-Sequel");
  });
});

// ── JiangxinEngine ──────────────────────────────────

describe("JiangxinEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new JiangxinEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_JIANGXIN_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new JiangxinEngine({ minChaptersPerArc: 10 });
    expect(engine.getConfig().minChaptersPerArc).toBe(10);
    expect(engine.getConfig().maxChaptersPerArc).toBe(50);
  });

  describe("designWorld", () => {
    it("调用 bridge 并返回结果", async () => {
      const response = JSON.stringify({
        overview: "测试世界",
        subsystems: [{ id: "test", name: "测试", tags: [], description: "", rules: [] }],
      });
      const bridge = createMockBridge(response);
      const engine = new JiangxinEngine();

      const progressEvents: string[] = [];
      const result = await engine.designWorld(
        { projectId: "test", briefSummary: "简报" },
        bridge,
        (p) => progressEvents.push(p.stage),
      );

      expect(result.overview).toBe("测试世界");
      expect(result.subsystems).toHaveLength(1);
      expect(result.usage.inputTokens).toBe(150);
      expect(progressEvents).toEqual(["world"]);
    });
  });

  describe("designCharacters", () => {
    it("调用 bridge 并返回角色列表", async () => {
      const response = JSON.stringify({
        characters: [{
          id: "hero",
          name: "主角",
          role: "protagonist",
          description: "勇敢的少年",
          biography: "出生...",
          psychology: { want: "力量", need: "爱", lie: "力量至上", ghost: "被抛弃" },
          quirks: { habits: ["挠头"], eccentricities: [] },
          relationships: [],
          arcDescription: "成长",
        }],
      });
      const bridge = createMockBridge(response);
      const engine = new JiangxinEngine();

      const result = await engine.designCharacters(
        { projectId: "test", briefSummary: "简报", worldOverview: "世界" },
        bridge,
      );

      expect(result.characters).toHaveLength(1);
      expect(result.characters[0]?.name).toBe("主角");
      expect(result.characters[0]?.psychology.want).toBe("力量");
    });
  });

  describe("planStructure", () => {
    it("调用 bridge 并返回弧段计划", async () => {
      const response = JSON.stringify({
        arcPlan: {
          arcNumber: 1,
          name: "开篇",
          goal: "建立世界",
          chapterCount: 25,
          explosionPoints: [{ chapterIndex: 20, description: "爆点", type: "reversal", resolvedForeshadowing: [] }],
          foreshadowing: [],
          characterArcs: [],
          chapterOutlines: Array.from({ length: 25 }, (_, i) => ({
            index: i + 1,
            description: `第${i + 1}章概要`,
            chapterType: "normal",
            isExplosion: i === 19,
          })),
        },
      });
      const bridge = createMockBridge(response);
      const engine = new JiangxinEngine();

      const result = await engine.planStructure(
        {
          projectId: "test",
          briefSummary: "简报",
          worldOverview: "世界",
          charactersSummary: "角色",
          arcNumber: 1,
        },
        bridge,
      );

      expect(result.arcPlan.arcNumber).toBe(1);
      expect(result.arcPlan.chapterCount).toBe(25);
      expect(result.arcPlan.explosionPoints).toHaveLength(1);
      expect(result.arcPlan.chapterOutlines).toHaveLength(25);
    });

    it("章节数不足时记录警告（不抛出异常）", async () => {
      const response = JSON.stringify({
        arcPlan: {
          arcNumber: 1,
          name: "短弧段",
          goal: "",
          chapterCount: 5,
          explosionPoints: [],
          foreshadowing: [],
          characterArcs: [],
          chapterOutlines: [],
        },
      });
      const bridge = createMockBridge(response);
      const engine = new JiangxinEngine();

      // 不应抛出异常
      const result = await engine.planStructure(
        {
          projectId: "test",
          briefSummary: "",
          worldOverview: "",
          charactersSummary: "",
          arcNumber: 1,
        },
        bridge,
      );

      expect(result.arcPlan.chapterCount).toBe(5);
    });
  });

  describe("generateBrief", () => {
    it("调用 bridge 并返回章节 Brief", async () => {
      const response = JSON.stringify({
        chapterNumber: 5,
        arcNumber: 1,
        outline: "关键对决",
        chapterType: "action",
        involvedCharacters: ["李辰"],
        foreshadowingToResolve: [],
        foreshadowingToPlant: ["新伏笔"],
        emotionalMines: ["紧张感"],
      });
      const bridge = createMockBridge(response);
      const engine = new JiangxinEngine();

      const result = await engine.generateBrief(
        "弧段摘要",
        "章节概要",
        5,
        1,
        "角色状态",
        "伏笔",
        bridge,
        "test-project",
      );

      expect(result.brief.chapterNumber).toBe(5);
      expect(result.brief.chapterType).toBe("action");
      expect(result.brief.involvedCharacters).toEqual(["李辰"]);
      expect(result.usage.inputTokens).toBe(150);
    });
  });
});
