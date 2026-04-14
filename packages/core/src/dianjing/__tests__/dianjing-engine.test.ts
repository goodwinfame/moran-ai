/**
 * DianjingEngine 测试
 */

import { describe, it, expect, vi } from "vitest";
import { DianjingEngine, parseLiteraryDiagnosis } from "../dianjing-engine.js";
import { DIANJING_SYSTEM_PROMPT, buildDiagnosisMessage } from "../prompts.js";
import {
  ALL_DIAGNOSIS_DIMENSIONS,
  DEFAULT_DIANJING_CONFIG,
  DIAGNOSIS_DIMENSION_LABELS,
} from "../types.js";
import type { DiagnosisInput } from "../types.js";
import type { SessionProjectBridge } from "../../bridge/bridge.js";

// ── Mock Bridge ──────────────────────────────────────

function createMockBridge(responseContent: string): SessionProjectBridge {
  return {
    invokeAgent: vi.fn().mockResolvedValue({
      content: responseContent,
      sessionId: "test-session",
      usage: { inputTokens: 200, outputTokens: 400 },
      agentId: "dianjing" as const,
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
    invokeAgent: vi.fn().mockRejectedValue(new Error("LLM service unavailable")),
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

const sampleInput: DiagnosisInput = {
  content: "李长安走出山门，看了一眼远处的天际线。他叹了口气，继续向前走去。路上遇到了师妹，师妹问他去哪，他说出去走走。",
  chapterNumber: 5,
  chapterTitle: "出山",
  reviewSummary: "明镜审校综合分 6.2，叙事节奏维度偏低，呆板度检测不通过",
  characterProfiles: "李长安：外门弟子，性格隐忍，目标是报师仇",
  themeDescription: "表面修仙，实际探讨权力腐蚀人性",
};

// ── parseLiteraryDiagnosis ──────────────────────────

describe("parseLiteraryDiagnosis", () => {
  const usage = { inputTokens: 100, outputTokens: 200 };

  it("正常解析完整诊断", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [
        {
          dimension: "narrative_drive",
          severity: 8,
          rootCause: "角色没有内在矛盾驱动行为，全靠外部事件推",
          improvementDirection: "赋予角色在这个场景中的内在冲突",
          evidence: "他叹了口气，继续向前走去",
        },
        {
          dimension: "character_voice",
          severity: 4,
          rootCause: "对话过于平淡，缺乏个性化语言特征",
          improvementDirection: "给每个角色一个独特的说话习惯",
          evidence: "师妹问他去哪，他说出去走走",
        },
      ],
      coreIssues: [
        {
          title: "角色缺乏内在驱动力",
          dimensions: ["narrative_drive", "pacing_root_cause"],
          rootCause: "李长安的行为完全被外部事件推着走",
          improvementDirection: "让他的每个行为都来自内在的矛盾",
          impact: 9,
        },
      ],
      summary: "这章最大的问题是角色像提线木偶——他做什么都没有内在动机。",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.dimensionDiagnoses).toHaveLength(2);
    expect(result.dimensionDiagnoses[0]?.dimension).toBe("narrative_drive");
    expect(result.dimensionDiagnoses[0]?.label).toBe("叙事动力");
    expect(result.dimensionDiagnoses[0]?.severity).toBe(8);
    expect(result.dimensionDiagnoses[0]?.rootCause).toContain("内在矛盾");
    expect(result.dimensionDiagnoses[0]?.evidence).toContain("叹了口气");
    expect(result.dimensionDiagnoses[1]?.dimension).toBe("character_voice");
    expect(result.coreIssues).toHaveLength(1);
    expect(result.coreIssues[0]?.title).toBe("角色缺乏内在驱动力");
    expect(result.coreIssues[0]?.impact).toBe(9);
    expect(result.summary).toContain("提线木偶");
    expect(result.rawResponse).toBe(raw);
    expect(result.usage).toEqual(usage);
  });

  it("处理 snake_case 字段", () => {
    const raw = JSON.stringify({
      dimension_diagnoses: [
        {
          dimension: "emotional_authenticity",
          severity: 6,
          root_cause: "情感转变缺乏铺垫",
          improvement_direction: "增加过渡",
          evidence: "引用",
        },
      ],
      core_issues: [
        {
          title: "情感跳跃",
          dimensions: ["emotional_authenticity"],
          root_cause: "根因",
          improvement_direction: "方向",
          impact: 7,
        },
      ],
      summary: "总结",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.dimensionDiagnoses).toHaveLength(1);
    expect(result.dimensionDiagnoses[0]?.rootCause).toBe("情感转变缺乏铺垫");
    expect(result.coreIssues).toHaveLength(1);
    expect(result.coreIssues[0]?.rootCause).toBe("根因");
  });

  it("核心问题限制为 maxCoreIssues", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [],
      coreIssues: [
        { title: "问题1", dimensions: [], rootCause: "", improvementDirection: "", impact: 5 },
        { title: "问题2", dimensions: [], rootCause: "", improvementDirection: "", impact: 9 },
        { title: "问题3", dimensions: [], rootCause: "", improvementDirection: "", impact: 7 },
      ],
      summary: "",
    });

    const result = parseLiteraryDiagnosis(raw, usage, 2);
    expect(result.coreIssues).toHaveLength(2);
    // 按 impact 降序
    expect(result.coreIssues[0]?.title).toBe("问题2");
    expect(result.coreIssues[1]?.title).toBe("问题3");
  });

  it("severity 越界被 clamp 到 1-10", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [
        { dimension: "narrative_drive", severity: 15, rootCause: "", improvementDirection: "" },
        { dimension: "character_voice", severity: -2, rootCause: "", improvementDirection: "" },
      ],
      coreIssues: [],
      summary: "",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.dimensionDiagnoses[0]?.severity).toBe(10);
    expect(result.dimensionDiagnoses[1]?.severity).toBe(1);
  });

  it("无效维度被过滤", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [
        { dimension: "invalid_dim", severity: 5, rootCause: "", improvementDirection: "" },
        { dimension: "narrative_drive", severity: 5, rootCause: "valid", improvementDirection: "" },
      ],
      coreIssues: [],
      summary: "",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.dimensionDiagnoses).toHaveLength(1);
    expect(result.dimensionDiagnoses[0]?.dimension).toBe("narrative_drive");
  });

  it("空标题的 coreIssue 被过滤", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [],
      coreIssues: [
        { title: "", dimensions: [], rootCause: "", improvementDirection: "", impact: 8 },
        { title: "有效问题", dimensions: [], rootCause: "", improvementDirection: "", impact: 6 },
      ],
      summary: "",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.coreIssues).toHaveLength(1);
    expect(result.coreIssues[0]?.title).toBe("有效问题");
  });

  it("解析失败返回 fallback", () => {
    const result = parseLiteraryDiagnosis("无效JSON", usage);
    expect(result.dimensionDiagnoses).toEqual([]);
    expect(result.coreIssues).toEqual([]);
    expect(result.summary).toContain("点睛诊断失败");
    expect(result.usage).toEqual(usage);
  });

  it("处理 markdown 包裹的 JSON", () => {
    const raw = `以下是诊断结果：

\`\`\`json
{
  "dimensionDiagnoses": [
    {
      "dimension": "pacing_root_cause",
      "severity": 6,
      "rootCause": "信息密度不足",
      "improvementDirection": "压缩描写",
      "evidence": "路上遇到了师妹"
    }
  ],
  "coreIssues": [],
  "summary": "节奏偏慢"
}
\`\`\``;

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.dimensionDiagnoses).toHaveLength(1);
    expect(result.dimensionDiagnoses[0]?.dimension).toBe("pacing_root_cause");
    expect(result.summary).toBe("节奏偏慢");
  });

  it("coreIssues 中无效维度被过滤", () => {
    const raw = JSON.stringify({
      dimensionDiagnoses: [],
      coreIssues: [
        {
          title: "问题",
          dimensions: ["narrative_drive", "invalid_dim", "character_voice"],
          rootCause: "",
          improvementDirection: "",
          impact: 7,
        },
      ],
      summary: "",
    });

    const result = parseLiteraryDiagnosis(raw, usage);
    expect(result.coreIssues[0]?.dimensions).toEqual(["narrative_drive", "character_voice"]);
  });
});

