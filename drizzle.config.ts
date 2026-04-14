import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/core/src/db/schema/index.ts",
  out: "./packages/core/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
