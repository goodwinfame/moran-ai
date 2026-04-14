/**
 * 匠心 Prompt 模板 — 世界/角色/结构设计
 *
 * 三大领域各有独立 prompt，由 JiangxinEngine 按需调用。
 */

import type {
  CharacterDesignInput,
  StructurePlanInput,
  WorldDesignInput,
} from "./types.js";

// ── 系统提示词 ──────────────────────────────────────────

/** 匠心角色系统提示词 */
export const JIANGXIN_SYSTEM_PROMPT = `你是匠心，墨染写作平台的架构师。

你的核心能力：
- 构建严密自洽的世界观（开放式子系统，支持随时扩展）
- 设计有深度的角色（传记法 + WANT/NEED/LIE/GHOST 四维心理模型）
- 规划张弛有度的故事结构（弧段-章节两级，含爆点和伏笔）

设计原则：
- 人物先行——角色是故事的核心，世界为角色服务
- 伏笔必须有回收计划——埋设时就标注预计回收位置
- 爆点章是读者留存的关键——每个弧段至少 1 个高潮
- 章节概要是方向性描述，不是严格剧本——给执笔留出创作空间

你的输出必须是结构化的 JSON，便于系统解析。不要输出 markdown 代码块标记。`;

// ── 世界观设计 ──────────────────────────────────────────

/**
 * 构建世界观设计 prompt
 */
export function buildWorldDesignPrompt(input: WorldDesignInput): string {
  const reqNote = input.requirements
    ? `\n用户特殊要求：${input.requirements}`
    : "";
  const refNote = input.referenceKnowledge && input.referenceKnowledge.length > 0
    ? `\n参考知识：\n${input.referenceKnowledge.join("\n---\n")}`
    : "";

  return `## 世界观设计

创意简报：
${input.briefSummary}${reqNote}${refNote}

请为这个故事设计完整的世界观。

要求：
1. 世界概述（500字以内，描绘整体世界面貌）
2. 列出所有必要的世界子系统（至少包含核心设定，可扩展）
3. 每个子系统要有明确的规则和约束
4. 子系统之间需要逻辑自洽

输出 JSON 格式：
{
  "overview": "世界概述",
  "subsystems": [
    {
      "id": "英文标识(kebab-case)",
      "name": "中文名称",
      "tags": ["标签1", "标签2"],
      "description": "详细描述",
      "rules": ["规则1", "规则2"]
    }
  ]
}

只输出 JSON，不要其他文字。`;
}

// ── 角色设计 ──────────────────────────────────────────

/**
 * 构建角色设计 prompt
 */
export function buildCharacterDesignPrompt(input: CharacterDesignInput): string {
  const existingNote = input.existingCharacters && input.existingCharacters.length > 0
    ? `\n已有角色：\n${input.existingCharacters.map(c => `- ${c.name}（${c.role}）：${c.description}`).join("\n")}`
    : "";
  const reqNote = input.requirements
    ? `\n用户特殊要求：${input.requirements}`
    : "";
  const refNote = input.referenceKnowledge && input.referenceKnowledge.length > 0
    ? `\n参考知识：\n${input.referenceKnowledge.join("\n---\n")}`
    : "";

  return `## 角色设计

创意简报：
${input.briefSummary}

世界观概述：
${input.worldOverview}${existingNote}${reqNote}${refNote}

请设计故事的核心角色（至少 3 个，包含主角、对手、关键配角）。

每个角色必须包含：
1. 传记（出生到故事开始前，200字以内）
2. 四维心理模型（WANT/NEED/LIE/GHOST）
3. 非功能性特征（口头禅/习惯/怪癖）
4. 与其他角色的关系
5. 角色弧线描述（LIE → TRUTH 的转变轨迹）

角色定位：protagonist（主角）、deuteragonist（第二主角）、antagonist（对手/反派）、supporting（重要配角）、minor（次要角色）

输出 JSON 格式：
{
  "characters": [
    {
      "id": "英文标识(kebab-case)",
      "name": "中文姓名",
      "role": "protagonist|deuteragonist|antagonist|supporting|minor",
      "description": "一句话描述",
      "biography": "传记",
      "psychology": {
        "want": "表面渴望",
        "need": "真实需求",
        "lie": "信奉的谎言",
        "ghost": "创伤来源"
      },
      "quirks": {
        "catchphrase": "口头禅（可选）",
        "habits": ["习惯1"],
        "eccentricities": ["怪癖1"]
      },
      "relationships": [
        {
          "targetId": "目标角色id",
          "targetName": "目标角色名",
          "type": "关系类型",
          "description": "关系描述",
          "tension": "张力源（可选）"
        }
      ],
      "arcDescription": "角色弧线"
    }
  ]
}

只输出 JSON，不要其他文字。`;
}

