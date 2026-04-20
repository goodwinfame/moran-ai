/**
 * SSE Streaming Proxy — Route Handler
 *
 * Next.js rewrite proxy buffers SSE responses, preventing events from
 * reaching the browser. This Route Handler properly streams SSE by
 * piping the upstream Hono response body through as a ReadableStream.
 *
 * Route Handlers in the App Router filesystem take precedence over
 * rewrites, so this intercepts `/api/chat/events` before the generic
 * `/api/:path*` rewrite kicks in.
 */
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_UPSTREAM = process.env.API_UPSTREAM ?? "http://localhost:3200";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "BAD_REQUEST", message: "Missing sessionId" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Build upstream URL with all query params ──────────────────────────
  const params = new URLSearchParams();
  params.set("sessionId", sessionId);

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (projectId) params.set("projectId", projectId);

  const lastEventId =
    request.nextUrl.searchParams.get("lastEventId") ??
    request.headers.get("Last-Event-Id");
  if (lastEventId) params.set("lastEventId", lastEventId);

  const upstreamUrl = `${API_UPSTREAM}/api/chat/events?${params.toString()}`;

  // ── Forward auth cookie to Hono ───────────────────────────────────────
  const cookie = request.headers.get("cookie") ?? "";

  const headers: Record<string, string> = {
    Cookie: cookie,
    Accept: "text/event-stream",
  };
  if (lastEventId) {
    headers["Last-Event-Id"] = lastEventId;
  }

  const upstreamRes = await fetch(upstreamUrl, { headers });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const text = await upstreamRes.text().catch(() => "upstream error");
    return new Response(text, {
      status: upstreamRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Stream through — no buffering ─────────────────────────────────────
  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
