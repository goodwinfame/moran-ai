import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../registry.js";
import type { AgentDefinition, AgentPermissions } from "../types.js";

describe("AgentRegistry", () => {
  const makePermissions = (): AgentPermissions => ({
    read: ["chapters", "characters"],
    write: ["chapters"],
    tools: ["context-assembler"],
  });

  const makeAgent = (id: string, overrides?: Partial<AgentDefinition>): AgentDefinition => ({
    id: id as AgentDefinition["id"],
    name: `Agent ${id}`,
    displayName: `测试·${id}`,
    role: "test role",
    model: "test-model",
    temperature: 0.5,
    category: "core",
    permissions: makePermissions(),
    systemPrompt: "Test prompt",
    ...overrides,
  });

  describe("register / get", () => {
    it("registers and retrieves an agent", () => {
      const registry = new AgentRegistry();
      const agent = makeAgent("moheng");
      registry.register(agent);

      expect(registry.get("moheng")).toEqual(agent);
    });

    it("returns undefined for unregistered agent", () => {
      const registry = new AgentRegistry();
      expect(registry.get("moheng")).toBeUndefined();
    });

    it("overwrites existing agent on re-register", () => {
      const registry = new AgentRegistry();
      const agent1 = makeAgent("moheng", { name: "V1" });
      const agent2 = makeAgent("moheng", { name: "V2" });

      registry.register(agent1);
      registry.register(agent2);

      expect(registry.get("moheng")?.name).toBe("V2");
    });
  });

  describe("has / list", () => {
    it("has() returns true for registered agents", () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("moheng"));

      expect(registry.has("moheng")).toBe(true);
      expect(registry.has("lingxi")).toBe(false);
    });

    it("list() returns all registered agents", () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("moheng"));
      registry.register(makeAgent("lingxi"));

      const agents = registry.list();
      expect(agents).toHaveLength(2);
      expect(agents.map((a) => a.id)).toContain("moheng");
      expect(agents.map((a) => a.id)).toContain("lingxi");
    });
  });

  describe("list with filter", () => {
    it("filters by model", () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("moheng", { model: "claude-sonnet" }));
      registry.register(makeAgent("lingxi", { model: "claude-opus" }));
      registry.register(makeAgent("zhibi", { model: "claude-opus" }));

      const results = registry.list({ model: "claude-opus" });
      expect(results).toHaveLength(2);
    });

    it("filters by category", () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("moheng", { category: "core" }));
      registry.register(makeAgent("lingxi", { category: "core" }));
      registry.register(makeAgent("zhibi", { category: "optional" }));

      const coreAgents = registry.list({ category: "core" });
      expect(coreAgents).toHaveLength(2);

      const optionalAgents = registry.list({ category: "optional" });
      expect(optionalAgents).toHaveLength(1);
      expect(optionalAgents[0]?.id).toBe("zhibi");
    });

    it("returns all agents with no filter", () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("moheng"));
      registry.register(makeAgent("lingxi"));

      expect(registry.list()).toHaveLength(2);
    });
  });

  describe("defaultRegistry", () => {
    it("has all 10 agents pre-registered", async () => {
      const { defaultRegistry } = await import("../registry.js");
      const agents = defaultRegistry.list();
      expect(agents.length).toBe(10);
    });

    it("includes moheng (orchestrator)", async () => {
      const { defaultRegistry } = await import("../registry.js");
      const moheng = defaultRegistry.get("moheng");
      expect(moheng).toBeDefined();
      expect(moheng?.name).toContain("墨衡");
    });

    it("includes all expected agent IDs", async () => {
      const { defaultRegistry } = await import("../registry.js");
      const expectedIds = [
        "moheng", "lingxi", "jiangxin", "zhibi", "mingjing",
        "zaishi", "bowen", "xidian", "shuchong", "dianjing",
      ];
      for (const id of expectedIds) {
        expect(defaultRegistry.has(id)).toBe(true);
      }
    });
  });
});