// ── buildDiagnosisMessage ──────────────────────────

describe("buildDiagnosisMessage", () => {
  it("包含所有输入信息", () => {
    const msg = buildDiagnosisMessage(sampleInput);
    expect(msg).toContain("第 5 章");
    expect(msg).toContain("出山");
    expect(msg).toContain("明镜审校反馈");
    expect(msg).toContain("综合分 6.2");
    expect(msg).toContain("角色档案");
    expect(msg).toContain("李长安");
    expect(msg).toContain("全书主题");
    expect(msg).toContain("权力腐蚀人性");
    expect(msg).toContain("走出山门");
    // 维度列表
    expect(msg).toContain("叙事动力");
    expect(msg).toContain("情感真实性");
    expect(msg).toContain("narrative_drive");
  });

  it("最小输入也能正常构建", () => {
    const msg = buildDiagnosisMessage({
      content: "测试内容",
      chapterNumber: 1,
    });
    expect(msg).toContain("第 1 章");
    expect(msg).toContain("测试内容");
    expect(msg).not.toContain("明镜审校反馈");
    expect(msg).not.toContain("角色档案");
    expect(msg).not.toContain("全书主题");
    // 维度列表始终存在
    expect(msg).toContain("叙事动力");
  });
});

// ── DIANJING_SYSTEM_PROMPT ──────────────────────────

describe("DIANJING_SYSTEM_PROMPT", () => {
  it("包含核心指导", () => {
    expect(DIANJING_SYSTEM_PROMPT).toContain("叙事动力");
    expect(DIANJING_SYSTEM_PROMPT).toContain("情感真实性");
    expect(DIANJING_SYSTEM_PROMPT).toContain("根因");
    expect(DIANJING_SYSTEM_PROMPT).toContain("dimensionDiagnoses");
    expect(DIANJING_SYSTEM_PROMPT).toContain("coreIssues");
    expect(DIANJING_SYSTEM_PROMPT).toContain("JSON");
  });
});

