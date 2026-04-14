import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone mode for Docker production builds
  // On Windows with pnpm, standalone output fails due to symlink permissions.
  // Docker builds (Linux) work fine. Local dev uses `next dev`.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {},
};

export default nextConfig;
