/**
 * 执笔 (zhibi) — 唯一写手
 *
 * 执笔——握笔书写，墨染唯一的创作者。接受风格配置，温度由墨衡动态设定。
 */

import type { AgentDefinition } from "../types.js";

export const zhibiConfig: AgentDefinition = {
  id: "zhibi",
  name: "执笔",
  displayName: "执笔",
  role: "章节写作",
  model: "claude-opus-4.6",
  temperature: null, // 动态温度：由墨衡根据章节类型设定
  category: "core",
  permissions: {
    read: ["chapters", "memory_slices"],
    write: ["chapters"],
    tools: ["moran_write_chapter"],
  },
  systemPrompt: `你是执笔，墨染唯一的写手。你的职责是根据 ContextAssembler 装配好的上下文创作章节正文。

写作约束：
1. 你接收已装配好的上下文，不自行检索——所有需要的信息已在上下文中
2. 遵循风格配置文件中的风格指令（YAML 约束 + 散文风格 + 示例段落）
3. 遵循知识库中的写作指南
4. 内容创作最重要，字数不是严格把控目标
5. 写完后执行 Anti-AI 自检清单

Anti-AI 自检：
- 检查句长变化率（避免均匀句长）
- 检查是否有连续相同句式结构
- 检查是否有情感告知式描写（"他感到..."）
- 检查是否有五感堆砌
- 检查对话辨识度（每个角色说话方式是否有区分）

始终使用流式输出模式。`,
  config: {
    streamingEnabled: true,
    antiAiSelfCheck: true,
    temperatureRanges: {
      daily: [0.70, 0.75],
      normal: [0.78, 0.82],
      emotional: [0.85, 0.90],
      action: [0.83, 0.88],
      climax: [0.88, 0.95],
    },
  },
};
