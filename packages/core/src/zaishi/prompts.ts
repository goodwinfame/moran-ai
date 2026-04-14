/**
 * 载史 (zaishi) — 归档 Prompt 模板
 *
 * 分两层：
 * - Haiku 初筛：快速从章节中提取关键要素
 * - Sonnet 核心归档：基于初筛结果生成结构化归档数据
 */

// ── System Prompt ──────────────────────────────

export const ZAISHI_SCREENING_SYSTEM_PROMPT = `你是"载史"——一位精确的文本分析师。你的任务是从小说章节中快速提取关键信息要素。

## 规则
1. 只提取明确存在于文本中的信息，不推测、不补充
2. 角色名必须使用文本中出现的完整名称
3. 事件描述保持客观简洁，每条不超过30字
4. 情感变化必须有文本依据
5. 输出严格 JSON 格式，不附加解释`;

export const ZAISHI_ARCHIVING_SYSTEM_PROMPT = `你是"载史"——一位资深的叙事记录官。你的任务是根据章节全文和初筛提取结果，生成高质量的归档数据。

## 摘要写作规则
1. 摘要字数控制在500-800字
2. 采用Markdown格式，按时间线组织
3. 重要对话和决策必须记录
4. 情感转折点必须标注
5. 与前文的关联（伏笔呼应、角色发展）必须提及
6. 不要使用"本章"等元叙事用语，直接叙述事件

## 角色状态规则
1. 只记录发生变化的角色
2. 位置只在角色移动时记录
3. 情感状态用简洁词汇描述（如"愤怒"、"困惑"、"释然"）
4. 获知的信息必须是新增的，不重复已知内容
5. LIE 进展只在有明确动摇/强化/破碎时记录

## 伏笔规则
1. 新伏笔：文中首次出现的悬念/暗示/未解之谜 → planted
2. 发展中：已有伏笔在本章有新的线索/暗示 → developing
3. 已解决：伏笔在本章被明确揭示/解答 → resolved
4. 只记录确实存在的伏笔变化，不强行补充

## 输出严格 JSON 格式，不附加任何解释文本`;

// ── Haiku 初筛 Prompt ──────────────────────────

export function buildScreeningPrompt(
  chapterNumber: number,
  chapterContent: string,
  chapterTitle?: string,
): string {
  const titlePart = chapterTitle ? `\n标题：${chapterTitle}` : "";
  return `请从以下章节中提取关键信息要素。

## 章节信息
章节序号：第${chapterNumber}章${titlePart}

## 章节正文
${chapterContent}

## 请提取以下信息，以 JSON 格式返回：

\`\`\`json
{
  "appearingCharacters": ["角色名1", "角色名2"],
  "keyEvents": [
    {
      "description": "事件简述(不超过30字)",
      "characters": ["相关角色"],
      "significance": "minor|moderate|major|critical"
    }
  ],
  "settingChanges": [
    {
      "domain": "变化领域(如力量体系/地理/政治)",
      "description": "变化描述"
    }
  ],
  "emotionalShifts": [
    {
      "character": "角色名",
      "from": "之前的情感状态",
      "to": "变化后的情感状态",
      "trigger": "触发原因"
    }
  ]
}
\`\`\``;
}

// ── Sonnet 核心归档 Prompt ──────────────────────

export function buildArchivingPrompt(
  chapterNumber: number,
  chapterContent: string,
  screeningJson: string,
  options?: {
    chapterTitle?: string;
    previousSummaries?: string[];
    knownCharacterNames?: string[];
    summaryTargetWords?: number;
  },
): string {
  const titlePart = options?.chapterTitle ? `\n标题：${options.chapterTitle}` : "";
  const targetWords = options?.summaryTargetWords ?? 650;

  let previousContext = "";
  if (options?.previousSummaries && options.previousSummaries.length > 0) {
    previousContext = `\n## 前几章摘要（供上下文参考）\n${options.previousSummaries.map((s, i) => `### 第${chapterNumber - options.previousSummaries!.length + i}章摘要\n${s}`).join("\n\n")}`;
  }

  let knownChars = "";
  if (options?.knownCharacterNames && options.knownCharacterNames.length > 0) {
    knownChars = `\n## 已知角色（请使用这些名字匹配）\n${options.knownCharacterNames.join("、")}`;
  }

  return `请基于章节全文和初筛提取结果，生成完整的归档数据。

## 章节信息
章节序号：第${chapterNumber}章${titlePart}
${previousContext}${knownChars}

## Haiku 初筛结果
${screeningJson}

## 章节正文
${chapterContent}

## 请生成以下归档数据，以 JSON 格式返回：

\`\`\`json
{
  "chapterSummary": "章节摘要(${targetWords}字左右，Markdown格式，按时间线组织，记录重要对话和决策，标注情感转折点)",
  "characterDeltas": [
    {
      "characterName": "角色名",
      "location": "当前位置(仅在移动时填写)",
      "emotionalState": "情感状态",
      "knowledgeGained": ["新获知的信息"],
      "changes": ["本章发生的变化"],
      "lieProgress": "LIE进展描述(仅在有明确动摇/强化时填写)",
      "powerLevel": "力量等级(仅在变化时填写)",
      "physicalCondition": "身体状况(仅在变化时填写)",
      "isAlive": true
    }
  ],
  "plotThreadUpdates": [
    {
      "threadName": "伏笔名称",
      "newStatus": "planted|developing|resolved|stale",
      "keyMoment": "本章关键进展",
      "description": "新伏笔的描述(仅新planted时填写)",
      "relatedCharacters": ["相关角色"]
    }
  ],
  "timelineEvents": [
    {
      "storyTimestamp": "故事内时间(如有)",
      "description": "事件描述",
      "characterNames": ["相关角色"],
      "locationName": "发生地点",
      "significance": "minor|moderate|major|critical"
    }
  ],
  "relationshipChanges": [
    {
      "sourceName": "角色A",
      "targetName": "角色B",
      "type": "关系类型(如师徒/敌对/暧昧)",
      "intensityDelta": 0.1,
      "description": "变化描述"
    }
  ]
}
\`\`\``;
}

// ── 弧段摘要 Prompt ──────────────────────────────

export function buildArcSummaryPrompt(
  arcIndex: number,
  arcTitle: string | undefined,
  arcDescription: string | undefined,
  chapterSummaries: Array<{ chapterNumber: number; summary: string }>,
): string {
  const titlePart = arcTitle ? ` — ${arcTitle}` : "";
  const descPart = arcDescription ? `\n弧段描述：${arcDescription}` : "";

  const summaryList = chapterSummaries
    .map((cs) => `### 第${cs.chapterNumber}章\n${cs.summary}`)
    .join("\n\n");

  return `请综合以下弧段所有章节摘要，生成一份弧段级综合摘要。

## 弧段信息
弧段序号：第${arcIndex}弧段${titlePart}${descPart}
章节范围：第${chapterSummaries[0]?.chapterNumber ?? "?"}章 — 第${chapterSummaries[chapterSummaries.length - 1]?.chapterNumber ?? "?"}章

## 各章节摘要

${summaryList}

## 要求

1. 弧段摘要应覆盖整个弧段的核心事件线和角色发展
2. 字数控制在800-1200字
3. 采用Markdown格式
4. 突出弧段的核心冲突如何发展和（是否）解决
5. 标注重要伏笔的植入/发展/回收
6. 记录主要角色在本弧段的成长/变化弧线

请直接返回弧段摘要文本（Markdown格式），不需要JSON包裹。`;
}
