/**
 * 测试辅助函数
 */
import { db } from "../src/db/index.js";

/**
 * 在事务中运行测试，测试结束后自动回滚。
 * 确保测试之间数据隔离。
 */
export async function withTestTransaction<T>(
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  // TODO: Implement transaction-based test isolation
  // For now, pass db directly — will be replaced with
  // proper transaction rollback once schema is in place
  return fn(db);
}
