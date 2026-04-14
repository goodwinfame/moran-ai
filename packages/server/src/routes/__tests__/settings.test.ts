import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createWorldRoute } from "../world.js";
import { createCharactersRoute } from "../characters.js";
import { createOutlineRoute } from "../outline.js";
import { createStylesRoute } from "../styles.js";

// ── World Routes ─────────────────────────────────

function makeWorldApp() {
  const app = new Hono();
  app.route("/api/projects/:id/world", createWorldRoute());
  return app;
}

describe("world route", () => {
  const PID = "proj-world-test";

  it("GET / returns demo settings", async () => {
    const app = makeWorldApp();
    const res = await app.request(`/api/projects/${PID}/world`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it("POST / creates a new setting", async () => {
    const app = makeWorldApp();
    // seed first
    await app.request(`/api/projects/${PID}/world`);

    const res = await app.request(`/api/projects/${PID}/world`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "subsystem:magic",
        name: "魔法体系",
        content: "元素魔法分为五系",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("魔法体系");
  });

  it("POST / rejects missing name", async () => {
    const app = makeWorldApp();
    const res = await app.request(`/api/projects/${PID}/world`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "rules", name: "", content: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT /:settingId updates a setting", async () => {
    const app = makeWorldApp();
    // Get existing
    const listRes = await app.request(`/api/projects/${PID}/world`);
    const list = await listRes.json();
    const settingId = list.settings[0].id;

    const res = await app.request(`/api/projects/${PID}/world/${settingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated content" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe("Updated content");
  });

  it("DELETE /:settingId removes a setting", async () => {
    const app = makeWorldApp();
    const listRes = await app.request(`/api/projects/${PID}/world`);
    const list = await listRes.json();
    const settingId = list.settings[0].id;

    const res = await app.request(`/api/projects/${PID}/world/${settingId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});

// ── Characters Routes ────────────────────────────

function makeCharApp() {
  const app = new Hono();
  app.route("/api/projects/:id/characters", createCharactersRoute());
  return app;
}

describe("characters route", () => {
  const PID = "proj-char-test";

  it("GET / returns demo characters sorted by role", async () => {
    const app = makeCharApp();
    const res = await app.request(`/api/projects/${PID}/characters`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toBeDefined();
    expect(body.total).toBe(4);
    // protagonist first
    expect(body.characters[0].role).toBe("protagonist");
  });

  it("POST / creates character", async () => {
    const app = makeCharApp();
    const res = await app.request(`/api/projects/${PID}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "测试角色",
        role: "supporting",
        description: "测试描述",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("测试角色");
    expect(body.role).toBe("supporting");
  });

  it("POST / rejects empty name", async () => {
    const app = makeCharApp();
    const res = await app.request(`/api/projects/${PID}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /graph returns nodes and edges", async () => {
    const app = makeCharApp();
    const res = await app.request(`/api/projects/${PID}/characters/graph`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes).toBeDefined();
    expect(body.edges).toBeDefined();
    expect(body.nodes.length).toBeGreaterThanOrEqual(4);
    expect(body.edges.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /:charId returns character detail", async () => {
    const app = makeCharApp();
    const listRes = await app.request(`/api/projects/${PID}/characters`);
    const list = await listRes.json();
    const charId = list.characters[0].id;

    const res = await app.request(`/api/projects/${PID}/characters/${charId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBeDefined();
    expect(body.dna).toBeDefined();
  });

  it("PUT /:charId updates character", async () => {
    const app = makeCharApp();
    const listRes = await app.request(`/api/projects/${PID}/characters`);
    const list = await listRes.json();
    const charId = list.characters[0].id;

    const res = await app.request(`/api/projects/${PID}/characters/${charId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personality: "Updated personality" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).personality).toBe("Updated personality");
  });

  it("DELETE /:charId removes character and its relationships", async () => {
    const app = makeCharApp();
    const listRes = await app.request(`/api/projects/${PID}/characters`);
    const list = await listRes.json();
    const charId = list.characters[list.characters.length - 1].id;

    const res = await app.request(`/api/projects/${PID}/characters/${charId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });

  it("GET /:charId returns 404 for unknown ID", async () => {
    const app = makeCharApp();
    const res = await app.request(`/api/projects/${PID}/characters/nonexistent`);
    expect(res.status).toBe(404);
  });
});

// ── Outline Routes ───────────────────────────────

function makeOutlineApp() {
  const app = new Hono();
  app.route("/api/projects/:id/outline", createOutlineRoute());
  return app;
}

describe("outline route", () => {
  const PID = "proj-outline-test";

  it("GET / returns outline with arcs", async () => {
    const app = makeOutlineApp();
    const res = await app.request(`/api/projects/${PID}/outline`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outline).toBeDefined();
    expect(body.outline.synopsis).toBeDefined();
    expect(body.arcs.length).toBe(3);
  });

  it("PUT / updates outline synopsis", async () => {
    const app = makeOutlineApp();
    // Seed first
    await app.request(`/api/projects/${PID}/outline`);

    const res = await app.request(`/api/projects/${PID}/outline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ synopsis: "Updated synopsis" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).synopsis).toBe("Updated synopsis");
  });

  it("GET /arcs returns arc list", async () => {
    const app = makeOutlineApp();
    const res = await app.request(`/api/projects/${PID}/outline/arcs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.arcs.length).toBeGreaterThanOrEqual(3);
  });

  it("POST /arcs creates new arc", async () => {
    const app = makeOutlineApp();
    // Seed
    await app.request(`/api/projects/${PID}/outline`);

    const res = await app.request(`/api/projects/${PID}/outline/arcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "新弧段",
        startChapter: 101,
        endChapter: 130,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("新弧段");
    expect(body.arcIndex).toBe(4);
  });

  it("POST /arcs rejects empty title", async () => {
    const app = makeOutlineApp();
    const res = await app.request(`/api/projects/${PID}/outline/arcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT /arcs/:arcIndex updates arc", async () => {
    const app = makeOutlineApp();
    // Seed
    await app.request(`/api/projects/${PID}/outline`);

    const res = await app.request(`/api/projects/${PID}/outline/arcs/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Arc Title" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Updated Arc Title");
  });

  it("DELETE /arcs/:arcIndex removes arc", async () => {
    const app = makeOutlineApp();
    await app.request(`/api/projects/${PID}/outline`);

    const res = await app.request(`/api/projects/${PID}/outline/arcs/3`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
  });

  it("PUT /arcs/:arcIndex 404 for unknown index", async () => {
    const app = makeOutlineApp();
    const res = await app.request(`/api/projects/${PID}/outline/arcs/999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

// ── Styles Routes ────────────────────────────────

function makeStyleApp() {
  const app = new Hono();
  app.route("/api/projects/:id/styles", createStylesRoute());
  return app;
}

describe("styles route", () => {
  const PID = "proj-style-test";

  it("GET / returns builtin styles", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.styles.length).toBeGreaterThanOrEqual(5);
    // All 5 builtin presets
    const names = body.styles.map((s: { displayName: string }) => s.displayName);
    expect(names).toContain("执笔·云墨");
    expect(names).toContain("执笔·剑心");
  });

  it("GET /:styleId returns builtin detail", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles/yunmo`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("执笔·云墨");
    expect(body.proseGuide).toBeDefined();
    expect(body.tone).toBeDefined();
  });

  it("POST / creates user style", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "自定义测试风格",
        genre: "都市",
        description: "测试描述",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.displayName).toBe("自定义测试风格");
    expect(body.source).toBe("user");
    expect(body.styleId).toMatch(/^user-/);
  });

  it("POST / rejects empty displayName", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /:styleId/fork forks builtin style", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles/jianxin/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "我的剑心风格" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source).toBe("fork");
    expect(body.forkedFrom).toBe("jianxin");
    expect(body.displayName).toBe("我的剑心风格");
  });

  it("PUT /:styleId cannot edit builtin", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles/yunmo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "hacked" }),
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /:styleId cannot delete builtin", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles/yunmo`, {
      method: "DELETE",
    });
    expect(res.status).toBe(403);
  });

  it("GET /:styleId returns 404 for unknown", async () => {
    const app = makeStyleApp();
    const res = await app.request(`/api/projects/${PID}/styles/nonexistent`);
    expect(res.status).toBe(404);
  });
});