// ── 常量验证 ──────────────────────────────────────

describe("常量", () => {
  it("ALL_DIAGNOSIS_DIMENSIONS 包含 5 个维度", () => {
    expect(ALL_DIAGNOSIS_DIMENSIONS).toHaveLength(5);
  });

  it("DIAGNOSIS_DIMENSION_LABELS 覆盖所有维度", () => {
    for (const dim of ALL_DIAGNOSIS_DIMENSIONS) {
      expect(DIAGNOSIS_DIMENSION_LABELS[dim]).toBeTruthy();
    }
  });

  it("DEFAULT_DIANJING_CONFIG 有合理默认值", () => {
    expect(DEFAULT_DIANJING_CONFIG.agentId).toBe("dianjing");
    expect(DEFAULT_DIANJING_CONFIG.maxCoreIssues).toBe(2);
    expect(DEFAULT_DIANJING_CONFIG.diagnosisDepth).toBe("deep");
  });
});

// ── DianjingEngine ──────────────────────────────────

describe("DianjingEngine", () => {
  it("构造函数使用默认配置", () => {
    const engine = new DianjingEngine();
    expect(engine.getConfig()).toEqual(DEFAULT_DIANJING_CONFIG);
  });

  it("构造函数接受自定义配置", () => {
    const engine = new DianjingEngine({ maxCoreIssues: 3, diagnosisDepth: "standard" });
    expect(engine.getConfig().maxCoreIssues).toBe(3);
    expect(engine.getConfig().diagnosisDepth).toBe("standard");
    expect(engine.getConfig().agentId).toBe("dianjing");
  });

  describe("diagnose", () => {
    it("调用 bridge 并返回解析后的诊断", async () => {
      const responseJson = JSON.stringify({
        dimensionDiagnoses: [
          {
            dimension: "narrative_drive",
            severity: 7,
            rootCause: "角色被外部事件推着走",
            improvementDirection: "增加内在冲突",
            evidence: "他叹了口气",
          },
        ],
        coreIssues: [
          {
            title: "缺乏内驱力",
            dimensions: ["narrative_drive"],
            rootCause: "根因分析",
            improvementDirection: "改进方向",
            impact: 8,
          },
        ],
        summary: "核心问题是缺乏内在动机",
      });

      const bridge = createMockBridge(responseJson);
      const engine = new DianjingEngine();

      const result = await engine.diagnose(sampleInput, bridge);

      expect(result.dimensionDiagnoses).toHaveLength(1);
      expect(result.dimensionDiagnoses[0]?.dimension).toBe("narrative_drive");
      expect(result.coreIssues).toHaveLength(1);
      expect(result.coreIssues[0]?.title).toBe("缺乏内驱力");
      expect(result.summary).toContain("内在动机");
      expect(result.usage.inputTokens).toBe(200);

      expect(bridge.invokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "dianjing",
          systemPrompt: expect.stringContaining("根因"),
          temperature: 0.3,
        }),
      );
    });

    it("bridge 失败返回 fallback 诊断", async () => {
      const bridge = createFailingBridge();
      const engine = new DianjingEngine();

      const result = await engine.diagnose(sampleInput, bridge);

      expect(result.dimensionDiagnoses).toEqual([]);
      expect(result.coreIssues).toEqual([]);
      expect(result.summary).toContain("点睛诊断失败");
      expect(result.summary).toContain("LLM service unavailable");
      expect(result.usage.inputTokens).toBe(0);
    });

    it("placeholder bridge 响应解析失败也有 fallback", async () => {
      const bridge = createMockBridge("这不是JSON响应");
      const engine = new DianjingEngine();

      const result = await engine.diagnose(sampleInput, bridge);

      expect(result.dimensionDiagnoses).toEqual([]);
      expect(result.coreIssues).toEqual([]);
      expect(result.summary).toContain("点睛诊断失败");
      expect(result.rawResponse).toBe("这不是JSON响应");
    });

    it("尊重 maxCoreIssues 配置", async () => {
      const responseJson = JSON.stringify({
        dimensionDiagnoses: [],
        coreIssues: [
          { title: "A", dimensions: [], rootCause: "", improvementDirection: "", impact: 9 },
          { title: "B", dimensions: [], rootCause: "", improvementDirection: "", impact: 7 },
          { title: "C", dimensions: [], rootCause: "", improvementDirection: "", impact: 5 },
        ],
        summary: "",
      });

      const bridge = createMockBridge(responseJson);
      const engine = new DianjingEngine({ maxCoreIssues: 1 });

      const result = await engine.diagnose(
        { content: "测试", chapterNumber: 1 },
        bridge,
      );

      expect(result.coreIssues).toHaveLength(1);
      expect(result.coreIssues[0]?.title).toBe("A");
    });
  });
});
