# infrastructure — DESIGN

> **状态**：已完成
> **模块**：infrastructure

## 1. 当前状态

V1 基础设施已经就绪，V2 沿用以下组件：

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| pnpm workspace | ✅ 可用 | 无需改动 |
| tsconfig.json | ✅ 可用 | 无需改动 |
| eslint.config.js | ✅ 可用 | 无需改动 |
| .prettierrc | ✅ 可用 | 无需改动 |
| docker-compose.dev.yml | ✅ 可用 | 已修复 |
| vitest.workspace.ts | ⚠️ deprecated 警告 | 需迁移到 root config `test.projects` |
| packages/agents/ | ⚠️ 空壳 | V2 不含代码，仅保留 package.json |

## 2. 需要修复的问题

### 2.1 vitest workspace 废弃警告

当前使用 `vitest.workspace.ts`，vitest v3.2 已标记为 deprecated。
需迁移到根 `vitest.config.ts` 的 `test.projects` 字段。

### 2.2 api-server package.json 中的 agents 依赖

已在本次清理中移除 `@moran/agents` 和 `epub-gen-memory`。

### 2.3 web package.json 中的重复依赖

已修复 `@opencode-ai/sdk` 重复条目。

## 3. 技术方案

### 3.1 vitest 迁移

```typescript
// vitest.config.ts (新)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core-unit',
          root: './packages/core',
          include: ['src/**/__tests__/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api-server-unit',
          root: './packages/api-server',
          include: ['src/**/__tests__/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web-unit',
          root: './packages/web',
          include: ['src/**/__tests__/**/*.test.ts'],
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
  },
})
```

### 3.2 .env.example 更新

确保包含 V2 所有必需变量：
```
# === 数据库 ===
DATABASE_URL=postgresql://moran:moran@localhost:5432/moran
POSTGRES_PASSWORD=moran

# === 服务端口 ===
PORT=3200
WEB_PORT=3000

# === OpenCode ===
OPENCODE_BASE_URL=http://127.0.0.1:4096

# === Next.js → Hono 代理 ===
API_UPSTREAM=http://localhost:3200

# === LLM API Keys（至少配一个） ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## 4. 不需要改动的部分

- Docker Compose 配置（已在之前修复）
- pnpm workspace 配置
- TypeScript 配置
- ESLint / Prettier 配置
- Git 配置
