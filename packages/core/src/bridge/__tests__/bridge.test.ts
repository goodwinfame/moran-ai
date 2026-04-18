import { describe, expect, it, vi } from "vitest";
import { SessionProjectBridge } from "../bridge.js";
import type { BridgeTransport, BridgeTransportResponse } from "../types.js";

/**
 * 创建 mock transport，用于测试真实调用模式
 */
function createMockTransport(overrides?: Partial<BridgeTransport>): BridgeTransport {
  return {
    createSession: vi.fn().mockResolvedValue("sdk-session-001"),
    prompt: vi.fn().mockResolvedValue({
      content: "Mock LLM response",
      usage: { inputTokens: 100, outputTokens: 50 },
    } satisfies BridgeTransportResponse),
    ...overrides,
  };
}

describe("SessionProjectBridge", () => {
  // ── Placeholder 模式（无 transport，向后兼容） ──────────

  describe("placeholder mode (no transport)", () => {
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

      it("creates placeholder session when none exists", async () => {
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
      it("returns placeholder response", async () => {
        const bridge = new SessionProjectBridge();
        const response = await bridge.invokeAgent({
          agentId: "moheng",
          message: "Test message for orchestrator",
        });

        expect(response.content).toContain("Placeholder");
        expect(response.content).toContain("墨衡");
        expect(response.agentId).toBe("moheng");
        expect(response.usage.inputTokens).toBe(0);
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

      it("uses provided sessionId in placeholder mode", async () => {
        const bridge = new SessionProjectBridge();
        const response = await bridge.invokeAgent({
          agentId: "moheng",
          sessionId: "my-session",
          message: "Test message",
        });

        expect(response.sessionId).toBe("my-session");
      });
    });

    describe("hasTransport", () => {
      it("returns false when no transport", () => {
        const bridge = new SessionProjectBridge();
        expect(bridge.hasTransport()).toBe(false);
      });
    });
  });

  // ── Transport 模式（真实 SDK 调用） ────────────────────

  describe("transport mode", () => {
    describe("ensureSession", () => {
      it("calls transport.createSession", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        const binding = await bridge.ensureSession("project-1");

        expect(transport.createSession).toHaveBeenCalledWith("MoRan Project project-1");
        expect(binding.sessionId).toBe("sdk-session-001");
        expect(binding.status).toBe("active");
        expect(binding.projectId).toBe("project-1");
      });

      it("reuses existing active session without calling transport", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        bridge.bind("existing-session", "project-1");
        const binding = await bridge.ensureSession("project-1");

        expect(transport.createSession).not.toHaveBeenCalled();
        expect(binding.sessionId).toBe("existing-session");
      });

      it("creates new session when existing is completed", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        bridge.bind("old-session", "project-1");
        bridge.complete("project-1");

        const binding = await bridge.ensureSession("project-1");
        expect(transport.createSession).toHaveBeenCalled();
        expect(binding.sessionId).toBe("sdk-session-001");
      });
    });

    describe("invokeAgent", () => {
      it("calls transport.prompt with active session", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        // 先 ensureSession 创建绑定
        await bridge.ensureSession("project-1");

        const response = await bridge.invokeAgent({
          agentId: "moheng",
          message: "写一段战斗场景",
        });

        expect(transport.prompt).toHaveBeenCalledWith("sdk-session-001", "写一段战斗场景");
        expect(response.content).toBe("Mock LLM response");
        expect(response.sessionId).toBe("sdk-session-001");
        expect(response.usage.inputTokens).toBe(100);
        expect(response.agentId).toBe("moheng");
      });

      it("uses provided sessionId instead of active binding", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        await bridge.ensureSession("project-1");

        const response = await bridge.invokeAgent({
          agentId: "moheng",
          sessionId: "explicit-session",
          message: "Test",
        });

        expect(transport.prompt).toHaveBeenCalledWith("explicit-session", "Test");
        expect(response.sessionId).toBe("explicit-session");
      });

      it("prepends systemPrompt to message", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        await bridge.ensureSession("project-1");

        await bridge.invokeAgent({
          agentId: "moheng",
          message: "用户输入",
          systemPrompt: "你是写作助手",
        });

        expect(transport.prompt).toHaveBeenCalledWith(
          "sdk-session-001",
          "你是写作助手\n\n---\n\n用户输入",
        );
      });

      it("throws when no active session and no sessionId provided", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        await expect(
          bridge.invokeAgent({
            agentId: "moheng",
            message: "Test",
          }),
        ).rejects.toThrow("No active session found");
      });

      it("throws for unregistered agent even with transport", async () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);

        await expect(
          bridge.invokeAgent({
            agentId: "nonexistent" as never,
            message: "Test",
          }),
        ).rejects.toThrow('Agent "nonexistent" not found in registry');
      });
    });

    describe("hasTransport", () => {
      it("returns true when transport is provided", () => {
        const transport = createMockTransport();
        const bridge = new SessionProjectBridge({}, transport);
        expect(bridge.hasTransport()).toBe(true);
      });
    });
  });

  // ── 共享行为（两种模式通用） ────────────────────────────

  describe("shared behavior", () => {
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

        expect(config.autoCreateSession).toBe(true);
        expect(config.sessionTimeout).toBe(3600_000);
      });

      it("merges custom config", () => {
        const bridge = new SessionProjectBridge({ sessionTimeout: 5000 });
        expect(bridge.getConfig().sessionTimeout).toBe(5000);
      });
    });
  });
});
