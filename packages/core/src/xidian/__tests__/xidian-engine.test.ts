/**
 * XidianEngine 测试
 */

import { describe, it, expect, vi } from "vitest";
import { XidianEngine } from "../xidian-engine.js";
import {
  parseDimensionResponse,
  parseSearchResponse,
  parseSettlementResponse,
} from "../xidian-engine.js";
import {
  buildDimensionPrompt,
  buildSearchPrompt,
  buildSettlementPrompt,
  buildSummaryPrompt,
  getDimensionConfig,
} from "../prompts.js";
import {
  ALL_DIMENSIONS,
  DEFAULT_XIDIAN_CONFIG,
  DIMENSION_LABELS,
} from "../types.js";
import type { AnalysisInput, DimensionAnalysis } from "../types.js";
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
        agentId: "xidian" as const,
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

const sampleInput: AnalysisInput = {
  projectId: "test-project",
  workTitle: "大奉打更人",
  authorName: "卖报小郎君",
  userNotes: "特别关注节奏和爽感机制",
};

// ── parseSearchResponse ──────────────────────────

describe("parseSearchResponse", () => {
  const usage = { inputTokens: 50, outputTokens: 100 };

  it("正常解析搜索结果", () => {
    const raw = JSON.stringify({
      metadata: {
        title: "大奉打更人",
        author: "卖报小郎君",
        tags: ["玄幻", "探案"],
        synopsis: "穿越大奉成为仵作...",
        wordCount: 4500000,
        rating: 8.5,
        platform: "起点中文网",
      },
      materials: [
        {
          source: "豆瓣读书",
          type: "review",
          content: "推理结合修仙，节奏明快",
          url: "https://book.douban.com/example",
        },
        {
          source: "知乎",
          type: "analysis",
          content: "叙事结构分析...",
        },
      ],
    });

    const result = parseSearchResponse(raw, usage);
    expect(result.metadata.title).toBe("大奉打更人");
    expect(result.metadata.author).toBe("卖报小郎君");
    expect(result.metadata.tags).toEqual(["玄幻", "探案"]);
    expect(result.metadata.wordCount).toBe(4500000);
    expect(result.metadata.rating).toBe(8.5);
    expect(result.materials).toHaveLength(2);
    expect(result.materials[0]?.type).toBe("review");
    expect(result.materials[0]?.url).toBe("https://book.douban.com/example");
    expect(result.materials[1]?.type).toBe("analysis");
    expect(result.usage).toEqual(usage);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      metadata: {
        title: "测试",
        author: "作者",
        tags: [],
        synopsis: "",
        word_count: 1000000,
      },
      materials: [],
    });

    const result = parseSearchResponse(raw, usage);
    expect(result.metadata.wordCount).toBe(1000000);
  });

  it("解析失败返回空结果", () => {
    const result = parseSearchResponse("无效JSON", usage);
    expect(result.metadata.title).toBe("");
    expect(result.materials).toEqual([]);
    expect(result.usage).toEqual(usage);
  });

  it("无效 material type 回退 analysis", () => {
    const raw = JSON.stringify({
      metadata: { title: "", author: "", tags: [], synopsis: "" },
      materials: [{ source: "x", type: "invalid_type", content: "内容" }],
    });

    const result = parseSearchResponse(raw, usage);
    expect(result.materials[0]?.type).toBe("analysis");
  });

  it("非对象 material 转为字符串", () => {
    const raw = JSON.stringify({
      metadata: { title: "", author: "", tags: [], synopsis: "" },
      materials: ["简单文本"],
    });

    const result = parseSearchResponse(raw, usage);
    expect(result.materials[0]?.content).toBe("简单文本");
    expect(result.materials[0]?.source).toBe("未知");
  });
});

// ── parseDimensionResponse ──────────────────────────

describe("parseDimensionResponse", () => {
  it("正常解析维度分析结果", () => {
    const raw = JSON.stringify({
      content: "## 叙事结构分析\n采用 Genette 叙事话语理论...",
      structuredData: "narrative_structure:\n  overall_pattern: '多重嵌套'",
      actionableInsights: [
        "建议采用双线叙事结构",
        "每10-15章设置一个小高潮",
      ],
      consumers: ["lingxi", "jiangxin"],
    });

    const result = parseDimensionResponse("narrative_structure", raw);
    expect(result.dimension).toBe("narrative_structure");
    expect(result.label).toBe("① 叙事结构分析");
    expect(result.content).toContain("Genette");
    expect(result.structuredData).toContain("overall_pattern");
    expect(result.actionableInsights).toHaveLength(2);
    expect(result.consumers).toEqual(["lingxi", "jiangxin"]);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      content: "分析内容",
      structured_data: "yaml数据",
      actionable_insights: ["建议1"],
      consumers: ["zhibi"],
    });

    const result = parseDimensionResponse("character_design", raw);
    expect(result.structuredData).toBe("yaml数据");
    expect(result.actionableInsights).toEqual(["建议1"]);
  });

  it("解析失败使用原文作为 content", () => {
    const rawText = "这是纯文本分析结果，不是JSON";
    const result = parseDimensionResponse("world_building", rawText);
    expect(result.dimension).toBe("world_building");
    expect(result.label).toBe("③ 世界观构建");
    expect(result.content).toBe(rawText);
    expect(result.actionableInsights).toEqual([]);
    expect(result.consumers).toEqual([]);
  });

  it("过滤无效 consumer", () => {
    const raw = JSON.stringify({
      content: "内容",
      actionableInsights: [],
      consumers: ["lingxi", "invalid_agent", "zhibi", 42],
    });

    const result = parseDimensionResponse("foreshadowing", raw);
    expect(result.consumers).toEqual(["lingxi", "zhibi"]);
  });
});

