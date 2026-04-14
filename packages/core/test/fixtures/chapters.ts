/**
 * 测试数据工厂 — Chapters
 */
export function createTestChapter(overrides?: Record<string, unknown>) {
  return {
    chapterNumber: 1,
    title: "第一章 初入江湖",
    content: "这是测试章节内容。",
    wordCount: 2000,
    status: "draft" as const,
    ...overrides,
  };
}
