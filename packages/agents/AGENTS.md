# AGENTS.md — packages/agents

> Agent prompt 和配置包。M1.4+ 阶段使用。

---

## 包职责

存放各 AI Agent 的：
- System prompt 文本
- Agent 配置（温度、模型偏好等）
- Agent 间的协作协议定义

## 当前状态

M1.4 之前此包为占位符，实际 Agent 调用通过 `packages/server/src/routes/intent.ts` 内联的 `SYSTEM_PROMPT` 实现。

M1.4 集成后：
1. 将 SYSTEM_PROMPT 迁移至本包
2. 通过 `packages/core` 的 Bridge 调用

## 修改注意

- 不能在这里写运行时逻辑（只有配置/文本）
- 改动 prompt 后需要人工验证 AI 输出质量
