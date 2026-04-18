# AGENTS.md — packages/core

> 共享库。被 web 和 server 同时依赖。改动影响范围大，谨慎修改。

---

## 包内容

| 模块 | 说明 |
|------|------|
| `src/orchestrator/` | Orchestrator — 写作流程状态机 |
| `src/events/` | EventBus — 项目内事件总线 |
| `src/bridge/` | SessionProjectBridge — **M1.4 已集成，支持 BridgeTransport 依赖注入** |
| `src/agents/` | Agent 类型定义 + 注册表 |
| `src/jiangxin/` | JiangxinEngine — 世界观/角色/大纲对齐引擎 |
| `src/dianjing/` | DianjingEngine — 文学诊断引擎 |
| `src/shuchong/` | ShuchongEngine — 读者体验评审引擎 |
| `src/xidian/` | XidianEngine — 作品分析引擎 |
| `src/review/` | ReviewEngine — 三轮审校引擎 |
| `src/style/` | StyleManager — 文风管理 |
| `src/logger/` | createLogger() 工具 |

## Bridge 状态（✅ M1.4 已完成）

`src/bridge/bridge.ts` 中的 `SessionProjectBridge` 已完成 M1.4 集成：

- **依赖注入模式**：构造函数接受可选 `BridgeTransport`
  - 有 transport → 真实调用 OpenCode SDK（`ensureSession` + `invokeAgent`）
  - 无 transport → placeholder 响应（测试兼容）
- `ensureSession()` — 通过 transport 调用 OpenCode SDK `session.create()`
- `invokeAgent({ agentId, message, stream?, temperature? })` → 返回 `AgentResponse { content, sessionId, usage, agentId }`
- `BridgeTransport` 接口定义在 core，实现（`OpenCodeTransport`）在 `packages/server/src/opencode/bridge-transport.ts`

**所有引擎都通过 Bridge 调用 AI**，统一入口：`bridge.invokeAgent()`。

## 里程碑

| 里程碑 | Bridge 状态 |
|--------|------------|
| M1.1–1.3 | ✅ 框架定义 |
| M1.4 | ✅ 已集成 OpenCode SDK，支持 BridgeTransport 依赖注入 |

## 修改注意

- `EventBus` 和 `Orchestrator` 有完整测试，改前先跑 `pnpm test`
- 导出路径统一在 `package.json` 的 `exports` 字段中声明
- 不能引入 server 或 web 的依赖（单向依赖：web/server → core）
