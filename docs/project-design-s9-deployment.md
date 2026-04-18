# 新项目设计文档 · §9 部署方案与 CI/CD

本章节详细说明 墨染 (MoRan) AI 小说创作平台的部署架构、持续集成与持续部署 (CI/CD) 流程、环境管理以及数据库迁移策略。

## §9.1 部署架构总览

墨染采用基于 Docker Compose 的三服务架构，确保开发环境与生产环境的一致性，并提供高度可移植的运行环境。

```mermaid
graph TD
    subgraph "Docker 网络 (moran-network)"
        Web["moran-web (Next.js)"]
        Server["moran-server (Hono/Bun)"]
        DB[("PostgreSQL 17")]
        
        Web -->|HTTP| Server
        Server -->|TCP:5432| DB
    end

    User((用户/浏览器)) -->|Port 3000| Web
    Dev((开发者/API)) -->|Port 3200| Server
    SDK((OpenCode SDK)) -.->|Port 3100| Server

    subgraph "数据卷 (Volumes)"
        PGData[("pgdata")]
        DB --- PGData
    end
```

### 端口映射与服务说明
- **postgres**: 内部 5432 端口，外部映射 5432（可选）。负责所有结构化数据存储。
- **moran-server**: 内部 3200 端口，外部映射 3200。内部包含 OpenCode SDK 运行所需的 3100 端口（非公开映射）。负责核心业务逻辑与 Agent 调度。
- **moran-web**: 内部 3000 端口，外部映射 3000。负责前端交互界面。

---

## §9.2 Docker 配置

### Docker Compose (docker-compose.yml)

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: moran
      POSTGRES_USER: moran
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U moran"]
      interval: 5s
      timeout: 5s
      retries: 5

  moran-server:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://moran:${POSTGRES_PASSWORD}@postgres:5432/moran
      OPENCODE_PORT: 3100
      # LLM API keys
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_AI_API_KEY: ${GOOGLE_AI_API_KEY}
    ports:
      - "3200:3200"

  moran-web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    depends_on:
      - moran-server
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3200  # NEXT_PUBLIC_ 变量在浏览器端运行，必须用宿主机地址
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

### 服务端 Dockerfile (packages/server/Dockerfile)

使用 Bun 官方镜像，利用其高性能运行时特性。

```dockerfile
# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/agents/ packages/agents/
RUN bun install --frozen-lockfile
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
RUN bun run build --filter=@moran/server

# Stage 2: Production
FROM oven/bun:1-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/agents ./agents
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3200 3100
CMD ["bun", "run", "dist/index.js"]
```

### 前端 Dockerfile (packages/web/Dockerfile)

采用 Next.js 的 standalone 模式，显著减小镜像体积。

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json packages/web/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/web/ packages/web/
RUN pnpm --filter @moran/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./.next/static
COPY --from=builder /app/packages/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## §9.3 CI/CD 流水线 (GitHub Actions)

项目流水线被设计为五条独立管线：三条测试流水线（按速度和依赖分层）、一条镜像发布、一条数据库迁移。

```mermaid
graph TD
    Push((代码推送)) --> Unit[ci-unit: 单元测试]
    Push --> Integration[ci-integration: 集成测试]
    Unit -->|通过| Docker[CD: 镜像构建与发布]
    Integration -->|通过| Docker
    Merge((合入 main)) --> E2E[ci-e2e: E2E 测试]
    Docker -->|通过| DB[DB: 数据库迁移]
    DB --> Deploy((生产部署))
```

### 1. 单元测试流水线 (ci-unit.yml)

**触发条件**：每次 push / PR。无外部依赖，纯计算，快速反馈（< 2 分钟）。

```yaml
name: CI - Unit Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test              # 仅单元测试（无 DB）
      - run: pnpm run test:coverage
      - name: Check coverage thresholds
        run: |
          # core ≥ 80%, server ≥ 70%, web ≥ 60%
          pnpm --filter @moran/core test -- --coverage --reporter=json
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

### 2. 集成测试流水线 (ci-integration.yml)

**触发条件**：每次 push / PR。需要 PostgreSQL service container，运行 DB 集成测试 + API 集成测试。

```yaml
name: CI - Integration Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: moran_test
          POSTGRES_USER: moran
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Run DB migrations
        run: pnpm --filter @moran/core db:migrate
        env:
          DATABASE_URL: postgresql://moran:test_password@localhost:5432/moran_test
      - name: Run integration tests
        run: pnpm run test:integration
        env:
          DATABASE_URL: postgresql://moran:test_password@localhost:5432/moran_test
      - run: pnpm run build
```

### 3. E2E 测试流水线 (ci-e2e.yml)

**触发条件**：仅 main 分支合入时触发。Docker Compose 启动全栈环境，Playwright 运行 E2E 测试。

```yaml
name: CI - E2E Tests
on:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Start services
        run: docker compose -f docker-compose.test.yml up -d --wait
      - name: Install Playwright browsers
        run: pnpm --filter @moran/web exec playwright install --with-deps chromium
      - name: Run E2E tests
        run: pnpm run test:e2e
        env:
          DATABASE_URL: postgresql://moran:test_password@localhost:5432/moran_test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/web/playwright-report/
      - name: Stop services
        if: always()
        run: docker compose -f docker-compose.test.yml down -v