// ── parseSettlementResponse ──────────────────────────

describe("parseSettlementResponse", () => {
  it("正常解析知识沉淀结果", () => {
    const raw = JSON.stringify([
      {
        title: "双线叙事交叉技法",
        content: "在主线推进的同时穿插副线...",
        category: "writing_technique",
        consumers: ["zhibi", "jiangxin"],
      },
      {
        title: "扮猪吃虎节奏控制",
        content: "爽感的关键在于铺垫足够长...",
        category: "genre_knowledge",
        consumers: ["lingxi"],
      },
    ]);

    const entries = parseSettlementResponse(raw, "大奉打更人", "test-project");
    expect(entries).toHaveLength(2);
    expect(entries[0]?.title).toBe("双线叙事交叉技法");
    expect(entries[0]?.category).toBe("writing_technique");
    expect(entries[0]?.sourceWork).toBe("大奉打更人");
    expect(entries[0]?.consumers).toEqual(["zhibi", "jiangxin"]);
    expect(entries[0]?.scope).toBe("global");
    expect(entries[1]?.category).toBe("genre_knowledge");
  });

  it("处理 scope 字段", () => {
    const raw = JSON.stringify([
      {
        title: "全局知识",
        content: "内容",
        category: "writing_technique",
        scope: "global",
        consumers: [],
      },
      {
        title: "项目知识",
        content: "内容",
        category: "style_guide",
        scope: "project",
        consumers: [],
      },
      {
        title: "指定项目",
        content: "内容",
        category: "reference_analysis",
        scope: "project:abc123",
        consumers: [],
      },
    ]);

    const entries = parseSettlementResponse(raw, "作品", "my-project");
    expect(entries[0]?.scope).toBe("global");
    expect(entries[1]?.scope).toBe("project:my-project");
    expect(entries[2]?.scope).toBe("project:abc123");
  });

  it("无效 category 回退 reference_analysis", () => {
    const raw = JSON.stringify([
      {
        title: "条目",
        content: "内容",
        category: "invalid_cat",
        consumers: [],
      },
    ]);

    const entries = parseSettlementResponse(raw, "作品", "proj");
    expect(entries[0]?.category).toBe("reference_analysis");
  });

  it("解析失败返回空数组", () => {
    const entries = parseSettlementResponse("不是JSON", "作品", "proj");
    expect(entries).toEqual([]);
  });

  it("非数组返回空", () => {
    const raw = JSON.stringify({ title: "单个对象" });
    const entries = parseSettlementResponse(raw, "作品", "proj");
    expect(entries).toEqual([]);
  });

  it("非对象元素转为默认条目", () => {
    const raw = JSON.stringify(["简单字符串"]);
    const entries = parseSettlementResponse(raw, "作品", "proj");
    expect(entries[0]?.title).toBe("未命名");
    expect(entries[0]?.content).toBe("简单字符串");
    expect(entries[0]?.sourceWork).toBe("作品");
  });
});

// ── Prompt 构建 ──────────────────────────────────────

