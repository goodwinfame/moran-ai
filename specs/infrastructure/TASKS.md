# infrastructure — TASKS

> **模块**：infrastructure

## 任务列表

### T1: 迁移 vitest workspace 配置
- **输入**：`vitest.workspace.ts`（deprecated）
- **输出**：根目录 `vitest.config.ts`，使用 `test.projects`
- **验收**：`pnpm test` 通过，无 deprecated 警告

### T2: 更新 .env.example
- **输入**：当前 `.env.example`
- **输出**：包含所有 V2 必需环境变量
- **验收**：新开发者按 .env.example 配置后，系统可正常启动

### T3: 验证构建流水线
- **输入**：V2 清理后的代码库
- **输出**：`pnpm typecheck` + `pnpm test` + `pnpm build` 全部通过
- **验收**：CI 绿灯（或本地全部通过）

## 依赖关系

```
T1 → T3
T2 → T3
```

T1 和 T2 可并行，T3 是最终验证。
