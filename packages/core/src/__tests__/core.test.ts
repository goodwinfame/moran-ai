import { describe, it, expect } from "vitest";

describe("@moran/core", () => {
  it("schema barrel exports all tables", async () => {
    const schema = await import("../db/schema/index.js");
    // 验证核心表导出存在
    expect(schema.projects).toBeDefined();
    expect(schema.chapters).toBeDefined();
    expect(schema.characters).toBeDefined();
    expect(schema.memorySlices).toBeDefined();
    expect(schema.plotThreads).toBeDefined();
    expect(schema.outlines).toBeDefined();
    expect(schema.arcs).toBeDefined();
    expect(schema.worldSettings).toBeDefined();
    expect(schema.locations).toBeDefined();
    expect(schema.factions).toBeDefined();
    expect(schema.knowledgeEntries).toBeDefined();
    expect(schema.decisionLogs).toBeDefined();
  });

  it("schema enums export correctly", async () => {
    const schema = await import("../db/schema/index.js");
    expect(schema.projectStatusEnum).toBeDefined();
    expect(schema.chapterStatusEnum).toBeDefined();
    expect(schema.memoryCategoryEnum).toBeDefined();
    expect(schema.plotThreadStatusEnum).toBeDefined();
    expect(schema.memoryStabilityEnum).toBeDefined();
  });

  it("logger exports createLogger", async () => {
    const { createLogger } = await import("../logger/index.js");
    expect(createLogger).toBeDefined();
    const log = createLogger("test");
    expect(log).toBeDefined();
    expect(typeof log.info).toBe("function");
    expect(typeof log.error).toBe("function");
  });
});
