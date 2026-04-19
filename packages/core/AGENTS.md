# AGENTS.md — packages/core

> 共享库。被 web 和 server 同时依赖。改动影响范围大，谨慎修改。

---

## V2 包职责

| 模块 | 说明 |
|------|------|
| `src/db/` | Drizzle ORM schema + migrations（PostgreSQL） |
| `src/types/` | 共享类型定义 |
| `src/events/` | EventBus — 项目内事件总线 |
| `src/logger/` | createLogger() 工具（pino） |

## V2 变更

V1 的 Agent 引擎（lingxi, jiangxin, zaishi, xidian 等）已全部删除。
V2 中 Agent 逻辑通过 OpenCode config 定义，不在 core 中实现。

保留模块：
- **db**: 数据库 schema 是共享资源，V2 会在此基础上演进
- **events**: 事件总线是通用模式，V2 的 SSE 推送复用此模块
- **logger**: 通用日志工具
- **types**: 共享类型定义

## 修改注意

- `EventBus` 有完整测试，改前先跑 `pnpm test`
- 导出路径统一在 `package.json` 的 `exports` 字段中声明
- 不能引入 server 或 web 的依赖（单向依赖：web/server → core）
