import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Hono API 服务地址（服务端 rewrite 目标） */
const API_UPSTREAM = process.env.API_UPSTREAM ?? "http://localhost:3200";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone mode for Docker production builds
  // On Windows with pnpm, standalone output fails due to symlink permissions.
  // Docker builds (Linux) work fine. Local dev uses `next dev`.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {},

  // ── API 代理：浏览器同源访问 /api/*，Next.js 转发到 Hono ──
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_UPSTREAM}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
