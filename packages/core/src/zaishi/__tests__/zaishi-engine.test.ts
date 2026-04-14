/**
 * ZaishiEngine 测试
 */

import { describe, it, expect, vi } from "vitest";
import { ZaishiEngine } from "../zaishi-engine.js";
import {
  parseArchivingResponse,
  parseScreeningResponse,
} from "../zaishi-engine.js";
import {
  buildArchivingPrompt,
  buildArcSummaryPrompt,
  buildScreeningPrompt,
} from "../prompts.js";
import { DEFAULT_ZAISHI_CONFIG } from "../types.js";
import type { ScreeningInput, ScreeningResult } from "../types.js";
import type { SessionProjectBridge } from "../../bridge/bridge.js";

// ── Mock Bridge ──────────────────────────────────────

function createMockBridge(responses: Record<number, string>): SessionProjectBridge {
  let callCount = 0;
  return {
    invokeAgent: vi.fn().mockImplementation(() => {
      const content = responses[callCount] ?? "{}";
      callCount++;
      return Promise.resolve({
        content,
        sessionId: "test-session",
        usage: { inputTokens: 100, outputTokens: 200 },
        agentId: "zaishi" as const,
      });
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

const sampleInput: ScreeningInput = {
  projectId: "test-project",
  chapterNumber: 1,
  chapterContent: "李辰走进了宗门大殿，看到师父正在闭目修炼...",
  chapterTitle: "初入宗门",
};

// ── parseScreeningResponse ──────────────────────────

describe("parseScreeningResponse", () => {
  const usage = { inputTokens: 50, outputTokens: 100 };

  it("正常解析初筛结果", () => {
    const raw = JSON.stringify({
      appearingCharacters: ["李辰", "师父"],
      keyEvents: [
        { description: "李辰进入宗门", characters: ["李辰"], significance: "major" },
      ],
      settingChanges: [
        { domain: "地理", description: "首次展示宗门大殿" },
      ],
      emotionalShifts: [
        { character: "李辰", from: "紧张", to: "敬畏", trigger: "见到师父" },
      ],
    });

    const result = parseScreeningResponse(raw, usage);
    expect(result.appearingCharacters).toEqual(["李辰", "师父"]);
    expect(result.keyEvents).toHaveLength(1);
    expect(result.keyEvents[0]?.description).toBe("李辰进入宗门");
    expect(result.keyEvents[0]?.significance).toBe("major");
    expect(result.settingChanges).toHaveLength(1);
    expect(result.settingChanges[0]?.domain).toBe("地理");
    expect(result.emotionalShifts).toHaveLength(1);
    expect(result.emotionalShifts[0]?.from).toBe("紧张");
    expect(result.emotionalShifts[0]?.to).toBe("敬畏");
    expect(result.usage).toEqual(usage);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      appearing_characters: ["角色A"],
      key_events: [
        { description: "事件", characters: [], significance: "minor" },
      ],
      setting_changes: [],
      emotional_shifts: [
        { character: "角色A", from: "平静", to: "愤怒", trigger: "被打" },
      ],
    });

    const result = parseScreeningResponse(raw, usage);
    expect(result.appearingCharacters).toEqual(["角色A"]);
    expect(result.keyEvents).toHaveLength(1);
    expect(result.emotionalShifts).toHaveLength(1);
    expect(result.emotionalShifts[0]?.trigger).toBe("被打");
  });

  it("解析 markdown 代码块中的 JSON", () => {
    const raw = '```json\n{"appearingCharacters": ["A"], "keyEvents": [], "settingChanges": [], "emotionalShifts": []}\n```';

    const result = parseScreeningResponse(raw, usage);
    expect(result.appearingCharacters).toEqual(["A"]);
  });

  it("解析失败返回空结果", () => {
    const result = parseScreeningResponse("这不是JSON", usage);
    expect(result.appearingCharacters).toEqual([]);
    expect(result.keyEvents).toEqual([]);
    expect(result.settingChanges).toEqual([]);
    expect(result.emotionalShifts).toEqual([]);
    expect(result.usage).toEqual(usage);
  });

  it("无效 significance 回退 minor", () => {
    const raw = JSON.stringify({
      appearingCharacters: [],
      keyEvents: [{ description: "事件", characters: [], significance: "unknown" }],
      settingChanges: [],
      emotionalShifts: [],
    });

    const result = parseScreeningResponse(raw, usage);
    expect(result.keyEvents[0]?.significance).toBe("minor");
  });

  it("非数组字段处理为空数组", () => {
    const raw = JSON.stringify({
      appearingCharacters: "不是数组",
      keyEvents: null,
      settingChanges: 42,
      emotionalShifts: undefined,
    });

    const result = parseScreeningResponse(raw, usage);
    expect(result.appearingCharacters).toEqual([]);
    expect(result.keyEvents).toEqual([]);
    expect(result.settingChanges).toEqual([]);
    expect(result.emotionalShifts).toEqual([]);
  });

  it("非对象 keyEvent 转为字符串描述", () => {
    const raw = JSON.stringify({
      appearingCharacters: [],
      keyEvents: ["简单事件描述"],
      settingChanges: [],
      emotionalShifts: [],
    });

    const result = parseScreeningResponse(raw, usage);
    expect(result.keyEvents[0]?.description).toBe("简单事件描述");
    expect(result.keyEvents[0]?.significance).toBe("minor");
  });
});

// ── parseArchivingResponse ──────────────────────────

describe("parseArchivingResponse", () => {
  const usage = { inputTokens: 200, outputTokens: 400 };

  it("正常解析核心归档结果", () => {
    const raw = JSON.stringify({
      chapterSummary: "李辰初入宗门，遇到了师父...",
      characterDeltas: [
        {
          characterName: "李辰",
          location: "宗门大殿",
          emotionalState: "敬畏",
          knowledgeGained: ["宗门的规矩"],
          changes: ["成为外门弟子"],
        },
      ],
      plotThreadUpdates: [
        {
          threadName: "师父身份之谜",
          newStatus: "planted",
          description: "师父身上有奇怪的伤疤",
          relatedCharacters: ["师父"],
        },
      ],
      timelineEvents: [
        {
          storyTimestamp: "第一天 清晨",
          description: "李辰进入宗门",
          characterNames: ["李辰"],
          locationName: "宗门山门",
          significance: "major",
        },
      ],
      relationshipChanges: [
        {
          sourceName: "李辰",
          targetName: "师父",
          type: "师徒",
          intensityDelta: 0.5,
          description: "初次拜师",
        },
      ],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.chapterSummary).toBe("李辰初入宗门，遇到了师父...");
    expect(result.characterDeltas).toHaveLength(1);
    expect(result.characterDeltas[0]?.characterName).toBe("李辰");
    expect(result.characterDeltas[0]?.location).toBe("宗门大殿");
    expect(result.characterDeltas[0]?.knowledgeGained).toEqual(["宗门的规矩"]);
    expect(result.plotThreadUpdates).toHaveLength(1);
    expect(result.plotThreadUpdates[0]?.newStatus).toBe("planted");
    expect(result.timelineEvents).toHaveLength(1);
    expect(result.timelineEvents[0]?.storyTimestamp).toBe("第一天 清晨");
    expect(result.relationshipChanges).toHaveLength(1);
    expect(result.relationshipChanges[0]?.intensityDelta).toBe(0.5);
    expect(result.usage).toEqual(usage);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      chapter_summary: "摘要内容",
      character_deltas: [
        {
          character_name: "角色A",
          emotional_state: "开心",
          knowledge_gained: ["新知"],
          lie_progress: "动摇",
          power_level: "筑基初期",
          physical_condition: "轻伤",
          is_alive: true,
        },
      ],
      plot_thread_updates: [
        {
          thread_name: "伏笔1",
          new_status: "developing",
          key_moment: "关键时刻",
          related_characters: ["角色A"],
        },
      ],
      timeline_events: [
        {
          story_timestamp: "午后",
          description: "事件",
          character_names: ["角色A"],
          location_name: "广场",
          significance: "moderate",
        },
      ],
      relationship_changes: [
        {
          source_name: "角色A",
          target_name: "角色B",
          type: "友",
          intensity_delta: 0.2,
          description: "建立友谊",
        },
      ],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.chapterSummary).toBe("摘要内容");
    expect(result.characterDeltas[0]?.characterName).toBe("角色A");
    expect(result.characterDeltas[0]?.emotionalState).toBe("开心");
    expect(result.characterDeltas[0]?.lieProgress).toBe("动摇");
    expect(result.characterDeltas[0]?.powerLevel).toBe("筑基初期");
    expect(result.characterDeltas[0]?.physicalCondition).toBe("轻伤");
    expect(result.characterDeltas[0]?.isAlive).toBe(true);
    expect(result.plotThreadUpdates[0]?.threadName).toBe("伏笔1");
    expect(result.plotThreadUpdates[0]?.newStatus).toBe("developing");
    expect(result.plotThreadUpdates[0]?.keyMoment).toBe("关键时刻");
    expect(result.timelineEvents[0]?.storyTimestamp).toBe("午后");
    expect(result.timelineEvents[0]?.locationName).toBe("广场");
    expect(result.relationshipChanges[0]?.sourceName).toBe("角色A");
    expect(result.relationshipChanges[0]?.intensityDelta).toBe(0.2);
  });

  it("解析失败返回空结果", () => {
    const result = parseArchivingResponse("完全无效", usage);
    expect(result.chapterSummary).toBe("");
    expect(result.characterDeltas).toEqual([]);
    expect(result.plotThreadUpdates).toEqual([]);
    expect(result.timelineEvents).toEqual([]);
    expect(result.relationshipChanges).toEqual([]);
    expect(result.usage).toEqual(usage);
  });

  it("chapterSummary 不是字符串时返回空", () => {
    const raw = JSON.stringify({
      chapterSummary: 42,
      characterDeltas: [],
      plotThreadUpdates: [],
      timelineEvents: [],
      relationshipChanges: [],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.chapterSummary).toBe("");
  });

  it("无效 plotThread status 不设置", () => {
    const raw = JSON.stringify({
      chapterSummary: "",
      characterDeltas: [],
      plotThreadUpdates: [{ threadName: "T", newStatus: "invalid_status" }],
      timelineEvents: [],
      relationshipChanges: [],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.plotThreadUpdates[0]?.threadName).toBe("T");
    expect(result.plotThreadUpdates[0]?.newStatus).toBeUndefined();
  });

  it("非对象 delta 转为字符串 characterName", () => {
    const raw = JSON.stringify({
      chapterSummary: "",
      characterDeltas: ["角色名"],
      plotThreadUpdates: [],
      timelineEvents: [],
      relationshipChanges: [],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.characterDeltas[0]?.characterName).toBe("角色名");
  });

  it("非对象 relationshipChange 使用默认值", () => {
    const raw = JSON.stringify({
      chapterSummary: "",
      characterDeltas: [],
      plotThreadUpdates: [],
      timelineEvents: [],
      relationshipChanges: [null],
    });

    const result = parseArchivingResponse(raw, usage);
    expect(result.relationshipChanges[0]?.sourceName).toBe("未知");
    expect(result.relationshipChanges[0]?.targetName).toBe("未知");
    expect(result.relationshipChanges[0]?.intensityDelta).toBe(0);
  });
});

// ── Prompt 构建 ──────────────────────────────────────

describe("Prompt 构建", () => {
  it("buildScreeningPrompt 包含章节信息", () => {
    const prompt = buildScreeningPrompt(5, "章节正文内容", "测试标题");
    expect(prompt).toContain("第5章");
    expect(prompt).toContain("测试标题");
    expect(prompt).toContain("章节正文内容");
    expect(prompt).toContain("appearingCharacters");
    expect(prompt).toContain("keyEvents");
  });

  it("buildScreeningPrompt 无标题时不报错", () => {
    const prompt = buildScreeningPrompt(1, "正文");
    expect(prompt).toContain("第1章");
    expect(prompt).not.toContain("标题");
  });

  it("buildArchivingPrompt 包含初筛结果和前文摘要", () => {
    const prompt = buildArchivingPrompt(
      3,
      "章节正文",
      '{"appearingCharacters": ["A"]}',
      {
        chapterTitle: "标题三",
        previousSummaries: ["前一章摘要"],
        knownCharacterNames: ["李辰", "师父"],
        summaryTargetWords: 700,
      },
    );
    expect(prompt).toContain("第3章");
    expect(prompt).toContain("标题三");
    expect(prompt).toContain("appearingCharacters");
    expect(prompt).toContain("前一章摘要");
    expect(prompt).toContain("李辰、师父");
    expect(prompt).toContain("700字左右");
  });

  it("buildArchivingPrompt 无可选参数时使用默认值", () => {
    const prompt = buildArchivingPrompt(1, "正文", "{}");
    expect(prompt).toContain("第1章");
    expect(prompt).toContain("650字左右");
    expect(prompt).not.toContain("已知角色");
  });

  it("buildArcSummaryPrompt 包含弧段信息和章节摘要", () => {
    const prompt = buildArcSummaryPrompt(
      2,
      "宗门大比",
      "宗门举办大比",
      [
        { chapterNumber: 10, summary: "第10章摘要" },
        { chapterNumber: 11, summary: "第11章摘要" },
      ],
    );
    expect(prompt).toContain("第2弧段");
    expect(prompt).toContain("宗门大比");
    expect(prompt).toContain("宗门举办大比");
    expect(prompt).toContain("第10章");
    expect(prompt).toContain("第11章");
    expect(prompt).toContain("800-1200字");
  });

  it("buildArcSummaryPrompt 无标题和描述时不报错", () => {
    const prompt = buildArcSummaryPrompt(
      1,
      undefined,
      undefined,
      [{ chapterNumber: 1, summary: "摘要" }],
    );
    expect(prompt).toContain("第1弧段");
    expect(prompt).toContain("第1章");
  });
});

// ── ZaishiEngine ──────────────────────────────────────

describe("ZaishiEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new ZaishiEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_ZAISHI_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new ZaishiEngine({ summaryTargetWords: 800, autoArcSummary: false });
    expect(engine.getConfig().summaryTargetWords).toBe(800);
    expect(engine.getConfig().autoArcSummary).toBe(false);
    expect(engine.getConfig().screeningAgentId).toBe("zaishi");
  });

  describe("screen", () => {
    it("调用 bridge 并解析初筛结果", async () => {
      const screeningJson = JSON.stringify({
        appearingCharacters: ["李辰"],
        keyEvents: [{ description: "入门", characters: ["李辰"], significance: "major" }],
        settingChanges: [],
        emotionalShifts: [],
      });
      const bridge = createMockBridge({ 0: screeningJson });
      const engine = new ZaishiEngine();

      const result = await engine.screen(sampleInput, bridge);
      expect(result.appearingCharacters).toEqual(["李辰"]);
      expect(result.keyEvents).toHaveLength(1);
      expect(result.usage.inputTokens).toBe(100);

      // 验证传递了 systemPrompt
      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("载史"),
        }),
      );
    });
  });

  describe("archive", () => {
    it("调用 bridge 并解析归档结果", async () => {
      const archivingJson = JSON.stringify({
        chapterSummary: "归档摘要",
        characterDeltas: [],
        plotThreadUpdates: [],
        timelineEvents: [],
        relationshipChanges: [],
      });
      const bridge = createMockBridge({ 0: archivingJson });
      const engine = new ZaishiEngine();

      const screening: ScreeningResult = {
        appearingCharacters: ["李辰"],
        keyEvents: [],
        settingChanges: [],
        emotionalShifts: [],
        usage: { inputTokens: 50, outputTokens: 100 },
      };

      const result = await engine.archive(
        {
          projectId: "test",
          chapterNumber: 1,
          chapterContent: "正文",
          screening,
        },
        bridge,
      );

      expect(result.chapterSummary).toBe("归档摘要");
      expect(result.usage.inputTokens).toBe(100);

      // 验证传递了 systemPrompt
      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("叙事记录官"),
        }),
      );
    });
  });

  describe("archiveChapter", () => {
    it("执行完整两阶段归档流程", async () => {
      const screeningJson = JSON.stringify({
        appearingCharacters: ["李辰", "师父"],
        keyEvents: [{ description: "拜师", characters: ["李辰", "师父"], significance: "major" }],
        settingChanges: [],
        emotionalShifts: [{ character: "李辰", from: "紧张", to: "敬畏", trigger: "师父气场" }],
      });
      const archivingJson = JSON.stringify({
        chapterSummary: "李辰正式拜师...",
        characterDeltas: [
          { characterName: "李辰", emotionalState: "敬畏", changes: ["成为弟子"] },
        ],
        plotThreadUpdates: [
          { threadName: "师父身份", newStatus: "planted", description: "师父的伤疤" },
        ],
        timelineEvents: [
          { description: "拜师仪式", characterNames: ["李辰", "师父"], significance: "major" },
        ],
        relationshipChanges: [
          { sourceName: "李辰", targetName: "师父", type: "师徒", intensityDelta: 0.8, description: "正式建立师徒关系" },
        ],
      });

      const bridge = createMockBridge({ 0: screeningJson, 1: archivingJson });
      const engine = new ZaishiEngine();

      const progressEvents: string[] = [];
      const result = await engine.archiveChapter(
        sampleInput,
        bridge,
        { previousSummaries: ["前情摘要"], knownCharacterNames: ["李辰"] },
        (p) => progressEvents.push(p.stage),
      );

      // 验证两阶段都执行
      expect(progressEvents).toEqual(["screening", "archiving"]);

      // 验证初筛结果
      expect(result.screening.appearingCharacters).toEqual(["李辰", "师父"]);
      expect(result.screening.keyEvents).toHaveLength(1);
      expect(result.screening.emotionalShifts).toHaveLength(1);

      // 验证归档结果
      expect(result.archiving.chapterSummary).toBe("李辰正式拜师...");
      expect(result.archiving.characterDeltas).toHaveLength(1);
      expect(result.archiving.plotThreadUpdates).toHaveLength(1);
      expect(result.archiving.timelineEvents).toHaveLength(1);
      expect(result.archiving.relationshipChanges).toHaveLength(1);

      // 验证用量合并
      expect(result.totalUsage.inputTokens).toBe(200); // 2 calls × 100
      expect(result.totalUsage.outputTokens).toBe(400); // 2 calls × 200
      expect(result.chapterNumber).toBe(1);

      // 验证 bridge 被调用了两次
      expect(bridge.invokeAgent).toHaveBeenCalledTimes(2);
    });

    it("无回调时不报错", async () => {
      const bridge = createMockBridge({
        0: JSON.stringify({ appearingCharacters: [], keyEvents: [], settingChanges: [], emotionalShifts: [] }),
        1: JSON.stringify({ chapterSummary: "", characterDeltas: [], plotThreadUpdates: [], timelineEvents: [], relationshipChanges: [] }),
      });

      const engine = new ZaishiEngine();
      const result = await engine.archiveChapter(sampleInput, bridge);
      expect(result.chapterNumber).toBe(1);
    });

    it("无 options 时正常执行", async () => {
      const bridge = createMockBridge({
        0: JSON.stringify({ appearingCharacters: [], keyEvents: [], settingChanges: [], emotionalShifts: [] }),
        1: JSON.stringify({ chapterSummary: "摘要", characterDeltas: [], plotThreadUpdates: [], timelineEvents: [], relationshipChanges: [] }),
      });

      const engine = new ZaishiEngine();
      const result = await engine.archiveChapter(sampleInput, bridge);
      expect(result.archiving.chapterSummary).toBe("摘要");
    });
  });

  describe("generateArcSummary", () => {
    it("生成弧段摘要", async () => {
      const bridge = createMockBridge({ 0: "这是弧段摘要的文本内容，包含了整个弧段的核心事件..." });
      const engine = new ZaishiEngine();

      const progressEvents: string[] = [];
      const result = await engine.generateArcSummary(
        {
          projectId: "test",
          arcIndex: 1,
          arcTitle: "初入宗门",
          arcDescription: "主角加入宗门",
          chapterSummaries: [
            { chapterNumber: 1, summary: "第1章摘要" },
            { chapterNumber: 2, summary: "第2章摘要" },
          ],
        },
        bridge,
        (p) => progressEvents.push(p.stage),
      );

      expect(result.content).toContain("弧段摘要");
      expect(result.usage.inputTokens).toBe(100);
      expect(progressEvents).toEqual(["arc_summary"]);
    });

    it("无回调时不报错", async () => {
      const bridge = createMockBridge({ 0: "弧段摘要" });
      const engine = new ZaishiEngine();

      const result = await engine.generateArcSummary(
        {
          projectId: "test",
          arcIndex: 1,
          chapterSummaries: [{ chapterNumber: 1, summary: "摘要" }],
        },
        bridge,
      );

      expect(result.content).toBe("弧段摘要");
    });
  });
});
