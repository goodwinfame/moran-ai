# infrastructure — SPEC

> **状态**：已完成
> **模块**：infrastructure
> **最后更新**：2026-04-19

## 1. 概述

基础设施模块定义 V2 monorepo 的构建系统、开发环境、Docker 配置和 CI/CD。
V2 在 V1 基础设施上演进，不需要重写构建系统，但需要清理和适配。

## 2. 功能需求

### 2.1 Monorepo 结构

- pnpm workspace 管理 4 个包：`core`, `server`, `web`, `agents`（`agents` 保留为静态资源包，V2 中不含代码）
- 依赖方向：`web` / `server` → `core`，禁止反向
- `core` 编译产物（`dist/`）通过 `exports` 字段暴露子路径

### 2.2 本地开发

- `docker-compose.dev.yml` 启动 PostgreSQL + OpenCode serve
- `pnpm dev:server` → Hono :3200
- `pnpm dev:web` → Next.js :3000
- 环境变量通过 `.env` / `.env.example` 管理
- 热重载：server 使用 bun --watch，web 使用 Next.js turbopack

### 2.3 构建

- `pnpm build` 编译所有包
- `pnpm typecheck` 全包类型检查，零错误
- core 使用 tsc -b 编译
- server 使用 tsc -b 编译
- web 使用 next build

### 2.4 测试

- 测试框架：vitest（需从 vitest.workspace.ts 迁移到 vitest.config.ts）
- `pnpm test` 运行全部测试
- server 路由测试：`createApp()` + `app.request()`，不启动 HTTP
- E2E：Playwright（packages/web）

### 2.5 Docker 生产

- `docker-compose.prod.yml` / `docker-compose.yml` 支持生产部署
- Next.js standalone output（Linux 环境）

### 2.6 代码质量

- ESLint（eslint.config.js）
- Prettier（.prettierrc）
- TypeScript strict mode

## 3. 验收标准

- [ ] `pnpm install` 成功（无错误）
- [ ] `pnpm typecheck` 全包通过（零错误）
- [ ] `pnpm test` 全部测试通过
- [ ] `pnpm build` 编译成功
- [ ] `docker compose -f docker-compose.dev.yml up -d` 启动 PostgreSQL + OpenCode
- [ ] `.env.example` 包含所有必需环境变量
- [ ] 依赖方向正确（core 不引用 web/server）

## 4. 依赖

- 无外部依赖（此模块是基础）
