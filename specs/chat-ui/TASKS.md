# chat-ui — TASKS

> **模块**：chat-ui

## 任务列表

### T1: 创建组件目录结构 + 主工作页路由
- **输出**：
  - `components/workspace/` 目录
  - `components/chat/` 目录
  - `components/settings/` 目录
  - `app/projects/[id]/page.tsx`（引用 WorkspacePage）
  - `stores/chat-store.ts` 骨架
- **验收**：路由 `/projects/test-id` 可访问，`pnpm typecheck` 通过

### T2: 实现 ResizableSplitter + WorkspacePage 分栏布局
- **输出**：
  - `components/workspace/WorkspacePage.tsx`
  - `components/workspace/ResizableSplitter.tsx`
  - `components/workspace/MobileTabBar.tsx`
- **规则**：
  - 4 档屏幕宽度默认比例
  - 拖拽范围限制（左 25%~70%）
  - 比例持久化 localStorage
  - 双击恢复默认
  - < 768px Tab 模式
- **验收**：分栏渲染正确，拖拽流畅，响应式切换

### T3: 实现 ChatPanel 容器 + ChatNavBar
- **输出**：
  - `components/chat/ChatPanel.tsx`
  - `components/chat/ChatNavBar.tsx`
- **导航栏**：← 返回 | 项目名(可编辑) | 阶段 | 进度 | 字数 | Token | ⚙
- **验收**：导航栏渲染正确，项目名内联编辑工作

### T4: 实现 MessageList + MessageBubble
- **输出**：
  - `components/chat/MessageList.tsx`
  - `components/chat/MessageBubble.tsx`
  - `components/chat/MarkdownRenderer.tsx`
- **规则**：
  - 5 种消息类型正确渲染
  - Markdown 富文本（安装 react-markdown + remark-gfm）
  - 流式打字机效果（streamingText + RAF 节流）
  - 自动滚到底部
- **验收**：所有消息类型渲染正确，流式效果平滑

### T5: 实现 ChatInput + CommandPalette
- **输出**：
  - `components/chat/ChatInput.tsx`
  - `components/chat/CommandPalette.tsx`
- **规则**：
  - 多行输入，Shift+Enter 换行，Enter 发送
  - 📎 附件按钮
  - `/` 触发命令面板（9 个命令）
  - 键盘导航：↑↓ 选中，Enter 插入
- **验收**：输入交互正确，命令面板触发+选择正常

### T6: 实现 QuestionPanel
- **输出**：`components/chat/QuestionPanel.tsx`
- **规则**：
  - 替换输入框区域
  - 卡片式选项 + "自由输入"
  - 键盘 1-9 快捷选择
  - 选择后恢复普通输入
- **验收**：选项交互正确，键盘快捷键工作

### T7: 实现 AgentStatusBar
- **输出**：`components/chat/AgentStatusBar.tsx`
- **规则**：
  - 输入框上方，无 Agent 时隐藏
  - 4 种颜色状态灯
  - 最多 2 行 + "+N" 折叠
  - 200ms 滑入动画
  - 点击打开 Agent 抽屉
- **验收**：状态展示正确，动画流畅

### T8: 实现 AgentDrawer
- **输出**：`components/chat/AgentDrawer.tsx`
- **规则**：
  - 320px 右侧滑入，z-50 overlay
  - 实时 Agent 会话流
  - 点击外部/Esc 关闭
  - 同时只开一个
- **验收**：抽屉交互正确

### T9: 实现 QuickActions 快捷栏
- **输出**：`components/chat/QuickActions.tsx`
- **规则**：5 个按钮（继续写作/送审校/查看进度/导出/暂停）
- **验收**：按钮正确渲染，前 3 个发送消息，导出打开对话框

### T10: 实现二级视图
- **输出**：
  - `components/settings/ProjectSettingsDrawer.tsx`（400px 右侧滑入）
  - `components/settings/ExportDialog.tsx`
  - `components/settings/TokenReportModal.tsx`
  - `components/chat/FileUploadDialog.tsx`
- **验收**：所有二级视图可打开/关闭

### T11: 实现 chat-store
- **输出**：`packages/web/src/stores/chat-store.ts`
  - 消息管理 + 流式状态
  - Question Mode 切换
  - SSE 事件 handler 集成
  - sendMessage → API 调用
- **验收**：store 单元测试通过

### T12: 验证全局构建
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ──→ T2 ──→ T12
T1 ──→ T3
T1 ──→ T4
T1 ──→ T5
T1 ──→ T6
T1 ──→ T7
T1 ──→ T8
T1 ──→ T9
T1 ──→ T10
T1 ──→ T11 (T4-T9 使用 store)
```

T1 创建结构。T2 分栏布局是核心骨架。T3-T10 可并行开发各子组件。T11 store 贯穿所有组件。T12 最终验证。

**跨模块依赖**：
- T2 的 InfoPanel 区域由 info-panel 模块填充（T2 只负责占位）
- T7/T8 的 Agent 数据来自 sse-realtime 模块的 agent-store
