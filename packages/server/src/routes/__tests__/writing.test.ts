import { describe, expect, it } from "vitest";
import { EventBus, Orchestrator, SessionProjectBridge } from "@moran/core";
import { createApp } from "../../app.js";

describe("Writing routes", () => {
  /** Setup with default pipeline (for testing pipeline-mode responses) */
  const setup = () => {
    const eventBus = new EventBus();
    const bridge = new SessionProjectBridge(); // placeholder mode — no transport, no SDK calls
    const orchestrators = new Map<string, Orchestrator>();
    const getOrCreateOrchestrator = (projectId: string) => {
      if (!orchestrators.has(projectId)) {
        orchestrators.set(projectId, new Orchestrator(projectId, { heartbeatInterval: 60_000 }, eventBus));
      }
      return orchestrators.get(projectId);
    };

    const { app } = createApp({
      eventBus,
      getOrchestrator: getOrCreateOrchestrator,
      bridge, // override default transport-backed bridge for test isolation
    });

    return { app, orchestrators, getOrCreateOrchestrator };
  };

  /**
   * Setup without pipeline — orchestrator-only mode.
   * Used for state management tests (409 conflict, pause, resume) to avoid
   * async pipeline failures resetting orchestrator state via microtasks.
   */
  const setupOrchestratorOnly = () => {
    const eventBus = new EventBus();
    const orchestrators = new Map<string, Orchestrator>();
    const getOrCreateOrchestrator = (projectId: string) => {
      if (!orchestrators.has(projectId)) {
        orchestrators.set(projectId, new Orchestrator(projectId, { heartbeatInterval: 60_000 }, eventBus));
      }
      return orchestrators.get(projectId);
    };

    const { app } = createApp({
      eventBus,
      getOrchestrator: getOrCreateOrchestrator,
      getPipeline: () => undefined,
    });

    return { app, orchestrators, getOrCreateOrchestrator };
  };

  describe("GET /api/projects/:id/writing", () => {
    it("returns current state", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/writing");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phase).toBe("idle");
      expect(body.chapterNumber).toBe(0);
    });
  });

  describe("POST /api/projects/:id/writing/next", () => {
    it("starts writing the next chapter", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Pipeline mode returns 202 Accepted (async)
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.status).toBe("writing");
      expect(body.chapterNumber).toBe(1);
      expect(body.mode).toBe("pipeline");
    });

    it("accepts custom chapter number", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterNumber: 5, arcNumber: 2 }),
      });

      // Pipeline mode returns 202 Accepted (async)
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.chapterNumber).toBe(5);
      expect(body.arcNumber).toBe(2);
      expect(body.mode).toBe("pipeline");
    });

    it("returns 409 when already writing", async () => {
      const { app } = setupOrchestratorOnly();

      // Start writing first (orchestrator-only: synchronous state change)
      await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        body: JSON.stringify({}),
      });

      // Try to start again — blocked by phase check
      const res = await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.currentPhase).toBe("writing");
    });
  });

  describe("POST /api/projects/:id/writing/pause", () => {
    it("pauses an active writing session", async () => {
      const { app } = setupOrchestratorOnly();

      // Start writing (orchestrator-only: synchronous state change)
      await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await app.request("/api/projects/proj-1/writing/pause", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("paused");
    });

    it("returns 409 when idle", async () => {
      const { app } = setup();
      const res = await app.request("/api/projects/proj-1/writing/pause", {
        method: "POST",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/projects/:id/writing/continue", () => {
    it("resumes a paused session", async () => {
      const { app } = setupOrchestratorOnly();

      // Start and pause (orchestrator-only: synchronous state change)
      await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await app.request("/api/projects/proj-1/writing/pause", { method: "POST" });

      const res = await app.request("/api/projects/proj-1/writing/continue", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("resumed");
    });

    it("returns 409 when not paused", async () => {
      const { app } = setup();

      // Start writing (not paused)
      await app.request("/api/projects/proj-1/writing/next", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await app.request("/api/projects/proj-1/writing/continue", {
        method: "POST",
      });

      expect(res.status).toBe(409);
    });
  });
});
