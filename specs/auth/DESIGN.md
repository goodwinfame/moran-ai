# auth — DESIGN

> **状态**：已完成
> **模块**：auth
> **基准文档**：`docs/v2-s11-technical-architecture.md` §7

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| `users` 表 | ❌ 不存在 | 全新创建 |
| `sessions` 表 | ❌ 不存在 | 全新创建 |
| Auth Service | ❌ 不存在 | 全新创建 |
| Auth 路由 | ❌ 不存在 | 全新创建 |
| Hono Auth 中间件 | ❌ 不存在 | 全新创建（替代 `userIdMiddleware`） |
| Next.js Middleware | ❌ 不存在 | 全新创建 |
| 登录/注册页面 | ❌ 不存在 | 全新创建 |

## 2. 技术方案

### 2.1 DB Schema

```typescript
// packages/core/src/db/schema/auth.ts
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

在 `schema/index.ts` 中导出，确保 Drizzle 迁移能识别。

### 2.2 Auth Service

```typescript
// packages/core/src/services/auth.service.ts
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users, sessions } from "../db/schema/auth.js";
import { eq, and, gt } from "drizzle-orm";
import type { ServiceResult } from "./types.js";

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export const authService = {
  async register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<ServiceResult<{ userId: string }>> {
    const normalizedEmail = input.email.toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existing) {
      return { ok: false, error: { code: "EMAIL_EXISTS", message: "邮箱已注册" } };
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const [user] = await db.insert(users).values({
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName,
    }).returning();

    return { ok: true, data: { userId: user.id } };
  },

  async login(input: {
    email: string;
    password: string;
  }): Promise<ServiceResult<{ userId: string }>> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    });
    if (!user) {
      return { ok: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } };
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return { ok: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } };
    }

    return { ok: true, data: { userId: user.id } };
  },

  async createSession(userId: string) {
    const [session] = await db.insert(sessions).values({
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    }).returning();
    return session;
  },

  async validateSession(sessionId: string): Promise<ServiceResult<{ userId: string }>> {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())),
    });
    if (!session) {
      return { ok: false, error: { code: "SESSION_EXPIRED", message: "Session 已过期" } };
    }
    return { ok: true, data: { userId: session.userId } };
  },

  async deleteSession(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },
};
```

### 2.3 Auth 路由

```typescript
// packages/api-server/src/routes/auth.ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authService } from "@moran/core/services";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const auth = new Hono();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 天
};

// POST /api/auth/register
auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.register(body);
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400);

  const session = await authService.createSession(result.data.userId);
  setCookie(c, "session_id", session.id, COOKIE_OPTIONS);
  return c.json({ ok: true, data: { userId: result.data.userId } }, 201);
});

// POST /api/auth/login
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.login(body);
  if (!result.ok) return c.json({ ok: false, error: result.error }, 401);

  const session = await authService.createSession(result.data.userId);
  setCookie(c, "session_id", session.id, COOKIE_OPTIONS);
  return c.json({ ok: true, data: { userId: result.data.userId } });
});

// POST /api/auth/logout
auth.post("/logout", async (c) => {
  const sessionId = c.req.cookie("session_id");
  if (sessionId) await authService.deleteSession(sessionId);
  setCookie(c, "session_id", "", { maxAge: 0 });
  return c.json({ ok: true });
});

export { auth as authRoutes };
```

### 2.4 Hono Auth 中间件

替代原有的 `userIdMiddleware`（header 解析），改为 Cookie + DB Session 校验：

```typescript
// packages/api-server/src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { authService } from "@moran/core/services";

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing session" } }, 401);

  const result = await authService.validateSession(sessionId);
  if (!result.ok) return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Session expired" } }, 401);

  c.set("userId", result.data.userId);
  await next();
});
```

路由挂载时区分需认证和不需认证的路由：

```typescript
// packages/api-server/src/app.ts
import { authRoutes } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";

// Auth 路由 — 不需要认证
app.route("/api/auth", authRoutes);

// 以下路由需要认证
app.use("/api/*", requireAuth);
app.route("/api/chat", createChatRoutes());
app.route("/api/projects", createProjectRoutes());
app.route("/api/user", createUserRoutes());
```

> **注意**：路由注册顺序很重要。`/api/auth` 必须在 `requireAuth` 中间件之前注册。

### 2.5 Next.js Middleware

```typescript
// packages/web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  const { pathname } = request.nextUrl;

  // 公开路由放行
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 无 Cookie → 重定向到登录页
  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cookie 存在 → 放行（API 层做 DB 校验）
  const response = NextResponse.next();
  response.headers.set("x-session-id", sessionId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
```

> Next.js Middleware 不查 DB（Edge Runtime 限制 + 性能考虑）。仅检查 Cookie 是否存在。真正的 Session 校验由 Hono 中间件完成。

### 2.6 前端登录/注册页

两个页面结构相同（表单 + 提交按钮 + 切换链接），使用 Server Action 或客户端 fetch：

```typescript
// packages/web/src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error.message);
      return;
    }
    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required minLength={8} />
      {error && <p className="text-destructive">{error}</p>}
      <button type="submit">登录</button>
      <a href="/register">没有账号？注册</a>
    </form>
  );
}
```

注册页类似，多一个 `displayName` 字段，提交到 `/api/auth/register`。

### 2.7 `userIdMiddleware` 迁移

原 `api-routes` DESIGN 中的 `userIdMiddleware`（从 header 提取 userId）将被 `requireAuth` 替代：

- 删除 `packages/api-server/src/middleware/user-id.ts`
- 改用 `packages/api-server/src/middleware/auth.ts`
- 所有路由中 `c.get("userId")` 调用方式不变（`requireAuth` 也注入 `userId`）

### 2.8 新增依赖

| 包 | 用途 | 安装位置 |
|----|------|---------|
| `bcryptjs` | 密码哈希 | core |
| `@types/bcryptjs` | 类型定义 | core (devDeps) |

## 3. 不需要改动的部分

- Docker 配置
- OpenCode 配置
- MCP Server（不涉及认证）
- 已有 DB Schema（`projects` 表添加 `userId` 字段在 database 模块处理）

## 4. 风险与注意事项

- **bcrypt 性能**：12 rounds 每次哈希约 200-300ms，注册/登录时可接受
- **Session 查询开销**：每个 API 请求查一次 DB。如性能瓶颈，后续可加内存缓存
- **Cookie 安全**：开发环境 `secure: false`，生产环境必须 `secure: true`（HTTPS）
- **Session 清理**：过期 Session 不主动删除（查询时忽略），可后续加定时清理任务
- **projects.userId**：需在 `projects` 表新增 `userId` 外键列（database 模块的迁移任务）
