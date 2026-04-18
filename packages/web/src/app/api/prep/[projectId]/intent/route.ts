/**
 * intent 路由已迁移到 Hono 后端
 * GET/POST /api/projects/:id/intent → http://localhost:3200/api/projects/:id/intent
 *
 * 此文件保留仅作说明，不再包含业务逻辑。
 * 前端直接通过 packages/web/src/lib/api.ts (baseUrl=3200) 调用。
 */
export const runtime = "edge"; // 防止意外执行
export async function POST() {
  return new Response("Moved to Hono backend at :3200", { status: 410 });
}