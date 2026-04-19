# Phase 9: Settings Panel — SPEC

> **UI 文档**：`docs/v2-s4-ui-design.md` §11.1 项目设置

---

## 1. 概述

ProjectSettingsDrawer 目前是 UI shell（所有值硬编码），需要接入真实数据：
Zustand store 管理状态 + API 端点持久化 + 表单事件绑定。

---

## 2. 验收标准

### AC-9.1: Settings Store

- [ ] `packages/web/src/stores/settings-store.ts` 存在
- [ ] State：projectSettings（name, genre, subGenre, writerStyle, model overrides, budget, writing params）
- [ ] Actions：
  - `loadSettings(projectId)`: 从 `GET /api/projects/:id` 加载
  - `updateSettings(projectId, patch)`: 调 `PATCH /api/projects/:id/settings`
  - `isDirty`: 是否有未保存的变更
- [ ] 乐观更新：先更新 store，API 失败时回滚

### AC-9.2: Settings API

- [ ] `PATCH /api/projects/:id/settings` 端点
- [ ] 接受 partial body：`{ name?, genre?, subGenre?, writerStyle?, modelOverrides?, budgetLimitUsd?, writingParams? }`
- [ ] writerStyle: `{ styleName: string, model?: string }` — 选择执笔子写手 + 可选模型覆盖
- [ ] modelOverrides: `{ [agentName]: modelId }` — 按 Agent 覆盖模型
- [ ] writingParams: `{ chapterWordCount?, temperature?, topP? }` — 写作参数
- [ ] 需 `requireAuth` + 校验 projectId 归属
- [ ] 当前 projects PATCH 只接受 `{ title, genre, subGenre, status }`，需扩展或新增端点

### AC-9.3: ProjectSettingsDrawer 数据绑定

- [ ] 6 个区域全部从 settings-store 读取真实数据（不再 defaultValue 硬编码）
- [ ] 每个区域有保存按钮，点击调 `updateSettings`
- [ ] 保存成功后显示 toast 提示
- [ ] 表单校验：项目名不为空、预算 >= 0、字数 > 0
- [ ] 危险区域（删除项目）有确认 Dialog

---

## 3. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/web/src/stores/settings-store.ts` | NEW | Settings Zustand store |
| `packages/api-server/src/routes/projects.ts` | MODIFY | 扩展 PATCH 端点或新增 settings 路由 |
| `packages/web/src/components/settings/ProjectSettingsDrawer.tsx` | MODIFY | 接入 store + 事件处理 |
| 测试文件 | NEW/MODIFY | 见测试要求 |

---

## 4. 测试要求

| 测试 | 类型 | 文件 |
|------|------|------|
| Settings store loadSettings | 单元 | `web/__tests__/stores/settings-store.test.ts` |
| Settings store updateSettings 乐观更新 | 单元 | 同上 |
| Settings API PATCH 端点 | 路由 | `api-server/__tests__/routes/projects.test.ts`（扩展） |
| ProjectSettingsDrawer 真实数据渲染 | 组件 | `web/__tests__/components/settings/ProjectSettingsDrawer.test.tsx` |
| ProjectSettingsDrawer 保存操作 | 组件 | 同上 |
