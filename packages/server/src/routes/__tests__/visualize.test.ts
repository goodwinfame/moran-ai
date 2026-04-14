/**
 * 可视化相关路由测试 — locations + timeline
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createApp } from "../../app.js";

const { app } = createApp();
const PROJECT_ID = "proj-viz-test";

describe("locations route", () => {
  it("GET / returns tree and flat data with demo seed", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations`);
    expect(res.status).toBe(200);
    const data = await res.json() as { tree: unknown[]; flat: unknown[]; total: number };
    expect(data.total).toBeGreaterThan(0);
    expect(data.tree.length).toBeGreaterThan(0);
    expect(data.flat.length).toBe(data.total);
  });

  it("POST / creates a new location", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "测试城市", type: "city", description: "测试用" }),
    });
    expect(res.status).toBe(201);
    const loc = await res.json() as { id: string; name: string; type: string };
    expect(loc.name).toBe("测试城市");
    expect(loc.type).toBe("city");
  });

  it("POST / rejects missing name", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "city" }),
    });
    expect(res.status).toBe(400);
  });

  let createdLocId: string;

  beforeAll(async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "更新测试", type: "area" }),
    });
    const loc = await res.json() as { id: string };
    createdLocId = loc.id;
  });

  it("PUT /:locId updates a location", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations/${createdLocId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "已更新区域" }),
    });
    expect(res.status).toBe(200);
    const loc = await res.json() as { name: string };
    expect(loc.name).toBe("已更新区域");
  });

  it("DELETE /:locId removes a location", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations/${createdLocId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { deleted: boolean };
    expect(data.deleted).toBe(true);
  });

  it("DELETE /:locId returns 404 for unknown", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/locations/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("tree structure has correct parent-child relationships", async () => {
    const res = await app.request(`/api/projects/proj-tree-test/locations`);
    const data = await res.json() as { tree: Array<{ name: string; children: Array<{ name: string }> }> };
    const root = data.tree[0];
    expect(root).toBeDefined();
    if (root) {
      expect(root.children.length).toBeGreaterThan(0);
    }
  });
});

describe("timeline route", () => {
  it("GET / returns items and groups with demo seed", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline`);
    expect(res.status).toBe(200);
    const data = await res.json() as { items: unknown[]; groups: unknown[]; total: number };
    expect(data.total).toBeGreaterThan(0);
    expect(data.groups.length).toBeGreaterThan(0);
    expect(data.items.length).toBe(data.total);
  });

  it("POST / creates a new event", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "测试事件",
        content: "描述",
        group: "main-plot",
        start: "2025-03-01",
        significance: "major",
      }),
    });
    expect(res.status).toBe(201);
    const evt = await res.json() as { id: string; title: string; significance: string };
    expect(evt.title).toBe("测试事件");
    expect(evt.significance).toBe("major");
  });

  it("POST / rejects missing title", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "无标题" }),
    });
    expect(res.status).toBe(400);
  });

  let createdEventId: string;

  beforeAll(async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "更新测试事件", start: "2025-04-01" }),
    });
    const evt = await res.json() as { id: string };
    createdEventId = evt.id;
  });

  it("PUT /:eventId updates an event", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline/${createdEventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "已更新事件" }),
    });
    expect(res.status).toBe(200);
    const evt = await res.json() as { title: string };
    expect(evt.title).toBe("已更新事件");
  });

  it("DELETE /:eventId removes an event", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline/${createdEventId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { deleted: boolean };
    expect(data.deleted).toBe(true);
  });

  it("DELETE /:eventId returns 404 for unknown", async () => {
    const res = await app.request(`/api/projects/${PROJECT_ID}/timeline/nonexistent`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("items have vis-timeline compatible structure", async () => {
    const res = await app.request(`/api/projects/proj-format-test/timeline`);
    const data = await res.json() as { items: Array<{ id: string; content: string; start: string; group: string }> };
    const first = data.items[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.id).toBeDefined();
      expect(first.content).toBeDefined();
      expect(first.start).toBeDefined();
      expect(first.group).toBeDefined();
    }
  });
});
