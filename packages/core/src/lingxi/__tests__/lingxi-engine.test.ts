/**
 * LingxiEngine 测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LingxiEngine } from "../lingxi-engine.js";
import {
  extractJson,
  parseBriefResponse,
  parseConceptArray,
  parseConvergenceResponse,
  parseDivergenceResponse,
} from "../lingxi-engine.js";
import {
  buildConvergencePrompt,
  buildCrystallizationPrompt,
  buildDivergencePrompt,
  buildWhatIfPrompt,
} from "../prompts.js";
import type { BrainstormInput, ConceptProposal } from "../types.js";
import { DEFAULT_LINGXI_CONFIG } from "../types.js";
import type { SessionProjectBridge } from "../../bridge/bridge.js";

// ── Mock Bridge ──────────────────────────────────────

function createMockBridge(responses: Record<number, string>): SessionProjectBridge {
  let callCount = 0;
  return {
    invokeAgent: vi.fn().mockImplementation(() => {
      const content = responses[callCount] ?? "[Placeholder]";
      callCount++;
      return Promise.resolve({
        content,
        sessionId: "test-session",
        usage: { inputTokens: 100, outputTokens: 200 },
        agentId: "lingxi" as const,
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

const sampleInput: BrainstormInput = {
  projectId: "test-project",
  keywords: ["修仙", "反派"],
  preferences: "希望有反转",
};

const sampleConcepts: ConceptProposal[] = [
  {
    name: "方案A",
    premise: "修仙世界的反派重生",
    whatIf: "如果反派赢了会怎样",
    risk: "容易变成爽文",
    uniqueHook: "从反派视角看修仙",
  },
  {
    name: "方案B",
    premise: "修仙界的医生",
    whatIf: "如果修仙界需要医疗体系",
    risk: "缺乏战斗场面",
    uniqueHook: "用医术修仙",
  },
];

// ── extractJson ──────────────────────────────────────

describe("extractJson", () => {
  it("提取纯 JSON", () => {
    const input = '[{"name": "test"}]';
    expect(extractJson(input)).toBe(input);
  });

  it("提取 markdown 代码块中的 JSON", () => {
    const input = '```json\n[{"name": "test"}]\n```';
    expect(extractJson(input)).toBe('[{"name": "test"}]');
  });

  it("提取代码块（无 json 标记）", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(extractJson(input)).toBe('{"key": "value"}');
  });

  it("提取前后有文字的 JSON", () => {
    const input = '这是结果：[{"name": "test"}] 以上就是';
    expect(extractJson(input)).toBe('[{"name": "test"}]');
  });

  it("提取嵌套对象", () => {
    const input = '结果如下：{"a": {"b": 1}} 完毕';
    expect(extractJson(input)).toBe('{"a": {"b": 1}}');
  });

  it("无 JSON 时返回 trimmed 原文", () => {
    const input = "  这是纯文本  ";
    expect(extractJson(input)).toBe("这是纯文本");
  });
});

// ── parseDivergenceResponse ──────────────────────────

describe("parseDivergenceResponse", () => {
  it("解析正常的概念数组", () => {
    const raw = JSON.stringify([
      { name: "A", premise: "前提A", whatIf: "推演A", risk: "风险A", uniqueHook: "卖点A" },
      { name: "B", premise: "前提B", whatIf: "推演B", risk: "风险B", uniqueHook: "卖点B" },
    ]);
    const result = parseDivergenceResponse(raw);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("A");
    expect(result[1]?.uniqueHook).toBe("卖点B");
  });

  it("处理 snake_case 字段名", () => {
    const raw = JSON.stringify([
      { name: "A", premise: "P", what_if: "推演", risk: "R", unique_hook: "卖点" },
    ]);
    const result = parseDivergenceResponse(raw);
    expect(result[0]?.whatIf).toBe("推演");
    expect(result[0]?.uniqueHook).toBe("卖点");
  });

  it("解析失败时返回 fallback", () => {
    const result = parseDivergenceResponse("这不是 JSON");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("解析失败方案");
  });

  it("非数组时包装", () => {
    const raw = JSON.stringify({ name: "单个", premise: "P" });
    const result = parseDivergenceResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("单个");
  });
});

// ── parseConceptArray ──────────────────────────────────

describe("parseConceptArray", () => {
  const fallback = [{ name: "fallback", premise: "", whatIf: "", risk: "", uniqueHook: "" }];

  it("正常解析", () => {
    const raw = JSON.stringify([{ name: "X", premise: "P", whatIf: "W", risk: "R", uniqueHook: "H" }]);
    const result = parseConceptArray(raw, fallback);
    expect(result[0]?.name).toBe("X");
  });

  it("解析失败返回 fallback", () => {
    const result = parseConceptArray("无效", fallback);
    expect(result).toBe(fallback);
  });
});

// ── parseConvergenceResponse ────────────────────────

describe("parseConvergenceResponse", () => {
  it("正常解析", () => {
    const raw = JSON.stringify({
      selectedConcepts: [{ name: "A", premise: "P", whatIf: "W", risk: "R", uniqueHook: "H" }],
      selectionReasoning: "选A因为...",
    });
    const result = parseConvergenceResponse(raw);
    expect(result.selectedConcepts).toHaveLength(1);
    expect(result.selectionReasoning).toBe("选A因为...");
  });

  it("解析失败返回空", () => {
    const result = parseConvergenceResponse("无效");
    expect(result.selectedConcepts).toHaveLength(0);
    expect(result.selectionReasoning).toBe("解析失败");
  });
});

// ── parseBriefResponse ──────────────────────────────

describe("parseBriefResponse", () => {
  it("正常解析创意简报", () => {
    const raw = JSON.stringify({
      titleCandidates: ["书名1", "书名2"],
      genre: "修仙/反派",
      logline: "反派也能是主角",
      coreConflict: "正邪之间",
      uniqueHook: "反派视角",
      tone: "黑暗幽默",
      targetAudience: "网文读者",
      estimatedScale: "100万字",
      selectedConcepts: [],
    });
    const result = parseBriefResponse(raw, sampleConcepts);
    expect(result.titleCandidates).toEqual(["书名1", "书名2"]);
    expect(result.genre).toBe("修仙/反派");
    expect(result.logline).toBe("反派也能是主角");
  });

  it("解析失败时使用 fallback concepts", () => {
    const result = parseBriefResponse("无效", sampleConcepts);
    expect(result.selectedConcepts).toBe(sampleConcepts);
    expect(result.titleCandidates).toEqual(["未命名"]);
  });
});

// ── Prompt 构建 ──────────────────────────────────────

describe("Prompt 构建", () => {
  it("buildDivergencePrompt 包含关键词和最少方案数", () => {
    const prompt = buildDivergencePrompt(sampleInput, 5);
    expect(prompt).toContain("修仙、反派");
    expect(prompt).toContain("至少 5 个");
    expect(prompt).toContain("希望有反转");
  });

  it("buildDivergencePrompt 包含类型约束", () => {
    const input: BrainstormInput = { ...sampleInput, genreConstraint: "玄幻" };
    const prompt = buildDivergencePrompt(input, 5);
    expect(prompt).toContain("类型约束：玄幻");
  });

  it("buildDivergencePrompt 包含参考知识", () => {
    const input: BrainstormInput = {
      ...sampleInput,
      referenceKnowledge: ["知识1", "知识2"],
    };
    const prompt = buildDivergencePrompt(input, 5);
    expect(prompt).toContain("知识1");
    expect(prompt).toContain("知识2");
  });

  it("buildWhatIfPrompt 列出所有概念", () => {
    const prompt = buildWhatIfPrompt(sampleConcepts);
    expect(prompt).toContain("方案A");
    expect(prompt).toContain("方案B");
    expect(prompt).toContain("极端推演");
  });

  it("buildConvergencePrompt 包含评选标准", () => {
    const prompt = buildConvergencePrompt(sampleConcepts, 2);
    expect(prompt).toContain("最优的 2 个");
    expect(prompt).toContain("独特性");
    expect(prompt).toContain("可持续性");
  });

  it("buildCrystallizationPrompt 包含选中方案", () => {
    const prompt = buildCrystallizationPrompt(sampleConcepts, sampleInput);
    expect(prompt).toContain("方案A");
    expect(prompt).toContain("修仙、反派");
    expect(prompt).toContain("创意简报");
  });
});

// ── LingxiEngine ──────────────────────────────────────

describe("LingxiEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new LingxiEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_LINGXI_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new LingxiEngine({ minConcepts: 10, enableWhatIf: false });
    expect(engine.getConfig().minConcepts).toBe(10);
    expect(engine.getConfig().enableWhatIf).toBe(false);
    expect(engine.getConfig().finalCandidates).toBe(3);
  });

  describe("brainstorm", () => {
    it("执行完整四阶段流程", async () => {
      const divergeResponse = JSON.stringify([
        { name: "A", premise: "P-A", whatIf: "", risk: "R-A", uniqueHook: "H-A" },
        { name: "B", premise: "P-B", whatIf: "", risk: "R-B", uniqueHook: "H-B" },
        { name: "C", premise: "P-C", whatIf: "", risk: "R-C", uniqueHook: "H-C" },
      ]);
      const whatIfResponse = JSON.stringify([
        { name: "A", premise: "P-A", whatIf: "W-A", risk: "R-A", uniqueHook: "H-A" },
        { name: "B", premise: "P-B", whatIf: "W-B", risk: "R-B", uniqueHook: "H-B" },
        { name: "C", premise: "P-C", whatIf: "W-C", risk: "R-C", uniqueHook: "H-C" },
      ]);
      const convergeResponse = JSON.stringify({
        selectedConcepts: [
          { name: "A", premise: "P-A", whatIf: "W-A", risk: "R-A", uniqueHook: "H-A" },
        ],
        selectionReasoning: "A最佳",
      });
      const briefResponse = JSON.stringify({
        titleCandidates: ["测试书名"],
        genre: "测试类型",
        logline: "测试梗概",
        coreConflict: "测试冲突",
        uniqueHook: "测试卖点",
        tone: "测试基调",
        targetAudience: "测试读者",
        estimatedScale: "100万字",
        selectedConcepts: [
          { name: "A", premise: "P-A", whatIf: "W-A", risk: "R-A", uniqueHook: "H-A" },
        ],
      });

      const bridge = createMockBridge({
        0: divergeResponse,
        1: whatIfResponse,
        2: convergeResponse,
        3: briefResponse,
      });

      const engine = new LingxiEngine();
      const progressEvents: string[] = [];
      const result = await engine.brainstorm(sampleInput, bridge, (p) => {
        progressEvents.push(p.stage);
      });

      expect(result.brief.titleCandidates).toEqual(["测试书名"]);
      expect(result.brief.genre).toBe("测试类型");
      expect(result.totalConceptsGenerated).toBe(3);
      expect(result.selectedCount).toBe(1);
      expect(result.usage.inputTokens).toBe(400); // 4 calls × 100
      expect(result.usage.outputTokens).toBe(800); // 4 calls × 200

      // 验证四阶段都被回调
      expect(progressEvents).toEqual(["divergence", "whatif", "convergence", "crystallization"]);
    });

    it("禁用 What-if 时跳过推演阶段", async () => {
      const divergeResponse = JSON.stringify([
        { name: "A", premise: "P", whatIf: "", risk: "R", uniqueHook: "H" },
      ]);
      const convergeResponse = JSON.stringify({
        selectedConcepts: [{ name: "A", premise: "P", whatIf: "", risk: "R", uniqueHook: "H" }],
        selectionReasoning: "只有一个",
      });
      const briefResponse = JSON.stringify({
        titleCandidates: ["书名"],
        genre: "类型",
        logline: "梗概",
        coreConflict: "",
        uniqueHook: "",
        tone: "",
        targetAudience: "",
        estimatedScale: "",
        selectedConcepts: [],
      });

      const bridge = createMockBridge({
        0: divergeResponse,
        1: convergeResponse,
        2: briefResponse,
      });

      const engine = new LingxiEngine({ enableWhatIf: false });
      const progressEvents: string[] = [];
      const result = await engine.brainstorm(sampleInput, bridge, (p) => {
        progressEvents.push(p.stage);
      });

      // 只有 3 次调用（跳过 whatif）
      expect(result.usage.inputTokens).toBe(300);
      expect(progressEvents).toEqual(["divergence", "convergence", "crystallization"]);
      expect(progressEvents).not.toContain("whatif");
    });

    it("无回调时不报错", async () => {
      const bridge = createMockBridge({
        0: "[]",
        1: "[]",
        2: JSON.stringify({ selectedConcepts: [], selectionReasoning: "" }),
        3: JSON.stringify({ titleCandidates: [] }),
      });

      const engine = new LingxiEngine();
      const result = await engine.brainstorm(sampleInput, bridge);
      expect(result.brief).toBeDefined();
    });
  });

  describe("diverge", () => {
    it("调用 bridge 并解析结果", async () => {
      const bridge = createMockBridge({
        0: JSON.stringify([{ name: "X", premise: "P", whatIf: "", risk: "", uniqueHook: "" }]),
      });

      const engine = new LingxiEngine();
      const result = await engine.diverge(sampleInput, bridge);
      expect(result.result.concepts).toHaveLength(1);
      expect(result.result.concepts[0]?.name).toBe("X");
      expect(result.usage.inputTokens).toBe(100);
    });
  });
});
