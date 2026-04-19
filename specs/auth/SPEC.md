# auth — SPEC

> **状态**：已完成
> **模块**：auth
> **最后更新**：2026-04-19
> **基准文档**：`docs/v2-s11-technical-architecture.md` §7

## 1. 概述

用户认证与授权系统。支持邮箱密码注册/登录、Session Cookie 会话管理、页面保护与 API 保护。
V2 不实现 OAuth，不实现多因素认证。

## 2. 功能需求

### 2.1 注册

- 邮箱 + 密码注册
- 邮箱唯一性校验（大小写不敏感，存储时统一小写）
- 密码使用 bcrypt 哈希（12 rounds）
- 可选 `displayName`（昵称）
- 注册成功后自动登录（创建 Session，设置 Cookie）

### 2.2 登录

- 邮箱 + 密码验证
- 登录成功创建 Session，设置 HTTP-only Cookie
- 错误返回统一 "邮箱或密码错误"（不泄露邮箱是否存在）

### 2.3 登出

- 删除服务端 Session 记录
- 清除客户端 Cookie

### 2.4 会话管理

- Session 存储在 PostgreSQL `sessions` 表
- Session TTL = 30 天
- Cookie 配置：`httpOnly: true`、`secure: production`、`sameSite: Lax`、`path: /`
- 过期 Session 自动失效（查询时检查 `expiresAt`）

### 2.5 页面保护（Next.js Middleware）

- 未登录用户访问非公开页面 → 302 重定向到 `/login`
- 公开路由白名单：`/login`、`/register`
- Next.js 中间件仅检查 Cookie 是否存在，**不做 DB 查询**
- 将 `session_id` 通过请求头 `x-session-id` 传递给 API Server

### 2.6 API 保护（Hono Middleware）

- 所有 `/api/*` 路由（Auth 路由除外）需要有效 Session
- 从 Cookie 提取 `session_id` → 查询 DB 校验 → 注入 `userId` 到请求上下文
- 无效/过期 Session → 返回 401

### 2.7 项目权限

- `projects` 表通过 `userId` 外键关联用户
- 所有项目查询/操作自动带 `WHERE userId = ?` 过滤
- 用户无法访问他人的项目

### 2.8 Auth API 端点

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 无需 |
| POST | `/api/auth/login` | 登录 | 无需 |
| POST | `/api/auth/logout` | 登出 | 需要 |

### 2.9 MCP 内用户身份（决策 D11）

- MCP Server 不接收 `userId` 参数
- 用户身份通过 `projectId` 隐式绑定（每个 OpenCode Session 绑定 `(userId, projectId)` 对）
- Agent 无法跨项目操作

### 2.10 前端页面

- `/login` — 登录页（邮箱 + 密码表单）
- `/register` — 注册页（邮箱 + 密码 + 昵称表单）
- 两个页面样式一致，表单校验（邮箱格式、密码最小长度）

## 3. 不实现（MVP 边界）

- OAuth / 第三方登录
- 多因素认证（MFA）
- 密码重置 / 邮箱验证
- Session 续期（到期需重新登录）
- 登录频率限制（Rate Limiting）
- CSRF Token（SameSite=Lax 已提供基本保护）

## 4. DB Schema

### users 表

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | uuid | PK, default random |
| `email` | varchar(255) | NOT NULL, UNIQUE |
| `password_hash` | varchar(255) | NOT NULL |
| `display_name` | varchar(100) | nullable |
| `created_at` | timestamp | NOT NULL, default now |
| `updated_at` | timestamp | NOT NULL, default now |

### sessions 表

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL, FK → users.id (CASCADE) |
| `expires_at` | timestamp | NOT NULL |
| `created_at` | timestamp | NOT NULL, default now |

## 5. 验收标准

- [ ] 注册成功：邮箱+密码 → 创建用户 + Session + 设置 Cookie → 返回 userId
- [ ] 注册失败：重复邮箱 → 返回 `EMAIL_EXISTS` 错误
- [ ] 登录成功：正确邮箱+密码 → 创建 Session + 设置 Cookie → 返回 userId
- [ ] 登录失败：错误密码 → 返回 `INVALID_CREDENTIALS`（不区分邮箱/密码哪个错）
- [ ] 登出：删除服务端 Session + 清除 Cookie
- [ ] 页面保护：未登录访问 `/` → 302 到 `/login`
- [ ] 页面保护：已登录访问 `/login` → 可正常访问（不强制跳转）
- [ ] API 保护：无 Cookie 调用 `/api/projects` → 401
- [ ] API 保护：过期 Session 调用 API → 401
- [ ] 项目隔离：用户 A 无法通过 API 访问用户 B 的项目
- [ ] Cookie 属性：httpOnly=true, secure=production, sameSite=Lax
- [ ] 密码存储：bcrypt, 12 rounds（不存储明文）
- [ ] 邮箱大小写不敏感：`Test@Example.com` 和 `test@example.com` 视为同一邮箱
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（auth 相关测试全部覆盖）

## 6. 依赖

- 依赖 `infrastructure` 模块（DB 连接、Drizzle 配置）
- 被 `api-routes` 模块消费（Auth 中间件 + Auth 路由）
- 被 `chat-ui` / `info-panel` 前端模块间接依赖（页面保护）
- 新增依赖：`bcryptjs`（安装到 `packages/core`）
