# Phase 10: UI Integration & Export — SPEC

> **UI 文档**：`docs/v2-s4-ui-design.md` §4.7, §8, §11.3, §11.4

---

## 1. 概述

补齐 Phase 5.2 遗留的 3 个组件 wiring + Export 后端实现。
组件已存在，只需 wiring（导入+渲染+事件连接）。

---

## 2. 验收标准

### AC-10.1: Wire AgentStatusBar

- [ ] ChatPanel 中渲染 `<AgentStatusBar />` 替换 `<div id="agent-status-bar-slot" />`
- [ ] AgentStatusBar 从 `useAgentStore` 读取活跃 Agent 列表
- [ ] 点击 Agent 打开 AgentDrawer
- [ ] AgentDrawer 渲染后显示 Agent 工作日志（message list）

### AC-10.2: Wire QuickActions

- [ ] ChatPanel 中渲染 `<QuickActions />` 替换 `<div id="quick-actions-slot" />`
- [ ] QuickActions 的 `onSendMessage` 回调连接 `useChatStore.sendMessage()`
- [ ] 5 个快捷操作按钮点击发送对应消息

### AC-10.3: Wire FileUploadDialog

- [ ] ChatInput 的 📎 按钮点击打开 FileUploadDialog
- [ ] 替换当前空的 onClick handler
- [ ] FileUploadDialog 上传后将文件信息附加到消息
- [ ] （MVP：文件信息以文本形式发送，不需要真正的文件上传 API）

### AC-10.4: Export 后端

- [ ] `packages/core/src/services/export.service.ts` 存在
- [ ] `exportProject({ projectId, format, chapterRange? })`: 生成导出内容
  - format: `"txt" | "md"`（MVP 不需要 docx）
  - 合并所有章节（或指定范围）为单个文件
  - 包含标题、分隔线
- [ ] `POST /api/projects/:id/export` 端点
  - body: `{ format: "txt" | "md", startChapter?, endChapter? }`
  - 返回文件内容（Content-Type: text/plain 或 text/markdown）
  - 或返回 `{ content: string, filename: string }`

### AC-10.5: Export 前端对接

- [ ] ExportDialog 的 `handleExportClick` 调用真实 API
- [ ] 收到响应后触发浏览器下载（Blob + URL.createObjectURL）
- [ ] 替换当前 console.log placeholder
- [ ] ProjectCardMenu 的 export 选项也对接真实 API

---

## 3. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/web/src/components/chat/ChatPanel.tsx` | MODIFY | 渲染 AgentStatusBar + QuickActions |
| `packages/web/src/components/chat/ChatInput.tsx` | MODIFY | 📎 按钮接入 FileUploadDialog |
| `packages/core/src/services/export.service.ts` | NEW | 导出服务 |
| `packages/core/src/services/index.ts` | MODIFY | 添加 export |
| `packages/api-server/src/routes/export.ts` | NEW | Export API 路由 |
| `packages/api-server/src/app.ts` | MODIFY | 挂载 export 路由 |
| `packages/web/src/components/settings/ExportDialog.tsx` | MODIFY | 对接真实 API |
| `packages/web/src/components/project-list/ProjectCardMenu.tsx` | MODIFY | export 对接 API |

---

## 4. 测试要求

| 测试 | 类型 | 文件 |
|------|------|------|
| ChatPanel 渲染 AgentStatusBar | 组件 | 更新 `ChatPanel.test.tsx` |
| ChatPanel 渲染 QuickActions | 组件 | 同上 |
| ChatInput 📎 打开 FileUploadDialog | 组件 | 更新 `ChatInput.test.tsx` |
| ExportService 导出 txt | 单元 | `core/__tests__/services/export.service.test.ts` |
| ExportService 导出 md | 单元 | 同上 |
| Export API 端点 | 路由 | `api-server/__tests__/routes/export.test.ts` |
| ExportDialog 调 API + 下载 | 组件 | 更新 `ExportDialog.test.tsx` |
