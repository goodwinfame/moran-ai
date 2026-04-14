import { describe, expect, it } from "vitest";
import {
  RUBRIC_DIMENSIONS,
  calculateWeightedScore,
  createDefaultRubricScore,
  judgeReviewResult,
  antiAiIssueToReviewIssue,
  parseRubricResponse,
  parseConsistencyResponse,
  collectAllIssues,
  getCompositeScore,
  getBurstiness,
} from "../rubric.js";
import type { ReviewIssue } from "../../events/types.js";
import type { AntiAiIssue } from "../../style/types.js";
import type { ReviewRoundResult, Round1Result, Round2Result, Round3Result } from "../types.js";
import { DEFAULT_REVIEW_CONFIG } from "../types.js";

describe("RUBRIC Framework", () => {
  describe("RUBRIC_DIMENSIONS", () => {
    it("has exactly 7 dimensions", () => {
      expect(RUBRIC_DIMENSIONS).toHaveLength(7);
    });

    it("weights sum to 1.0", () => {
      const total = RUBRIC_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it("all dimensions have required fields", () => {
      for (const dim of RUBRIC_DIMENSIONS) {
        expect(dim.id).toBeTruthy();
        expect(dim.name).toBeTruthy();
        expect(dim.weight).toBeGreaterThan(0);
        expect(dim.description).toBeTruthy();
      }
    });

    it("includes staleness dimension", () => {
      const staleness = RUBRIC_DIMENSIONS.find((d) => d.id === "staleness");
      expect(staleness).toBeDefined();
      expect(staleness?.name).toBe("呆板度检测");
      expect(staleness?.weight).toBe(0.15);
    });

    it("creative_novelty has lower weight (10%)", () => {
      const creative = RUBRIC_DIMENSIONS.find((d) => d.id === "creative_novelty");
      expect(creative?.weight).toBe(0.10);
    });
  });

  describe("calculateWeightedScore", () => {
    it("calculates correctly with all 7 dimensions at same score", () => {
      const scores = RUBRIC_DIMENSIONS.map((d) => ({
        dimensionId: d.id,
        score: 8,
        rationale: "test",
      }));
      expect(calculateWeightedScore(scores)).toBe(8);
    });

    it("weighs dimensions correctly", () => {
      const scores = RUBRIC_DIMENSIONS.map((d) => ({
        dimensionId: d.id,
        score: d.id === "creative_novelty" ? 10 : 7,
        rationale: "test",
      }));
      // creative_novelty (10%) = 10, rest (90%) = 7
      // weighted = 0.10*10 + 0.90*7 = 1.0 + 6.3 = 7.3
      const result = calculateWeightedScore(scores);
      expect(result).toBeCloseTo(7.3, 1);
    });

    it("returns 0 for empty scores", () => {
      expect(calculateWeightedScore([])).toBe(0);
    });

    it("ignores unknown dimension IDs", () => {
      const scores = [
        { dimensionId: "unknown" as any, score: 10, rationale: "test" },
      ];
      expect(calculateWeightedScore(scores)).toBe(0);
    });

    it("handles partial dimensions", () => {
      const scores = [
        { dimensionId: "narrative_rhythm" as const, score: 8, rationale: "test" },
        { dimensionId: "conflict_tension" as const, score: 6, rationale: "test" },
      ];
      // Only these two have weight 0.15 each
      // weighted = (8*0.15 + 6*0.15) / (0.15 + 0.15) = 2.1 / 0.3 = 7.0
      expect(calculateWeightedScore(scores)).toBe(7);
    });
  });

  describe("createDefaultRubricScore", () => {
    it("creates score with all 7 dimensions", () => {
      const score = createDefaultRubricScore();
      expect(score.dimensions).toHaveLength(7);
    });

    it("uses provided default score", () => {
      const score = createDefaultRubricScore(5);
      expect(score.weightedScore).toBe(5);
      for (const dim of score.dimensions) {
        expect(dim.score).toBe(5);
      }
    });

    it("defaults to 7.5", () => {
      const score = createDefaultRubricScore();
      expect(score.weightedScore).toBe(7.5);
    });
  });

  describe("judgeReviewResult", () => {
    it("passes when all criteria met", () => {
      const result = judgeReviewResult([], 8.0, 0.5);
      expect(result.passed).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it("fails on CRITICAL issue", () => {
      const issues: ReviewIssue[] = [
        { issue: "角色崩坏", severity: "critical" },
      ];
      const result = judgeReviewResult(issues, 9.0, 0.5);
      expect(result.passed).toBe(false);
      expect(result.reasons[0]).toContain("CRITICAL");
    });

    it("fails on 2+ MAJOR issues", () => {
      const issues: ReviewIssue[] = [
        { issue: "AI味明显", severity: "major" },
        { issue: "节奏失衡", severity: "major" },
      ];
      const result = judgeReviewResult(issues, 8.0, 0.5);
      expect(result.passed).toBe(false);
      expect(result.reasons[0]).toContain("MAJOR");
    });

    it("passes with 1 MAJOR issue (below threshold)", () => {
      const issues: ReviewIssue[] = [
        { issue: "AI味明显", severity: "major" },
      ];
      const result = judgeReviewResult(issues, 8.0, 0.5);
      expect(result.passed).toBe(true);
    });

    it("fails on low score", () => {
      const result = judgeReviewResult([], 6.5, 0.5);
      expect(result.passed).toBe(false);
      expect(result.reasons[0]).toContain("综合分");
    });

    it("fails on low burstiness", () => {
      const result = judgeReviewResult([], 8.0, 0.2);
      expect(result.passed).toBe(false);
      expect(result.reasons[0]).toContain("Burstiness");
    });

    it("accumulates multiple failure reasons", () => {
      const issues: ReviewIssue[] = [
        { issue: "问题", severity: "critical" },
        { issue: "问题A", severity: "major" },
        { issue: "问题B", severity: "major" },
      ];
      const result = judgeReviewResult(issues, 5.0, 0.1);
      expect(result.passed).toBe(false);
      expect(result.reasons.length).toBe(4); // critical + major + score + burstiness
    });

    it("respects custom config", () => {
      const config = {
        ...DEFAULT_REVIEW_CONFIG,
        passingScore: 6.0,
        burstinessThreshold: 0.2,
        maxMajorIssues: 5,
      };
      const result = judgeReviewResult([], 6.5, 0.25, config);
      expect(result.passed).toBe(true);
    });

    it("ignores minor and suggestion severity", () => {
      const issues: ReviewIssue[] = [
        { issue: "小问题", severity: "minor" },
        { issue: "建议", severity: "suggestion" },
        { issue: "建议2", severity: "suggestion" },
        { issue: "小问题2", severity: "minor" },
      ];
      const result = judgeReviewResult(issues, 8.0, 0.5);
      expect(result.passed).toBe(true);
    });
  });

  describe("antiAiIssueToReviewIssue", () => {
    it("converts low_burstiness to major severity", () => {
      const issue: AntiAiIssue = {
        type: "low_burstiness",
        description: "句长变化率过低",
      };
      const result = antiAiIssueToReviewIssue(issue);
      expect(result.severity).toBe("major");
      expect(result.issue).toBe("句长变化率过低");
      expect(result.suggestion).toContain("句式");
    });

    it("converts forbidden_word to major severity", () => {
      const issue: AntiAiIssue = {
        type: "forbidden_word",
        description: "检测到禁忌词",
        evidence: "赛博",
      };
      const result = antiAiIssueToReviewIssue(issue);
      expect(result.severity).toBe("major");
      expect(result.evidence).toBe("赛博");
    });

    it("converts other types to minor severity", () => {
      const types: AntiAiIssue["type"][] = [
        "repetitive_structure",
        "emotional_telling",
        "sensory_overload",
        "repetitive_thoughts",
        "mixed_language",
      ];

      for (const type of types) {
        const issue: AntiAiIssue = { type, description: `test-${type}` };
        const result = antiAiIssueToReviewIssue(issue);
        expect(result.severity).toBe("minor");
      }
    });

    it("provides appropriate suggestions for each type", () => {
      const types: AntiAiIssue["type"][] = [
        "low_burstiness",
        "repetitive_structure",
        "emotional_telling",
        "sensory_overload",
        "repetitive_thoughts",
        "forbidden_word",
        "mixed_language",
      ];

      for (const type of types) {
        const issue: AntiAiIssue = { type, description: `test-${type}` };
        const result = antiAiIssueToReviewIssue(issue);
        expect(result.suggestion).toBeTruthy();
        expect(result.suggestion!.length).toBeGreaterThan(5);
      }
    });
  });

  describe("parseRubricResponse", () => {
    it("parses valid JSON with code fence", () => {
      const response = `Here is my analysis:

\`\`\`json
{
  "dimensions": [
    { "dimensionId": "narrative_rhythm", "score": 8, "rationale": "节奏好" },
    { "dimensionId": "conflict_tension", "score": 7, "rationale": "冲突稍弱" },
    { "dimensionId": "character_depth", "score": 9, "rationale": "人物丰满" },
    { "dimensionId": "dialogue_natural", "score": 8, "rationale": "对话自然" },
    { "dimensionId": "emotional_resonance", "score": 7, "rationale": "情感到位" },
    { "dimensionId": "staleness", "score": 6, "rationale": "略显呆板" },
    { "dimensionId": "creative_novelty", "score": 8, "rationale": "有亮点" }
  ],
  "overallComment": "整体不错",
  "issues": [
    {
      "issue": "第3段节奏拖沓",
      "severity": "major",
      "evidence": "连续5段描写",
      "suggestion": "缩短为2段",
      "expectedEffect": "节奏更紧凑"
    }
  ]
}
\`\`\``;

      const result = parseRubricResponse(response);
      expect(result).not.toBeNull();
      expect(result!.rubricScore.dimensions).toHaveLength(7);
      expect(result!.rubricScore.weightedScore).toBeGreaterThan(0);
      expect(result!.issues).toHaveLength(1);
      expect(result!.issues[0]!.severity).toBe("major");
    });

    it("parses bare JSON without code fence", () => {
      const response = `{
  "dimensions": [
    { "dimensionId": "narrative_rhythm", "score": 7, "rationale": "ok" }
  ],
  "overallComment": "fine",
  "issues": []
}`;

      const result = parseRubricResponse(response);
      expect(result).not.toBeNull();
      expect(result!.rubricScore.dimensions).toHaveLength(1);
    });

    it("clamps scores to 1-10 range", () => {
      const response = `\`\`\`json
{
  "dimensions": [
    { "dimensionId": "narrative_rhythm", "score": 15, "rationale": "ok" },
    { "dimensionId": "conflict_tension", "score": -2, "rationale": "bad" }
  ],
  "overallComment": "",
  "issues": []
}
\`\`\``;

      const result = parseRubricResponse(response);
      expect(result).not.toBeNull();
      expect(result!.rubricScore.dimensions[0]!.score).toBe(10);
      expect(result!.rubricScore.dimensions[1]!.score).toBe(1);
    });

    it("returns null for invalid JSON", () => {
      expect(parseRubricResponse("not json at all")).toBeNull();
    });

    it("returns null for missing dimensions", () => {
      expect(parseRubricResponse('{ "overallComment": "no dims" }')).toBeNull();
    });

    it("skips unknown dimension IDs", () => {
      const response = `\`\`\`json
{
  "dimensions": [
    { "dimensionId": "unknown_dim", "score": 8, "rationale": "ok" },
    { "dimensionId": "narrative_rhythm", "score": 7, "rationale": "ok" }
  ],
  "overallComment": "",
  "issues": []
}
\`\`\``;

      const result = parseRubricResponse(response);
      expect(result).not.toBeNull();
      expect(result!.rubricScore.dimensions).toHaveLength(1);
    });

    it("validates severity values in issues", () => {
      const response = `\`\`\`json
{
  "dimensions": [
    { "dimensionId": "narrative_rhythm", "score": 7, "rationale": "ok" }
  ],
  "overallComment": "",
  "issues": [
    { "issue": "test", "severity": "invalid_severity" },
    { "issue": "test2", "severity": "critical" }
  ]
}
\`\`\``;

      const result = parseRubricResponse(response);
      expect(result!.issues[0]!.severity).toBe("minor"); // fallback
      expect(result!.issues[1]!.severity).toBe("critical");
    });
  });

  describe("parseConsistencyResponse", () => {
    it("parses valid consistency response", () => {
      const response = `\`\`\`json
{
  "issues": [
    {
      "issue": "角色位置矛盾",
      "severity": "critical",
      "evidence": "第2段李长安在山顶，第5段突然出现在城中",
      "suggestion": "添加下山过程",
      "expectedEffect": "空间逻辑连贯"
    }
  ]
}
\`\`\``;

      const result = parseConsistencyResponse(response);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0]!.severity).toBe("critical");
    });

    it("returns empty array for no issues", () => {
      const response = `\`\`\`json
{ "issues": [] }
\`\`\``;

      const result = parseConsistencyResponse(response);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(0);
    });

    it("returns null for invalid response", () => {
      expect(parseConsistencyResponse("random text")).toBeNull();
    });
  });

  describe("collectAllIssues", () => {
    it("collects issues from all rounds", () => {
      const rounds: ReviewRoundResult[] = [
        {
          round: 1,
          antiAiCheck: { passed: true, burstiness: 0.5, issues: [] },
          issues: [{ issue: "r1-issue", severity: "minor" }],
        },
        {
          round: 2,
          issues: [{ issue: "r2-issue", severity: "critical" }],
        },
        {
          round: 3,
          rubricScore: createDefaultRubricScore(),
          issues: [{ issue: "r3-issue", severity: "major" }],
        },
      ];

      const all = collectAllIssues(rounds);
      expect(all).toHaveLength(3);
    });

    it("returns empty for rounds with no issues", () => {
      const rounds: ReviewRoundResult[] = [
        {
          round: 1,
          antiAiCheck: { passed: true, burstiness: 0.5, issues: [] },
          issues: [],
        },
      ];

      const all = collectAllIssues(rounds);
      expect(all).toHaveLength(0);
    });
  });

  describe("getCompositeScore", () => {
    it("returns Round 3 RUBRIC score when available", () => {
      const rounds: ReviewRoundResult[] = [
        {
          round: 1,
          antiAiCheck: { passed: true, burstiness: 0.5, issues: [] },
          issues: [],
        },
        {
          round: 3,
          rubricScore: { dimensions: [], weightedScore: 8.5, overallComment: "" },
          issues: [],
        },
      ];

      expect(getCompositeScore(rounds)).toBe(8.5);
    });

    it("returns default 7.5 when Round 3 not present", () => {
      const rounds: ReviewRoundResult[] = [
        {
          round: 1,
          antiAiCheck: { passed: true, burstiness: 0.5, issues: [] },
          issues: [],
        },
      ];

      expect(getCompositeScore(rounds)).toBe(7.5);
    });
  });

  describe("getBurstiness", () => {
    it("returns Round 1 burstiness when available", () => {
      const rounds: ReviewRoundResult[] = [
        {
          round: 1,
          antiAiCheck: { passed: true, burstiness: 0.45, issues: [] },
          issues: [],
        },
      ];

      expect(getBurstiness(rounds)).toBe(0.45);
    });

    it("returns default 0.5 when Round 1 not present", () => {
      expect(getBurstiness([])).toBe(0.5);
    });
  });
});