// ── 结构规划 ──────────────────────────────────────────

/**
 * 构建弧段结构规划 prompt
 */
export function buildStructurePlanPrompt(input: StructurePlanInput): string {
  const prevNote = input.previousArcsSummary
    ? `\n前序弧段摘要：\n${input.previousArcsSummary}`
    : "";
  const reqNote = input.requirements
    ? `\n用户特殊要求：${input.requirements}`
    : "";
  const refNote = input.referenceKnowledge && input.referenceKnowledge.length > 0
    ? `\n参考知识：\n${input.referenceKnowledge.join("\n---\n")}`
    : "";

  return `## 弧段 ${input.arcNumber} 结构规划

创意简报：
${input.briefSummary}

世界观概述：
${input.worldOverview}

角色列表：
${input.charactersSummary}${prevNote}${reqNote}${refNote}

请为弧段 ${input.arcNumber} 设计完整的结构计划。

要求：
1. 明确弧段目标（本弧段要解决的核心冲突）
2. 至少 1 个爆点章设计（标注具体章节位置）
3. 伏笔清单（标注预计回收弧段）
4. 角色发展（参与角色的 LIE→TRUTH 进度）
5. 每章概要（2-3 句方向性描述，不是严格剧本）
6. 章节数建议在 20-50 之间

章节类型：daily（日常/过渡）、normal（常规推进）、emotional（情感高潮）、action（战斗/动作）、explosion（反转/爆点）

爆点类型：reversal（反转）、revelation（揭露）、climax（高潮）、confrontation（对决）、sacrifice（牺牲）、other

输出 JSON 格式：
{
  "arcPlan": {
    "arcNumber": ${input.arcNumber},
    "name": "弧段名称",
    "goal": "弧段目标",
    "chapterCount": 25,
    "explosionPoints": [
      {
        "chapterIndex": 15,
        "description": "爆点描述",
        "type": "reversal",
        "resolvedForeshadowing": ["伏笔id"]
      }
    ],
    "foreshadowing": [
      {
        "id": "伏笔标识",
        "description": "伏笔描述",
        "plantedInArc": ${input.arcNumber},
        "resolvedInArc": null,
        "relatedCharacters": ["角色id"]
      }
    ],
    "characterArcs": [
      {
        "characterId": "角色id",
        "characterName": "角色名",
        "arcProgress": "进度描述"
      }
    ],
    "chapterOutlines": [
      {
        "index": 1,
        "description": "方向性描述",
        "chapterType": "normal",
        "isExplosion": false
      }
    ]
  }
}

只输出 JSON，不要其他文字。`;
}

// ── 章节 Brief 生成 ──────────────────────────────────

/**
 * 构建章节 Brief 生成 prompt
 *
 * 这是 Plantser Pipeline 的一部分：从弧段计划 + 上下文生成具体章节指导
 */
export function buildChapterBriefPrompt(
  arcPlanSummary: string,
  chapterOutline: string,
  chapterNumber: number,
  arcNumber: number,
  characterStates: string,
  openForeshadowing: string,
): string {
  return `## 章节 Brief 生成

弧段 ${arcNumber} 计划摘要：
${arcPlanSummary}

当前章节（第 ${chapterNumber} 章）概要：
${chapterOutline}

当前角色状态：
${characterStates}

待处理伏笔：
${openForeshadowing}

请生成这一章的写作指导。

要求：
1. 明确参与角色
2. 标注需要回收/埋设的伏笔
3. 情感地雷建议（让读者产生强烈情绪的关键瞬间）
4. Scene-Sequel 结构建议（可选）
5. Brief 是方向性指导，不是逐段剧本——给执笔留出创作空间

输出 JSON 格式：
{
  "chapterNumber": ${chapterNumber},
  "arcNumber": ${arcNumber},
  "outline": "方向性描述",
  "chapterType": "normal",
  "involvedCharacters": ["角色名1", "角色名2"],
  "foreshadowingToResolve": ["伏笔描述"],
  "foreshadowingToPlant": ["伏笔描述"],
  "emotionalMines": ["情感地雷描述"],
  "sceneSequel": "Scene-Sequel 建议"
}

只输出 JSON，不要其他文字。`;
}
