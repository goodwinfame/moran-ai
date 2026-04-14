/**
 * 灵犀 Prompt 模板 — 四阶段创意脑暴
 *
 * 每个阶段独立调用 LLM，prompt 结构化设计。
 * 所有 prompt 使用中文（面向中文创作）。
 */

import type { BrainstormInput, ConceptProposal } from "./types.js";

// ── 系统提示词 ──────────────────────────────────────────

/** 灵犀角色系统提示词 */
export const LINGXI_SYSTEM_PROMPT = `你是灵犀，墨染写作平台的创意引擎。

你的核心能力：
- 从简单的关键词中发掘独特的故事可能性
- 每个方案都要有能让读者"非看不可"的独特卖点
- 善于极端推演——把一个设定推到极致，看会发生什么
- 方案之间要有足够差异度，不是同一个想法的微调

你的输出必须是结构化的 JSON，便于系统解析。不要输出 markdown 代码块标记。`;

// ── 发散阶段 ──────────────────────────────────────────

/**
 * 构建发散阶段的 prompt
 *
 * 目标：从关键词出发，生成 5+ 个差异化概念方案
 */
export function buildDivergencePrompt(input: BrainstormInput, minConcepts: number): string {
  const keywords = input.keywords.join("、");
  const genreNote = input.genreConstraint
    ? `\n类型约束：${input.genreConstraint}`
    : "";
  const prefNote = input.preferences
    ? `\n用户偏好：${input.preferences}`
    : "";
  const refNote = input.referenceKnowledge && input.referenceKnowledge.length > 0
    ? `\n参考知识（来自析典分析的成功作品技法）：\n${input.referenceKnowledge.join("\n---\n")}`
    : "";

  return `## 创意发散

题材/灵感关键词：${keywords}${genreNote}${prefNote}${refNote}

请生成至少 ${minConcepts} 个**差异化**的概念方案。

要求：
1. 每个方案必须有独特卖点（unique hook），能与同类作品形成差异
2. 方案之间差异度要大——不同世界观、不同核心冲突、不同叙事角度
3. 至少有 1 个"意外"方案——打破常规认知的设定
4. 每个方案的前提设定要能支撑长篇叙事（50万字+）

输出 JSON 格式（数组）：
[
  {
    "name": "方案名",
    "premise": "前提设定（100字以内）",
    "whatIf": "",
    "risk": "潜在风险（一句话）",
    "uniqueHook": "独特卖点（一句话）"
  }
]

只输出 JSON 数组，不要其他文字。`;
}

// ── 推演阶段 ──────────────────────────────────────────

/**
 * 构建 What-if 推演的 prompt
 *
 * 目标：对每个概念进行极端推演，找到最有戏剧张力的可能性
 */
export function buildWhatIfPrompt(concepts: ConceptProposal[]): string {
  const conceptList = concepts.map((c, i) =>
    `${i + 1}. 【${c.name}】${c.premise}\n   卖点：${c.uniqueHook}`,
  ).join("\n");

  return `## What-if 极端推演

对以下每个概念，进行极端推演——把核心设定推到极致，看会发生什么惊人的事。

概念列表：
${conceptList}

对每个概念回答：
- 如果核心设定被推到极端，最意想不到的结果是什么？
- 这个设定最容易让读者"非看不可"的瞬间是什么？
- 最大的叙事陷阱（容易写崩的地方）是什么？

输出 JSON 格式（数组，与输入顺序一致）：
[
  {
    "name": "方案名",
    "premise": "原前提",
    "whatIf": "极端推演结果（100字以内）",
    "risk": "最大叙事陷阱（一句话）",
    "uniqueHook": "更新后的卖点"
  }
]

只输出 JSON 数组，不要其他文字。`;
}

// ── 聚焦阶段 ──────────────────────────────────────────

/**
 * 构建聚焦阶段的 prompt
 *
 * 目标：从推演后的方案中收敛至 2-3 个最佳
 */
export function buildConvergencePrompt(concepts: ConceptProposal[], finalCount: number): string {
  const conceptList = concepts.map((c, i) =>
    `${i + 1}. 【${c.name}】\n   前提：${c.premise}\n   推演：${c.whatIf}\n   风险：${c.risk}\n   卖点：${c.uniqueHook}`,
  ).join("\n\n");

  return `## 创意聚焦

从以下方案中，选出最优的 ${finalCount} 个。

评选标准：
1. 独特性——卖点是否足够吸引人
2. 可持续性——能否支撑 50 万字以上的长篇
3. 风险可控——叙事陷阱是否有合理的规避策略
4. 情感共鸣——是否能让读者建立情感连接

候选方案：
${conceptList}

输出 JSON 格式：
{
  "selectedConcepts": [
    {
      "name": "方案名",
      "premise": "前提设定",
      "whatIf": "极端推演结果",
      "risk": "潜在风险",
      "uniqueHook": "独特卖点"
    }
  ],
  "selectionReasoning": "选择理由（说明为什么选这些、为什么淘汰其他）"
}

只输出 JSON，不要其他文字。`;
}

// ── 结晶阶段 ──────────────────────────────────────────

/**
 * 构建结晶阶段的 prompt
 *
 * 目标：从选中方案生成结构化创意简报
 */
export function buildCrystallizationPrompt(
  selectedConcepts: ConceptProposal[],
  input: BrainstormInput,
): string {
  const conceptList = selectedConcepts.map((c, i) =>
    `${i + 1}. 【${c.name}】\n   前提：${c.premise}\n   推演：${c.whatIf}\n   卖点：${c.uniqueHook}`,
  ).join("\n\n");

  const keywords = input.keywords.join("、");
  const genreNote = input.genreConstraint
    ? `\n类型偏好：${input.genreConstraint}`
    : "";

  return `## 创意结晶

基于以下选定方案，生成完整的创意简报。

原始灵感关键词：${keywords}${genreNote}

选定方案：
${conceptList}

请综合所有选定方案的精华，输出创意简报。

输出 JSON 格式：
{
  "titleCandidates": ["候选书名1", "候选书名2", "候选书名3"],
  "genre": "主类型 / 子类型",
  "logline": "一句话梗概（25字以内）",
  "coreConflict": "核心冲突描述",
  "uniqueHook": "最终确定的独特卖点",
  "tone": "整体基调描述",
  "targetAudience": "目标读者画像",
  "estimatedScale": "预估篇幅（如：100万字/200章）",
  "selectedConcepts": [
    {
      "name": "方案名",
      "premise": "前提设定",
      "whatIf": "极端推演",
      "risk": "潜在风险",
      "uniqueHook": "独特卖点"
    }
  ]
}

只输出 JSON，不要其他文字。`;
}
