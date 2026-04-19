# 墨染 V2 设计文档 — 总目录

> **版本**: V2.0  
> **日期**: 2026-04-19  
> **核心变化**: 从"多页面筹备向导 + 七面板写作台"转为"单页面：会话窗口（墨衡）+ 结构化信息面板"

---

## V1 → V2 一句话

V1 让用户分别与 10 个 Agent（5 核心 + 3 支援 + 2 可选）打交道；V2 让用户只与墨衡对话，其余 Agent 全部退居幕后，通过 MCP 工具 + 门禁保障流程质量。

---

## 章节索引

| 编号 | 文件 | 内容 |
|------|------|------|
| S0 | [本文件](v2-s0-index.md) | 总目录与变化摘要 |
| S1 | [概述与定位变更](v2-s1-overview.md) | V1→V2 变化矩阵、核心定位、设计理念 |
| S2 | [架构总览](v2-s2-architecture.md) | 单页面模型、数据流、Session 架构、技术栈 |
| S3 | [完整写作流程](v2-s3-writing-flow.md) | 从灵感到完稿的 6 阶段全流程（含对话示例） |
| S4 | [交互界面设计](v2-s4-ui-design.md) | 聊天窗口 + 信息面板的详细交互规范 |
| S5 | [Agent 协作设计](v2-s5-agents.md) | 墨衡委派机制、子 Agent 产出回流、上下文组装 |
| S6 | [MCP 工具与门禁](v2-s6-mcp-gates.md) | 工具接口定义、门禁前置条件、分类体系 |
| S7 | [副链路设计](v2-s7-sidechains.md) | 析典九维、知识库、Lessons、螺旋检测、UNM 记忆引擎、成本追踪、弧段边界暂停 |
| S8 | [错误恢复](v2-s8-error-recovery.md) | 子 Agent 失败、审校螺旋、网络中断、数据一致性 |
| S9 | [与原设计继承关系](v2-s9-inheritance.md) | 保留 / 调整 / 废弃清单 |
| S10 | [实施路线图](v2-s10-roadmap.md) | Phase 1–5 实施计划与交付物 |
| S11 | [技术方案设计](v2-s11-technical-architecture.md) | MCP/OpenCode/数据层/事件系统/认证的技术决策 |

---

## V1 → V2 变化摘要

| 维度 | V1 | V2 |
|------|-----|-----|
| **交互模型** | 多页面筹备向导 + 7 面板写作台 | 单页面：聊天窗口 + 信息面板 |
| **用户入口** | 用户直接与各子 Agent 交互 | 用户只与墨衡对话，子 Agent 全部幕后 |
| **流程控制** | 代码状态机（Orchestrator）硬编排 | 墨衡对话引导 + MCP 工具门禁 |
| **编排层** | Hono 后端编排（routes → engine → bridge → OpenCode） | OpenCode 内部编排（墨衡 → SubtaskPart → 子 Agent） |
| **Session** | 每个 Agent 独立 Session | 每个项目一个墨衡 Session |
| **数据流** | 前端 → Hono → Engine → Bridge → OpenCode → LLM | 前端 → Hono → OpenCode（墨衡）→ MCP → DB |
| **工具系统** | Engine 解析 LLM 文本后写库 | MCP 工具直接操作 DB，门禁内置 |
| **前端状态** | Zustand 内存（刷新丢失） | OpenCode 持久化 Session + DB 结构化数据 |

---

## 不变的核心

以下能力从 V1 **完整保留**，仅调整触发方式（从代码编排改为墨衡调度）：

- **Plantser Pipeline**（硬约束 / 软引导 / 自由区三层 Brief）
- **四轮审校**（AI 味检测 → 逻辑一致性 → 文学质量 → 读者体验）
- **UNM 记忆引擎**（六大类别、三层存储、ManagedWrite 管线）
- **风格引擎**（混合格式定义、9 种预设风格、温度场景化）
- **析典九维分析**
- **知识库五类**
- **螺旋检测**（审校 / 膨胀 / 矛盾三种模式）
- **10 个 Agent 角色与能力（5 核心 + 3 支援 + 2 可选）**
- **30+ 表 PostgreSQL Schema**

---

## 关联文档

V2 设计基于以下 V1 文档演进：

| V1 文档 | V2 对应 |
|---------|---------|
| project-design-s1-positioning.md | → v2-s1-overview.md |
| project-design-s2-architecture.md | → v2-s2-architecture.md |
| project-design-s3-memory-engine.md | → v2-s7-sidechains.md（记忆引擎部分） |
| project-design-s4-agents.md | → v2-s5-agents.md + v2-s3-writing-flow.md |
| project-design-s5-webui.md | → v2-s4-ui-design.md |
| project-design-s6-structure.md | → v2-s6-mcp-gates.md（Schema 部分保留） |
| project-design-s7-inheritance.md | → v2-s9-inheritance.md |
| project-design-s8-roadmap.md | → v2-s10-roadmap.md |
| product-design.md | → v2-s3-writing-flow.md + v2-s4-ui-design.md |
