import { describe, expect, it } from "vitest";
import { SessionProjectBridge } from "../bridge.js";

describe("SessionProjectBridge", () => {
  describe("bind / getBinding", () => {
    it("binds a session to a project", () => {
      const bridge = new SessionProjectBridge();
      const binding = bridge.bind("session-1", "project-1");

      expect(binding.sessionId).toBe("session-1");
      expect(binding.projectId).toBe("project-1");
      expect(binding.status).toBe("active");
    });

    it("retrieves an existing binding", () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");

      const retrieved = bridge.getBinding("project-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe("session-1");
    });

    it("returns undefined for unbound project", () => {
      const bridge = new SessionProjectBridge();
      expect(bridge.getBinding("non-existent")).toBeUndefined();
    });
  });

  describe("ensureSession", () => {
    it("returns existing active session", async () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");

      const binding = await bridge.ensureSession("project-1");
      expect(binding.sessionId).toBe("session-1");
    });

    it("creates new session when none exists", async () => {
      const bridge = new SessionProjectBridge();
      const binding = await bridge.ensureSession("project-1");

      expect(binding.sessionId).toContain("moran-session-project-1-");
      expect(binding.status).toBe("active");
    });

    it("creates new session when existing is not active", async () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");
      bridge.complete("project-1");

      const binding = await bridge.ensureSession("project-1");
      expect(binding.sessionId).not.toBe("session-1");
      expect(binding.status).toBe("active");
    });
  });

  describe("invokeAgent", () => {
    it("invokes a registered agent (placeholder)", async () => {
      const bridge = new SessionProjectBridge();
      const response = await bridge.invokeAgent({
        agentId: "moheng",
        message: "Test message for orchestrator",
      });

      expect(response.content).toContain("Placeholder");
      expect(response.content).toContain("墨衡");
      expect(response.agentId).toBe("moheng");
      expect(response.usage.inputTokens).toBe(0); // placeholder
    });

    it("throws for unregistered agent", async () => {
      const bridge = new SessionProjectBridge();
      await expect(
        bridge.invokeAgent({
          agentId: "nonexistent" as never,
          message: "Test",
        }),
      ).rejects.toThrow('Agent "nonexistent" not found in registry');
    });

    it("uses provided sessionId", async () => {
      const bridge = new SessionProjectBridge();
      const response = await bridge.invokeAgent({
        agentId: "moheng",
        sessionId: "my-session",
        message: "Test message",
      });

      expect(response.sessionId).toBe("my-session");
    });
  });

  describe("setActiveAgent / complete / release", () => {
    it("setActiveAgent updates binding", () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");
      bridge.setActiveAgent("project-1", "zhibi");

      const binding = bridge.getBinding("project-1");
      expect(binding?.activeAgent).toBe("zhibi");
    });

    it("complete sets status to completed", () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");
      bridge.complete("project-1");

      const binding = bridge.getBinding("project-1");
      expect(binding?.status).toBe("completed");
    });

    it("release removes binding entirely", () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("session-1", "project-1");
      bridge.release("project-1");

      expect(bridge.getBinding("project-1")).toBeUndefined();
    });
  });

  describe("dispose", () => {
    it("clears all bindings", () => {
      const bridge = new SessionProjectBridge();
      bridge.bind("s1", "p1");
      bridge.bind("s2", "p2");
      bridge.dispose();

      expect(bridge.getBinding("p1")).toBeUndefined();
      expect(bridge.getBinding("p2")).toBeUndefined();
    });
  });

  describe("getConfig", () => {
    it("returns default config", () => {
      const bridge = new SessionProjectBridge();
      const config = bridge.getConfig();

      expect(config.sdkPort).toBe(3100);
      expect(config.autoCreateSession).toBe(true);
      expect(config.sessionTimeout).toBe(3600_000);
    });

    it("returns custom config", () => {
      const bridge = new SessionProjectBridge({ sdkPort: 9999 });
      expect(bridge.getConfig().sdkPort).toBe(9999);
    });
  });
});
