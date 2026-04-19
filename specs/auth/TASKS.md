# auth — TASKS

> **模块**：auth

## 任务列表

### T1: 创建 Auth DB Schema
- **输出**：`packages/core/src/db/schema/auth.ts`
  - `users` 表（id, email, passwordHash, displayName, createdAt, updatedAt）
  - `sessions` 表（id, userId, expiresAt, createdAt）
  - 在 `schema/index.ts` 中导出
- **验收**：`pnpm typecheck` 通过，Drizzle 迁移生成无错

### T2: 安装 bcryptjs 依赖
- **输入**：`packages/core/package.json`
- **输出**：`bcryptjs` + `@types/bcryptjs` 已安装
- **验收**：`import bcrypt from "bcryptjs"` 不报错

### T3: 实现 Auth Service
- **输入**：T1（Schema）+ T2（bcryptjs）
- **输出**：`packages/core/src/services/auth.service.ts`
  - `register()`：邮箱唯一性检查 + bcrypt 哈希 + 插入用户
  - `login()`：邮箱查找 + bcrypt 比对
  - `createSession()`：创建 Session 记录
  - `validateSession()`：校验 Session 未过期
  - `deleteSession()`：删除 Session 记录
  - 在 `services/index.ts` 中导出
- **验收**：
  - 单元测试覆盖：注册成功/重复邮箱、登录成功/错误密码、Session 校验/过期
  - 邮箱大小写不敏感测试

### T4: 实现 Auth 路由
- **输入**：T3（Auth Service）
- **输出**：`packages/api-server/src/routes/auth.ts`
  - `POST /api/auth/register`（Zod 校验 + 注册 + 自动登录）
  - `POST /api/auth/login`（Zod 校验 + 登录 + Cookie 设置）
  - `POST /api/auth/logout`（Session 删除 + Cookie 清除）
- **验收**：
  - 路由测试（`createApp()` + `app.request()`）
  - 每端点至少 1 成功 + 1 失败用例
  - Cookie 属性验证（httpOnly, sameSite, path）

### T5: 实现 Hono Auth 中间件
- **输入**：T3（Auth Service）
- **输出**：`packages/api-server/src/middleware/auth.ts`
  - `requireAuth` 中间件：Cookie 提取 → Session 校验 → userId 注入
  - 删除旧 `middleware/user-id.ts`（如存在）
- **验收**：
  - 中间件测试：无 Cookie → 401, 过期 Session → 401, 有效 Session → 放行
  - `c.get("userId")` 返回正确 userId

### T6: 更新 app.ts 路由挂载
- **输入**：T4 + T5
- **输出**：`packages/api-server/src/app.ts` 更新
  - 注册 Auth 路由（`/api/auth`，无需认证）
  - 注册 `requireAuth` 中间件（对 `/api/*` 生效）
  - 确保路由注册顺序正确（auth 在 requireAuth 之前）
- **验收**：`pnpm typecheck` 通过

### T7: 实现 Next.js Middleware
- **输出**：`packages/web/src/middleware.ts`
  - 公开路由白名单放行
  - 无 Cookie → 302 重定向 `/login`
  - Cookie 存在 → 放行 + 注入 `x-session-id` header
- **验收**：
  - 单元测试覆盖三种场景
  - `config.matcher` 正确排除静态资源

### T8: 实现登录/注册页面
- **输出**：
  - `packages/web/src/app/login/page.tsx`（登录表单）
  - `packages/web/src/app/register/page.tsx`（注册表单）
  - 表单校验（邮箱格式、密码最小 8 位）
  - 错误提示显示
  - 成功后跳转到 `/`
- **验收**：
  - 页面渲染无报错
  - 表单提交正确调用 API
  - 错误信息正确显示

### T9: 更新 projects 表添加 userId 外键
- **输出**：`packages/core/src/db/schema/projects.ts` 更新
  - 新增 `userId` 列（uuid, FK → users.id）
  - Drizzle 迁移脚本
- **验收**：迁移执行成功，现有项目查询不报错

### T10: 验证全局构建
- **输入**：T1-T9 完成
- **输出**：`pnpm typecheck` + `pnpm test` 全部通过
- **验收**：零错误

## 依赖关系

```
T1 ─┬→ T3 ─┬→ T4 ─┬→ T6 ──→ T10
T2 ─┘       │      │
            └→ T5 ─┘
T7 ───────────────────→ T10
T8 ───────────────────→ T10
T9 ───────────────────→ T10
```

T1+T2 是基础设施。T3 是核心 Service。T4+T5+T6 形成后端链路。T7、T8、T9 相互独立可并行。T10 最终验证。

**跨模块依赖**：
- T4 的 Zod 依赖已在 `api-routes` T2 安装
- T6 与 `api-routes` T1/T10 的 app.ts 挂载有交集，需协调
- T9 影响 database 模块的迁移
