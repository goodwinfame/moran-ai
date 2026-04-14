/**
 * ShuchongEngine 测试
 */

import { describe, it, expect, vi } from "vitest";
import { ShuchongEngine, parseReaderFeedback } from "../shuchong-engine.js";
import { SHUCHONG_SYSTEM_PROMPT, buildReaderReviewMessage } from "../prompts.js";
import { DEFAULT_SHUCHONG_CONFIG } from "../types.js";
import type { ReaderReviewInput } from "../types.js";
import type { SessionProjectBridge } from "../../bridge/bridge.js";

// ── Mock Bridge ──────────────────────────────────────

function createMockBridge(responseContent: string): SessionProjectBridge {
  return {
    invokeAgent: vi.fn().mockResolvedValue({
      content: responseContent,
      sessionId: "test-session",
      usage: { inputTokens: 100, outputTokens: 200 },
      agentId: "shuchong" as const,
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

function createFailingBridge(): SessionProjectBridge {
  return {
    invokeAgent: vi.fn().mockRejectedValue(new Error("Bridge failure")),
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

const sampleInput: ReaderReviewInput = {
  content: "风吹过山间，李长安坐在石阶上，手里攥着半个冷馒头。远处的师弟们在演武场上比划着剑招。",
  chapterNumber: 1,
  chapterTitle: "风起青萍",
  previousSummary: "李长安入门三年，一直是外门弟子。",
  genreTags: ["玄幻", "修仙"],
};

// ── parseReaderFeedback ──────────────────────────────

describe("parseReaderFeedback", () => {
  const usage = { inputTokens: 50, outputTokens: 100 };

  it("正常解析完整反馈", () => {
    const raw = JSON.stringify({
      readabilityScore: 8,
      oneLiner: "这章开头还行，但中间有点拖",
      boringSpots: [
        { quote: "他走了很远的路", reason: "描写太平淡了" },
      ],
      touchingMoments: [
        { quote: "他默默攥紧了拳头", feeling: "有点心酸" },
      ],
      favoriteCharacter: { name: "李长安", reason: "闷骚型很有意思" },
      freeThoughts: "整体还行，希望下章能打起来",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(8);
    expect(result.oneLiner).toBe("这章开头还行，但中间有点拖");
    expect(result.boringSpots).toHaveLength(1);
    expect(result.boringSpots[0]?.quote).toBe("他走了很远的路");
    expect(result.boringSpots[0]?.reason).toBe("描写太平淡了");
    expect(result.touchingMoments).toHaveLength(1);
    expect(result.touchingMoments[0]?.feeling).toBe("有点心酸");
    expect(result.favoriteCharacter?.name).toBe("李长安");
    expect(result.freeThoughts).toBe("整体还行，希望下章能打起来");
    expect(result.rawResponse).toBe(raw);
    expect(result.usage).toEqual(usage);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      readability_score: 6,
      one_liner: "一般般",
      boring_spots: [],
      touching_moments: [
        { quote: "引用", feeling: "感受" },
      ],
      favorite_character: null,
      free_thoughts: "没什么想说的",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(6);
    expect(result.oneLiner).toBe("一般般");
    expect(result.touchingMoments).toHaveLength(1);
    expect(result.favoriteCharacter).toBeNull();
    expect(result.freeThoughts).toBe("没什么想说的");
  });

  it("分数越界被 clamp 到 0-10", () => {
    const raw = JSON.stringify({
      readabilityScore: 15,
      oneLiner: "超出范围",
      boringSpots: [],
      touchingMoments: [],
      favoriteCharacter: null,
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(10);
  });

  it("负分 clamp 到 0", () => {
    const raw = JSON.stringify({
      readabilityScore: -3,
      oneLiner: "",
      boringSpots: [],
      touchingMoments: [],
      favoriteCharacter: null,
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(0);
  });

  it("缺失分数默认 5", () => {
    const raw = JSON.stringify({
      oneLiner: "没给分",
      boringSpots: [],
      touchingMoments: [],
      favoriteCharacter: null,
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(5);
  });

  it("解析失败返回 fallback", () => {
    const result = parseReaderFeedback("无效JSON数据", usage);
    expect(result.readabilityScore).toBe(5);
    expect(result.oneLiner).toContain("书虫评审失败");
    expect(result.boringSpots).toEqual([]);
    expect(result.touchingMoments).toEqual([]);
    expect(result.favoriteCharacter).toBeNull();
    expect(result.usage).toEqual(usage);
  });

  it("空 favoriteCharacter 对象返回 null", () => {
    const raw = JSON.stringify({
      readabilityScore: 7,
      oneLiner: "还行",
      boringSpots: [],
      touchingMoments: [],
      favoriteCharacter: { name: "", reason: "" },
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.favoriteCharacter).toBeNull();
  });

  it("过滤空的走神点和打动瞬间", () => {
    const raw = JSON.stringify({
      readabilityScore: 7,
      oneLiner: "ok",
      boringSpots: [
        { quote: "有内容", reason: "有原因" },
        { quote: "", reason: "" },
      ],
      touchingMoments: [
        { quote: "", reason: "" },
        { quote: "有引用", feeling: "有感觉" },
      ],
      favoriteCharacter: null,
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.boringSpots).toHaveLength(1);
    expect(result.touchingMoments).toHaveLength(1);
  });

  it("非数组的 boringSpots 返回空数组", () => {
    const raw = JSON.stringify({
      readabilityScore: 5,
      oneLiner: "",
      boringSpots: "不是数组",
      touchingMoments: null,
      favoriteCharacter: null,
      freeThoughts: "",
    });

    const result = parseReaderFeedback(raw, usage);
    expect(result.boringSpots).toEqual([]);
    expect(result.touchingMoments).toEqual([]);
  });

  it("处理 markdown 包裹的 JSON", () => {
    const raw = `好的，这是我的读后感：

\`\`\`json
{
  "readabilityScore": 9,
  "oneLiner": "太好看了！",
  "boringSpots": [],
  "touchingMoments": [{"quote": "他笑了", "feeling": "好暖"}],
  "favoriteCharacter": {"name": "小丫", "reason": "活泼"},
  "freeThoughts": "爱了"
}
\`\`\``;

    const result = parseReaderFeedback(raw, usage);
    expect(result.readabilityScore).toBe(9);
    expect(result.oneLiner).toBe("太好看了！");
    expect(result.touchingMoments).toHaveLength(1);
  });
});

// ── buildReaderReviewMessage ──────────────────────────

describe("buildReaderReviewMessage", () => {
  it("包含所有输入信息", () => {
    const msg = buildReaderReviewMessage(sampleInput);
    expect(msg).toContain("第 1 章");
    expect(msg).toContain("风起青萍");
    expect(msg).toContain("玄幻");
    expect(msg).toContain("修仙");
    expect(msg).toContain("前情提要");
    expect(msg).toContain("李长安入门三年");
    expect(msg).toContain("风吹过山间");
  });

  it("最小输入也能正常构建", () => {
    const msg = buildReaderReviewMessage({
      content: "测试内容",
      chapterNumber: 5,
    });
    expect(msg).toContain("第 5 章");
    expect(msg).toContain("测试内容");
    expect(msg).not.toContain("前情提要");
    expect(msg).not.toContain("题材标签");
  });
});

// ── SHUCHONG_SYSTEM_PROMPT ──────────────────────────

describe("SHUCHONG_SYSTEM_PROMPT", () => {
  it("包含核心指导", () => {
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("追读欲");
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("走神");
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("readabilityScore");
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("boringSpots");
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("touchingMoments");
    expect(SHUCHONG_SYSTEM_PROMPT).toContain("JSON");
  });
});

// ── DEFAULT_SHUCHONG_CONFIG ──────────────────────────

describe("DEFAULT_SHUCHONG_CONFIG", () => {
  it("有合理默认值", () => {
    expect(DEFAULT_SHUCHONG_CONFIG.agentId).toBe("shuchong");
    expect(DEFAULT_SHUCHONG_CONFIG.readerType).toBe("enthusiast");
  });
});

// ── ShuchongEngine ──────────────────────────────────

describe("ShuchongEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new ShuchongEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_SHUCHONG_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new ShuchongEngine({ readerType: "casual" });
    expect(engine.getConfig().readerType).toBe("casual");
    expect(engine.getConfig().agentId).toBe("shuchong");
  });

  describe("review", () => {
    it("调用 bridge 并返回解析后的反馈", async () => {
      const responseJson = JSON.stringify({
        readabilityScore: 8,
        oneLiner: "这章不错",
        boringSpots: [],
        touchingMoments: [{ quote: "他笑了", feeling: "暖心" }],
        favoriteCharacter: { name: "李长安", reason: "有意思" },
        freeThoughts: "期待下章",
      });

      const bridge = createMockBridge(responseJson);
      const engine = new ShuchongEngine();

      const result = await engine.review(sampleInput, bridge);

      expect(result.readabilityScore).toBe(8);
      expect(result.oneLiner).toBe("这章不错");
      expect(result.touchingMoments).toHaveLength(1);
      expect(result.favoriteCharacter?.name).toBe("李长安");
      expect(result.usage.inputTokens).toBe(100);

      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "shuchong",
          systemPrompt: expect.stringContaining("追读欲"),
          temperature: 0.7,
        }),
      );
    });

    it("bridge 失败返回 fallback 反馈", async () => {
      const bridge = createFailingBridge();
      const engine = new ShuchongEngine();

      const result = await engine.review(sampleInput, bridge);

      expect(result.readabilityScore).toBe(5);
      expect(result.oneLiner).toContain("书虫评审失败");
      expect(result.oneLiner).toContain("Bridge failure");
      expect(result.boringSpots).toEqual([]);
      expect(result.usage.inputTokens).toBe(0);
    });

    it("placeholder bridge 响应解析失败也有 fallback", async () => {
      const bridge = createMockBridge("这不是JSON响应");
      const engine = new ShuchongEngine();

      const result = await engine.review(sampleInput, bridge);

      expect(result.readabilityScore).toBe(5);
      expect(result.oneLiner).toContain("书虫评审失败");
      expect(result.rawResponse).toBe("这不是JSON响应");
    });

    it("使用自定义 agentId", async () => {
      const responseJson = JSON.stringify({
        readabilityScore: 5,
        oneLiner: "一般",
        boringSpots: [],
        touchingMoments: [],
        favoriteCharacter: null,
        freeThoughts: "",
      });

      const bridge = createMockBridge(responseJson);
      const engine = new ShuchongEngine({ agentId: "shuchong" });

      await engine.review(sampleInput, bridge);

      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: "shuchong" }),
      );
    });
  });
});
