# project-list — TASKS

> **模块**：project-list

## 任务列表

### T1: 创建组件目录结构
- **输出**：
  - `packages/web/src/components/project-list/` 目录
  - `packages/web/src/components/shared/` 目录
  - `packages/web/src/stores/project-list-store.ts` 骨架
- **验收**：目录存在，`pnpm typecheck` 通过

### T2: 实现 ProjectListPage 主组件
- **输出**：`components/project-list/ProjectListPage.tsx`
  - 三段式布局：顶部 header + 中部卡片区 + 底部输入区
  - 从 store 读取项目列表
  - 排序：置顶优先 → 最后活跃倒序
- **验收**：页面渲染不报错，布局正确

### T3: 实现 ProjectCard 组件
- **输出**：`components/project-list/ProjectCard.tsx`
  - 展示 6 个字段（标题、题材、阶段、进度、字数、最后活跃）
  - 点击跳转 `/projects/:id`
  - 右键触发操作菜单
  - 置顶标记
- **验收**：卡片渲染正确，点击导航工作

### T4: 实现 ProjectCardMenu 操作菜单
- **输出**：`components/project-list/ProjectCardMenu.tsx`
  - 5 个操作：重命名、置顶、导出、归档、删除
  - 重命名 → InlineEditor
  - 归档 → ConfirmDialog
  - 删除 → 二次确认（输入项目名）
- **依赖**：`components/shared/ConfirmDialog.tsx`, `components/shared/InlineEditor.tsx`
- **验收**：所有操作可触发，确认对话框正常工作

### T5: 实现 EmptyState 空状态
- **输出**：`components/project-list/EmptyState.tsx`
  - 引导文案 + 可点击示例文字
  - 点击示例 → 填充到底部输入框
- **验收**：空状态渲染正确，点击示例填充输入框

### T6: 实现 InlineChatInput + InlineChatBubble
- **输出**：
  - `components/project-list/InlineChatInput.tsx`（输入框 + 发送按钮）
  - `components/project-list/InlineChatBubble.tsx`（气泡组件）
- **规则**：
  - 气泡在输入框上方向上生长
  - 最多 3 轮对话
  - 跳转后自动清除
- **验收**：发送消息后气泡出现，超过 3 轮自动裁剪

### T7: 实现 UserMenu 用户菜单
- **输出**：`components/project-list/UserMenu.tsx`
  - 头像 + 下拉菜单（个人设置、使用统计、退出登录）
- **验收**：菜单可展开，各项可点击

### T8: 实现 project-list-store
- **输出**：`packages/web/src/stores/project-list-store.ts`
  - fetchProjects / createProject / deleteProject / renameProject / pinProject / archiveProject
  - sendInlineMessage / clearInlineMessages
  - API 调用 → 更新 store 状态
- **验收**：store 单元测试通过（mock API）

### T9: 页面路由配置
- **输出**：
  - `app/page.tsx` 引用 ProjectListPage
  - `/projects` → `/` 重定向（Next.js config 或 middleware）
- **验收**：`/` 和 `/projects` 均可访问项目列表页

### T10: 响应式适配
- **输入**：T2-T7 的组件
- **输出**：卡片网格响应式（lg 3列 / md 2列 / sm 1列）
- **验收**：不同屏幕宽度下布局正确

### T11: 验证全局构建
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ──→ T2 ──→ T10 → T11
T1 ──→ T3 ──→ T10
T1 ──→ T4
T1 ──→ T5
T1 ──→ T6
T1 ──→ T7
T1 ──→ T8 ──→ T6 (store 驱动)
T9 ────────→ T11
```

T1 创建结构。T2-T8 可大致并行（T8 是 store，被 T2/T6 使用）。T9 路由配置。T10 响应式。T11 最终验证。