describe("Prompt 构建", () => {
  it("buildSearchPrompt 包含作品信息", () => {
    const prompt = buildSearchPrompt("大奉打更人", "卖报小郎君", "关注节奏");
    expect(prompt).toContain("大奉打更人");
    expect(prompt).toContain("卖报小郎君");
    expect(prompt).toContain("关注节奏");
    expect(prompt).toContain("metadata");
    expect(prompt).toContain("materials");
  });

  it("buildSearchPrompt 无作者和备注时不报错", () => {
    const prompt = buildSearchPrompt("测试作品");
    expect(prompt).toContain("测试作品");
    // JSON template 中有 "author" 字段名，但不应有 "作者：XXX" 的实际作者行
    expect(prompt).not.toContain("作者：");
    expect(prompt).not.toContain("补充说明");
  });

  it("buildDimensionPrompt 包含理论框架和分析要求", () => {
    const prompt = buildDimensionPrompt(
      "narrative_structure",
      "大奉打更人",
      "素材内容",
      "用户备注",
    );
    expect(prompt).toContain("大奉打更人");
    expect(prompt).toContain("① 叙事结构分析");
    expect(prompt).toContain("Genette");
    expect(prompt).toContain("Campbell");
    expect(prompt).toContain("素材内容");
    expect(prompt).toContain("用户备注");
    expect(prompt).toContain("actionableInsights");
  });

  it("buildDimensionPrompt 无用户备注时不报错", () => {
    const prompt = buildDimensionPrompt(
      "shuanggan_mechanics",
      "测试",
      "素材",
    );
    expect(prompt).toContain("⑥ 爽感机制");
    expect(prompt).toContain("爽感生成体系");
    expect(prompt).not.toContain("补充说明");
  });

  it("所有维度都有 prompt 配置", () => {
    for (const dim of ALL_DIMENSIONS) {
      const config = getDimensionConfig(dim);
      expect(config.theory).toBeTruthy();
      expect(config.requirements).toBeTruthy();
      expect(config.structuredFields).toBeTruthy();
    }
  });

  it("buildSettlementPrompt 包含分析内容和提炼规则", () => {
    const prompt = buildSettlementPrompt("大奉打更人", [
      {
        dimension: "narrative_structure",
        label: "① 叙事结构分析",
        content: "分析内容...",
        insights: ["建议1", "建议2"],
      },
    ]);
    expect(prompt).toContain("大奉打更人");
    expect(prompt).toContain("① 叙事结构分析");
    expect(prompt).toContain("分析内容...");
    expect(prompt).toContain("建议1");
    expect(prompt).toContain("800 tokens");
  });

  it("buildSummaryPrompt 包含作品名和维度概要", () => {
    const prompt = buildSummaryPrompt("大奉打更人", "各维度概要文本");
    expect(prompt).toContain("大奉打更人");
    expect(prompt).toContain("各维度概要文本");
    expect(prompt).toContain("500-800 字");
  });
});

// ── 常量验证 ──────────────────────────────────────

describe("常量", () => {
  it("ALL_DIMENSIONS 包含 9 个维度", () => {
    expect(ALL_DIMENSIONS).toHaveLength(9);
  });

  it("DIMENSION_LABELS 覆盖所有维度", () => {
    for (const dim of ALL_DIMENSIONS) {
      expect(DIMENSION_LABELS[dim]).toBeTruthy();
    }
  });

  it("DEFAULT_XIDIAN_CONFIG 有合理默认值", () => {
    expect(DEFAULT_XIDIAN_CONFIG.analysisAgentId).toBe("xidian");
    expect(DEFAULT_XIDIAN_CONFIG.autoSettle).toBe(true);
    expect(DEFAULT_XIDIAN_CONFIG.knowledgeEntryMaxTokens).toBe(800);
  });
});

// ── XidianEngine ──────────────────────────────────────

