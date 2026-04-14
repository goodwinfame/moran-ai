/**
 * 数据库客户端初始化 — 惰性连接
 *
 * 只在首次访问 db 时才建立连接。
 * 这允许 server 在没有 DATABASE_URL 时使用内存存储启动（开发/演示模式）。
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * 获取数据库实例。首次调用时建立连接。
 * 如果 DATABASE_URL 未设置，抛出明确错误。
 */
export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required. " +
        "Start PostgreSQL via: docker compose -f docker-compose.dev.yml up -d",
      );
    }
    const client = postgres(connectionString);
    _db = drizzle(client, { schema });
  }
  return _db;
}

/**
 * 检查数据库是否可用（DATABASE_URL 已配置）
 */
export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/** @deprecated 使用 getDb() 代替。保留兼容，访问时触发惰性初始化。 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = ReturnType<typeof getDb>;
