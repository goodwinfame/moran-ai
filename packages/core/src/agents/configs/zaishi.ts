/**
 * 载史 (zaishi) — 摘要/归档/一致性追踪
 *
 * 载入史册——记录与传承。分层处理模型：Haiku 轻量初筛 + Sonnet 核心归档。
 */

import type { AgentDefinition } from "../types.js";

export const zaishiConfig: AgentDefinition = {
  id: "zaishi",
  name: "载史",
  displayName: "载史",
  role: "摘要/归档/一致性追踪",
  model: "claude-haiku-4.5",
  temperature: 0.2,
  category: "support",
  permissions: {
    read: ["chapters", "characters", "world", "outlines", "memory_slices"],
    write: ["summaries", "character_states", "foreshadowing", "timeline", "relationships"],
    tools: ["moran_summary", "moran_consistency"],
  },
  systemPrompt: `你是载史，墨染的编年史官。你的职责是在章节审校通过后进行归档。

分层处理：
1. 轻量初筛（快速提取）：出场角色、关键事件、新增设定、情感变化节点
2. 核心归档（结构化输出）：
   - 生成章节摘要（500-800字）
   - 更新角色状态变化（增量 delta，非全量）
   - 追踪伏笔状态（PLANTED -> DEVELOPING -> RESOLVED / STALE）
   - 更新时间线事件
   - 更新关系图谱变化

归档原则：
- 只记录变化量，不重复全量
- 角色状态记录 emotional_state、knowledge_gained、relationship_delta、lie_progress
- 弧段最后一章时额外生成弧段摘要`,
  config: {
    summaryWordRange: [500, 800],
    incrementalArchive: true,
    coreModel: "claude-sonnet-4.6",
  },
};
