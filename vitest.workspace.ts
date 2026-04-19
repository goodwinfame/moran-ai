import { defineWorkspace } from "vitest/config";
import path from "path";

export default defineWorkspace([
  // @moran/core — Unit tests (no DB)
  {
    test: {
      name: "core-unit",
      root: "./packages/core",
      include: ["src/**/__tests__/**/*.test.ts"],
      exclude: ["src/db/__tests__/**"],
      environment: "node",
      setupFiles: ["./test/setup.ts"],
    },
  },
  // @moran/core — Integration tests (with DB)
  {
    test: {
      name: "core-integration",
      root: "./packages/core",
      include: ["src/db/__tests__/**/*.test.ts"],
      environment: "node",
      setupFiles: ["./test/setup.ts"],
      pool: "forks",
      poolOptions: {
        forks: { singleFork: true },
      },
    },
  },
  // @moran/api-server — API integration tests
  {
    test: {
      name: "api-server-integration",
      root: "./packages/api-server",
      include: ["src/**/__tests__/**/*.test.ts"],
      environment: "node",
      setupFiles: ["./test/setup.ts"],
    },
  },
  // @moran/web — Component/hook unit tests (uses own vitest.config.ts)
  "packages/web/vitest.config.ts",
]);
