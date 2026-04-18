/**
 * 服务端 API 地址（仅 Server Component 使用）。
 *
 * Server Component 在 Node.js 进程内直接 fetch Hono，
 * 走的是服务端→服务端调用，不经过浏览器，无 CORS 限制。
 * 不要在 "use client" 文件中导入此模块。
 */
export const API_UPSTREAM =
  process.env.API_UPSTREAM ?? "http://localhost:3200";
