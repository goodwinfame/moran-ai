/**
 * 测试数据工厂 — Characters
 */
export function createTestCharacter(overrides?: Record<string, unknown>) {
  return {
    name: "林晓",
    role: "protagonist",
    personality: "坚韧、正直，但有些固执",
    ...overrides,
  };
}