describe("XidianEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new XidianEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_XIDIAN_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new XidianEngine({ autoSettle: false, maxTokensPerDimension: 2000 });
    expect(engine.getConfig().autoSettle).toBe(false);
    expect(engine.getConfig().maxTokensPerDimension).toBe(2000);
    expect(engine.getConfig().analysisAgentId).toBe("xidian");
  });

  describe("search", () => {
    it("调用 bridge 并解析搜索结果", async () => {
      const searchJson = JSON.stringify({
        metadata: {
          title: "大奉打更人",
          author: "卖报小郎君",
          tags: ["玄幻"],
          synopsis: "简介",
        },
        materials: [
          { source: "知乎", type: "analysis", content: "分析文章" },
        ],
      });
      const bridge = createMockBridge({ 0: searchJson });
      const engine = new XidianEngine();

      const result = await engine.search(sampleInput, bridge);
      expect(result.metadata.title).toBe("大奉打更人");
      expect(result.materials).toHaveLength(1);
      expect(result.usage.inputTokens).toBe(100);

      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("搜索"),
        }),
      );
    });
  });

  describe("analyzeDimension", () => {
    it("调用 bridge 并解析维度分析结果", async () => {
      const dimJson = JSON.stringify({
        content: "叙事结构分析...",
        structuredData: "yaml数据",
        actionableInsights: ["建议A"],
        consumers: ["lingxi"],
      });
      const bridge = createMockBridge({ 0: dimJson });
      const engine = new XidianEngine();

      const result = await engine.analyzeDimension(
        "narrative_structure",
        "大奉打更人",
        "素材文本",
        bridge,
      );

      expect(result.analysis.dimension).toBe("narrative_structure");
      expect(result.analysis.content).toBe("叙事结构分析...");
      expect(result.analysis.actionableInsights).toEqual(["建议A"]);
      expect(result.usage.inputTokens).toBe(100);

      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("析典"),
        }),
      );
    });
  });

  describe("analyzeWork (指定两个维度, autoSettle=false)", () => {
    it("执行搜索 + 分析 + 摘要（不沉淀）", async () => {
      const searchJson = JSON.stringify({
        metadata: { title: "测试", author: "作者", tags: [], synopsis: "" },
        materials: [],
      });
      const dim1Json = JSON.stringify({
        content: "结构分析",
        actionableInsights: ["建议1"],
        consumers: ["lingxi"],
      });
      const dim2Json = JSON.stringify({
        content: "角色分析",
        actionableInsights: ["建议2"],
        consumers: ["jiangxin"],
      });
      const summaryText = "综合摘要文本";

      // 调用顺序: search(0), dim1(1), dim2(2), summary(3)
      const bridge = createMockBridge({
        0: searchJson,
        1: dim1Json,
        2: dim2Json,
        3: summaryText,
      });

      const engine = new XidianEngine({ autoSettle: false });
      const progressEvents: string[] = [];

      const input: AnalysisInput = {
        ...sampleInput,
        dimensions: ["narrative_structure", "character_design"],
      };

      const { report, settlement } = await engine.analyzeWork(
        input,
        bridge,
        (p) => progressEvents.push(`${p.stage}${p.dimension ? `:${p.dimension}` : ""}`),
      );

      // 验证进度回调
      expect(progressEvents).toEqual([
        "search",
        "analyze:narrative_structure",
        "analyze:character_design",
        "report",
      ]);

      // 验证报告
      expect(report.work.title).toBe("测试");
      expect(report.dimensions).toHaveLength(2);
      expect(report.dimensions[0]?.dimension).toBe("narrative_structure");
      expect(report.dimensions[1]?.dimension).toBe("character_design");
      expect(report.overallSummary).toBe("综合摘要文本");

      // 验证用量合计 (4 calls × 100/200)
      expect(report.totalUsage.inputTokens).toBe(400);
      expect(report.totalUsage.outputTokens).toBe(800);

      // 不沉淀
      expect(settlement).toBeUndefined();

      // bridge 被调用 4 次
      expect(bridge.invokeAgent).toHaveBeenCalledTimes(4);
    });
  });

  describe("analyzeWork (autoSettle=true)", () => {
    it("执行完整四阶段包含沉淀", async () => {
      const searchJson = JSON.stringify({
        metadata: { title: "测试", author: "A", tags: [], synopsis: "" },
        materials: [],
      });
      const dimJson = JSON.stringify({
        content: "分析",
        actionableInsights: ["建议"],
        consumers: ["zhibi"],
      });
      const summaryText = "摘要";
      const settleJson = JSON.stringify([
        {
          title: "知识条目",
          content: "指南内容",
          category: "writing_technique",
          consumers: ["zhibi"],
        },
      ]);

      // search(0), dim(1), summary(2), settle(3)
      const bridge = createMockBridge({
        0: searchJson,
        1: dimJson,
        2: summaryText,
        3: settleJson,
      });

      const engine = new XidianEngine({ autoSettle: true });
      const input: AnalysisInput = {
        ...sampleInput,
        dimensions: ["style_fingerprint"],
      };

      const { report, settlement } = await engine.analyzeWork(input, bridge);

      expect(report.dimensions).toHaveLength(1);
      expect(settlement).toBeDefined();
      expect(settlement?.entries).toHaveLength(1);
      expect(settlement?.entries[0]?.title).toBe("知识条目");
      expect(settlement?.entries[0]?.sourceWork).toBe("大奉打更人");

      // bridge 被调用 4 次（search + dim + summary + settle）
      expect(bridge.invokeAgent).toHaveBeenCalledTimes(4);
    });
  });

  describe("settle", () => {
    it("调用 bridge 并解析沉淀结果", async () => {
      const settleJson = JSON.stringify([
        {
          title: "条目1",
          content: "内容1",
          category: "writing_technique",
          consumers: ["zhibi"],
        },
      ]);
      const bridge = createMockBridge({ 0: settleJson });
      const engine = new XidianEngine();

      const report: Parameters<typeof engine.settle>[1] = {
        projectId: "test",
        work: { title: "作品", author: "A", tags: [], synopsis: "" },
        dimensions: [{
          dimension: "narrative_structure",
          label: "① 叙事结构分析",
          content: "分析内容",
          actionableInsights: ["建议"],
          consumers: ["lingxi"],
        }],
        overallSummary: "摘要",
        totalUsage: { inputTokens: 0, outputTokens: 0 },
      };

      const result = await engine.settle(sampleInput, report, bridge);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.title).toBe("条目1");
      expect(result.usage.inputTokens).toBe(100);
    });
  });
});
