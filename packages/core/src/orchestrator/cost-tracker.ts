/**
 * CostTracker — Token 消耗与费用追踪
 *
 * 记录每个 Agent 每个阶段的 token 消耗，生成章节成本汇总。
 */

import type { AgentId } from "../agents/types.js";
import type { ChapterCostSummary, CostRecord, OrchestratorPhase } from "./types.js";

/** 模型定价（每百万 token，美元） */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4.6": { input: 15, output: 75 },
  "claude-sonnet-4.6": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 0.8, output: 4 },
  "gemini-3.1-pro": { input: 1.25, output: 5 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

export class CostTracker {
  private records: CostRecord[] = [];

  /** 记录一次 token 消耗 */
  record(
    agentId: AgentId,
    phase: OrchestratorPhase,
    inputTokens: number,
    outputTokens: number,
    model?: string,
  ): CostRecord {
    const pricing = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
    const estimatedCost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

    const record: CostRecord = {
      agentId,
      phase,
      inputTokens,
      outputTokens,
      estimatedCost,
      timestamp: new Date(),
    };
    this.records.push(record);
    return record;
  }

  /** 生成章节成本汇总 */
  summarize(chapterNumber: number): ChapterCostSummary {
    const byAgent: ChapterCostSummary["byAgent"] = {};
    const byPhase: ChapterCostSummary["byPhase"] = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;

    for (const r of this.records) {
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCost += r.estimatedCost;

      // By agent
      const agentKey = r.agentId;
      const prevAgent = byAgent[agentKey] ?? { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
      byAgent[agentKey] = {
        inputTokens: prevAgent.inputTokens + r.inputTokens,
        outputTokens: prevAgent.outputTokens + r.outputTokens,
        estimatedCost: prevAgent.estimatedCost + r.estimatedCost,
      };

      // By phase
      const phaseKey = r.phase;
      const prevPhase = byPhase[phaseKey] ?? { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
      byPhase[phaseKey] = {
        inputTokens: prevPhase.inputTokens + r.inputTokens,
        outputTokens: prevPhase.outputTokens + r.outputTokens,
        estimatedCost: prevPhase.estimatedCost + r.estimatedCost,
      };
    }

    return {
      chapterNumber,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalEstimatedCost: Math.round(totalCost * 10000) / 10000,
      byAgent,
      byPhase,
    };
  }

  /** 清空记录（新章节开始时） */
  reset(): void {
    this.records.length = 0;
  }

  /** 获取原始记录 */
  getRecords(): readonly CostRecord[] {
    return this.records;
  }
}
