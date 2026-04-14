/**
 * 测试数据工厂 — Projects
 */
export function createTestProject(overrides?: Record<string, unknown>) {
  return {
    title: "测试小说",
    genre: "仙侠",
    subGenre: "修仙",
    status: "active" as const,
    ...overrides,
  };
}