```

### 4. 镜像发布流水线 (docker-publish.yml)

在代码合并入 `main` 或发布版本标签时，构建镜像并推送到 GitHub Container Registry (GHCR)。

```yaml
name: Publish Docker Images
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  push_to_registry:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Server
        uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/server/Dockerfile
          push: true
          tags: |
            ghcr.io/goodwinfame/moran-server:latest
            ghcr.io/goodwinfame/moran-server:${{ github.sha }}

      - name: Build and push Web
        uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/web/Dockerfile
          push: true
          tags: |
            ghcr.io/goodwinfame/moran-web:latest
            ghcr.io/goodwinfame/moran-web:${{ github.sha }}
```

### 5. 数据库迁移流水线 (db-migrate.yml)

当 `packages/core/src/db/migrations/**` 目录中的迁移文件发生变化时触发。

```yaml
name: Database Migration
on:
  push:
    paths:
      - 'packages/core/src/db/migrations/**'
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm dlx drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

---

## §9.4 环境配置管理

### .env.example 模板

所有敏感信息和环境特有配置均应通过环境变量管理。

```
# Database
POSTGRES_PASSWORD=changeme
DATABASE_URL=postgresql://moran:changeme@localhost:5432/moran

# LLM Providers (需至少配置一个)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# OpenCode
OPENCODE_PORT=3100

# Web
NEXT_PUBLIC_API_URL=http://localhost:3200
```

### 环境管理策略
- **开发环境**: 使用本地 `.env` 文件（已加入 `.gitignore`），配合 Docker Compose 的 `env_file` 功能。
- **生产环境**: 推荐使用 Docker Secrets 或云平台原生环境变量管理服务（如 GitHub Secrets）。
- **CI/CD**: 通过 GitHub Actions Secrets 将变量注入流水线执行环境。
- **严禁**: 禁止将任何真实的 API 密钥或密码提交至 Git 仓库。

---

## §9.5 数据库迁移策略

墨染使用 Drizzle ORM 和 Drizzle Kit 进行全周期的 schema 管理。

### 迁移流程
1. **开发者修改 schema**: 在 `packages/core/src/db/schema/` 目录下按域拆分定义模型（如 `projects.ts`, `chapters.ts` 等）。
2. **生成迁移脚本**: 运行 `drizzle-kit generate` 生成带版本号的 SQL 文件。
3. **代码评审**: 迁移文件作为代码的一部分提交，供团队审查 SQL 的正确性。
4. **自动执行**: CI 流程在代码合并后执行 `drizzle-kit migrate`，将变更应用至生产数据库。

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant Git as Git 仓库
    participant CI as CI 流水线
    participant DB as 数据库
    
    Dev->>Dev: 修改 Schema 定义
    Dev->>Dev: drizzle-kit generate
    Dev->>Git: 提交 SQL 迁移文件
    Git->>CI: 触发部署
    CI->>DB: drizzle-kit migrate (运行 SQL)
    DB-->>CI: 迁移成功
    CI->>Git: 状态反馈
```

### 种子数据 (Seeding)
系统启动后将自动检测并填充必要的初始数据：
- **文风配置**: 云墨 (YunMo)、剑心 (JianXin)、星河 (XingHe) 等预置样式。
- **默认知识库**: 常用文学常识、世界观模版基础数据。
- **管理员账户**: 平台模式下的首个超级管理员。

---

## §9.6 监控与运维

### 监控指标
- **PostgreSQL**: 通过 `pg_stat_statements` 监控查询性能，识别慢查询。
- **Docker**: 配置 `restart: unless-stopped` 重启策略，提高服务可用性。
- **健康检查**: 
    - `moran-server` 提供 `/health` 端点。
    - `postgres` 使用 `pg_isready` 工具。

### 日志管理
- 容器日志采用结构化 JSON 格式。
- 使用 Docker 默认日志驱动，支持对接外部日志系统（如 Loki 或 ELK）。

### 备份机制
- **定时备份**: 设置 cron 任务运行 `pg_dump`，每日备份至持久化存储。
- **快照**: 对 Docker Volume 执行文件级快照（取决于具体部署环境）。

---

## §9.7 快速启动指南

对于新用户或需要在新服务器部署的情况，请遵循以下步骤：

```bash
# 1. 克隆仓库
git clone https://github.com/goodwinfame/moran-ai.git
cd moran-ai

# 2. 环境配置
cp .env.example .env
# 编辑 .env：设置 POSTGRES_PASSWORD 并填入至少一个 LLM API 密钥

# 3. 启动服务
docker compose up -d

# 4. 验证部署
# 等待容器状态变为 Healthy...
# 访问前端界面
open http://localhost:3000
```
