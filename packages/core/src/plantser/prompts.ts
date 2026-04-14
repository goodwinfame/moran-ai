/**
 * Plantser Pipeline — Prompt 模板
 *
 * 三层 Brief 生成 + 情感地雷 + Scene-Sequel 的 LLM 指令
 */

import type { PlantserInput, CharacterState, EmotionalLandmineType } from "./types.js";

// ── System Prompt ──────────────────────────────────

export const PLANTSER_SYSTEM_PROMPT = `你是"匠心"的 Plantser 助手。你的核心理念是 Plantser = Planner + Pantser：
- 不做过度规划（避免呆板）
- 也不放任自由（避免无聊）
- 用三层 Brief 给执笔"方向而非路线图"

你的任务是把弧段计划和章节大纲转化为三层 Brief，包含硬约束、软引导和自由区。`;

// ── 三层 Brief 增强 Prompt ──────────────────────────

export function buildPlantserBriefPrompt(input: PlantserInput): string {
  const outline = input.arcPlan.chapterOutlines[input.chapterIndexInArc - 1];
  const outlineDesc = outline ? outline.description : "（无大纲描述）";
  const chapterType = outline ? outline.chapterType : "normal";
  const isExplosion = outline ? outline.isExplosion : false;

  const charBlock = input.characterStates.length > 0
    ? input.characterStates.map(formatCharacterState).join("\n")
    : "（暂无角色状态信息）";

  const foreshadowBlock = input.openForeshadowing.length > 0
    ? input.openForeshadowing.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : "（暂无开放伏笔）";

  const prevSummary = input.previousChapterSummary
    ? `## 前一章摘要\n${input.previousChapterSummary}`
    : "";

  const prevMood = input.previousEndMood
    ? `\n前一章结束基调：${input.previousEndMood}`
    : "";

  const refKnowledge = input.referenceKnowledge && input.referenceKnowledge.length > 0
    ? `## 参考知识\n${input.referenceKnowledge.join("\n---\n")}`
    : "";

  const explosionNote = isExplosion ? "\n⚠️ 本章是爆点章，需要特别强化冲突张力和情感密度。" : "";

  return `请为以下章节生成三层 Plantser Brief。

## 基本信息
- 章节编号：${input.chapterNumber}
- 弧段：${input.arcPlan.arcNumber}（${input.arcPlan.name}）
- 弧段目标：${input.arcPlan.goal}
- 弧段内位置：第 ${input.chapterIndexInArc} / ${input.arcPlan.chapterCount} 章
- 章节类型：${chapterType}
- 大纲描述：${outlineDesc}${explosionNote}

## 角色状态
${charBlock}
${prevMood}

## 开放伏笔
${foreshadowBlock}

${prevSummary}

${refKnowledge}

## 输出要求

请以 JSON 格式返回，严格按照以下结构：

\`\`\`json
{
  "suggestedTitle": "建议标题（可选）",
  "hardConstraints": {
    "mustAppear": ["角色ID或名称"],
    "mustAdvance": [
      { "thread": "情节线名", "progress": "推进描述" }
    ],
    "mustHappen": ["必须发生的关键事件"],
    "mustNot": ["禁止事项"]
  },
  "softGuidance": {
    "mood": "从X过渡到Y的情感基调",
    "suggestedScenes": ["场景1描述", "场景2描述"],
    "foreshadowingHints": [
      { "plant": "埋设描述", "resolveHint": "预计回收时间" }
    ]
  },
  "freeZone": {
    "areas": ["可自由发挥的领域"],
    "encouragements": ["鼓励的创意方向"]
  },
  "sceneSequel": [
    {
      "index": 1,
      "scene": {
        "goal": "角色目标",
        "conflict": "冲突阻碍",
        "disaster": "灾难转折"
      },
      "sequel": {
        "reaction": "情感反应",
        "dilemma": "两难困境",
        "decision": "做出的决定"
      }
    }
  ]
}
\`\`\`

## 关键原则
1. 硬约束要精准、具体、不可违背
2. 软引导要给方向但留空间——"建议"而非"必须"
3. 自由区要明确鼓励创意，给执笔信心去即兴发挥
4. Scene-Sequel 的 Goal/Conflict/Disaster 要与角色心理模型(WANT/NEED/LIE)对齐
5. 每个 Scene-Sequel 循环应驱动角色弧线的细微推进`;
}

// ── 情感地雷生成 Prompt ──────────────────────────────

export function buildLandminePrompt(
  chapterNumber: number,
  chapterType: string,
  characterStates: CharacterState[],
  outline: string,
  previousEndMood?: string,
): string {
  const charBlock = characterStates.map(formatCharacterState).join("\n");
  const prevMood = previousEndMood ? `前一章结束基调：${previousEndMood}` : "";

  return `请为第 ${chapterNumber} 章设计情感地雷。

## 章节信息
- 章节类型：${chapterType}
- 大纲：${outline}
${prevMood}

## 当前角色状态
${charBlock}

## 情感地雷类型（从以下四类中选择 1-3 个）

1. **情感同时性** (emotional_simultaneity)：同一时刻产生矛盾情感
   例：又愤怒又心疼、恨铁不成钢、想靠近又害怕
2. **非理性行为** (irrational_behavior)：合乎情感但不合逻辑的选择
   例：明知是陷阱还是去了、放弃胜利去救一个不重要的人
3. **反期待时刻** (anti_expectation)：打破读者和角色的预期
   例：准备质问却发现对方先哭了、以为是敌人实际是恩人
4. **身体先行** (body_first)：身体反应先于理性认知
   例：拳头握紧了才意识到自己在生气、腿软了才知道害怕

## 输出要求

以 JSON 数组格式返回：

\`\`\`json
[
  {
    "type": "emotional_simultaneity",
    "description": "具体描述这个情感地雷的情境",
    "involvedCharacters": ["角色名"],
    "trigger": "触发条件"
  }
]
\`\`\`

## 设计原则
- 地雷必须与角色当前心理状态呼应
- 地雷必须是执笔可执行的（描述要具体到情境层面）
- 避免陈词滥调，追求意料之外情理之中
- 优先利用角色的 LIE/GHOST 来制造情感冲突`;
}

// ── 格式化辅助 ──────────────────────────────────────

function formatCharacterState(cs: CharacterState): string {
  const parts = [`- ${cs.name} (${cs.id})`];
  if (cs.emotionalState) parts.push(`  情感：${cs.emotionalState}`);
  if (cs.arcProgress !== undefined) parts.push(`  弧线进度：${Math.round(cs.arcProgress * 100)}%`);
  if (cs.psychology) {
    parts.push(`  WANT：${cs.psychology.want}`);
    parts.push(`  NEED：${cs.psychology.need}`);
    parts.push(`  LIE：${cs.psychology.lie}`);
    parts.push(`  GHOST：${cs.psychology.ghost}`);
  }
  if (cs.recentRelationshipChanges && cs.recentRelationshipChanges.length > 0) {
    parts.push(`  近期关系变化：${cs.recentRelationshipChanges.join("；")}`);
  }
  return parts.join("\n");
}

/** 验证情感地雷类型 */
export function isValidLandmineType(t: unknown): t is EmotionalLandmineType {
  return typeof t === "string" && [
    "emotional_simultaneity",
    "irrational_behavior",
    "anti_expectation",
    "body_first",
  ].includes(t);
}
