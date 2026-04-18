/**
 * Intent 路由测试
 *
 * POST /api/projects/:id/intent
 *
 * 策略：mock @opencode-ai/sdk，验证路由层逻辑
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";

// ── Mock SDK ──────────────────────────────────────────────────

const mockSessionCreate = vi.fn();
const mockSessionPrompt = vi.fn();

vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn(() => ({
    session: {
      create: mockSessionCreate,
      prompt: mockSessionPrompt,
    },
  })),
}));

// ── helpers ───────────────────────────────────────────────────

function buildApp() {
  return createApp().app;
}

async function post(
  app: ReturnType<typeof buildApp>,
  projectId: string,
  body: unknown,
  userId = "user-1",
) {
  return app.request(`/api/projects/${projectId}/intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify(body),
  });
}

async function resetSessionManager() {
  const { sessionManager } = await import("../../opencode/manager.js");
  const mgr = sessionManager as unknown as { sessions: Map<string, unknown> };
  mgr.sessions.clear();
}

// ── 测试 ──────────────────────────────────────────────────────

describe("POST /api/projects/:id/intent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetSessionManager();
    mockSessionCreate.mockResolvedValue({ data: { id: "oc-sess-1" } });
  });

  // 参数校验
  it("400 — 缺少 message", async () => {
    const app = buildApp();
    const res = await post(app, "p1", {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/message/i);
  });

  it("400 — message 为空字符串", async () => {
    const app = buildApp();
    const res = await post(app, "p1", { message: "   " });
    expect(res.status).toBe(400);
  });

  it("400 — 请求体不是合法 JSON", async () => {
    const app = buildApp();
    const res = await app.request("/api/projects/p1/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": "user-1" },
      body: "{ invalid json",
    });
    expect(res.status).toBe(400);
  });

  // 新 session 注入系统提示
  it("新 session 时，prompt 内容包含系统提示前缀", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: '好的\n---SCHEMES---\n{"schemes":[]}' }] },
    });

    const app = buildApp();
    await post(app, "p1", { message: "玄幻故事" }, "user-a");

    expect(mockSessionCreate).toHaveBeenCalledOnce();
    const promptCall = mockSessionPrompt.mock.calls[0][0] as {
      body: { parts: Array<{ text: string }> };
    };
    const sentText = promptCall.body.parts[0].text;
    expect(sentText).toContain("灵犀");
    expect(sentText).toContain("玄幻故事");
  });

  it("同 (userId, projectId) 第二条消息不创建新 session，不注入系统提示", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: '继续\n---SCHEMES---\n{"schemes":[]}' }] },
    });

    const app = buildApp();
    await post(app, "p1", { message: "第一条" }, "user-b");
    vi.clearAllMocks();
    mockSessionCreate.mockResolvedValue({ data: { id: "oc-sess-1" } });
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: '好\n---SCHEMES---\n{"schemes":[]}' }] },
    });

    await post(app, "p1", { message: "第二条" }, "user-b");

    expect(mockSessionCreate).not.toHaveBeenCalled();
    const promptCall = mockSessionPrompt.mock.calls[0][0] as {
      body: { parts: Array<{ text: string }> };
    };
    expect(promptCall.body.parts[0].text).toBe("第二条");
  });

  it("不同 userId 对同一 projectId 创建独立 session", async () => {
    mockSessionCreate
      .mockResolvedValueOnce({ data: { id: "sess-ua" } })
      .mockResolvedValueOnce({ data: { id: "sess-ub" } });
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: '回复\n---SCHEMES---\n{"schemes":[]}' }] },
    });

    const app = buildApp();
    await post(app, "p1", { message: "消息" }, "user-a");
    await post(app, "p1", { message: "消息" }, "user-b");

    expect(mockSessionCreate).toHaveBeenCalledTimes(2);
  });

  // 正常解析
  it("成功解析 reply 和 schemes", async () => {
    const schemes = [
      {
        id: "1",
        label: "记忆碎片线",
        核心冲突: "失忆 vs 寻找自我",
        故事卖点: ["反转多", "情感细腻"],
        基调: "悬疑",
        目标读者感受: "揪心",
      },
    ];
    mockSessionPrompt.mockResolvedValue({
      data: {
        parts: [
          { type: "text", text: `这个想法很棒！\n---SCHEMES---\n${JSON.stringify({ schemes })}` },
        ],
      },
    });

    const app = buildApp();
    const res = await post(app, "p1", { message: "失忆少年" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("这个想法很棒！");
    expect(body.schemes).toHaveLength(1);
    expect(body.schemes[0].id).toBe("1");
    expect(body.schemes[0].label).toBe("记忆碎片线");
  });

  it("多个 schemes 全部返回", async () => {
    const schemes = [
      { id: "1", label: "方案一", 核心冲突: "a", 故事卖点: [], 基调: "轻松", 目标读者感受: "快乐" },
      { id: "2", label: "方案二", 核心冲突: "b", 故事卖点: [], 基调: "悲剧", 目标读者感受: "感动" },
      { id: "3", label: "方案三", 核心冲突: "c", 故事卖点: [], 基调: "燃", 目标读者感受: "热血" },
    ];
    mockSessionPrompt.mockResolvedValue({
      data: {
        parts: [{ type: "text", text: `前缀\n---SCHEMES---\n${JSON.stringify({ schemes })}` }],
      },
    });

    const app = buildApp();
    const res = await post(app, "p1", { message: "三个" });
    const body = await res.json();
    expect(body.schemes).toHaveLength(3);
  });

  // 降级
  it("无 ---SCHEMES--- 分隔符：schemes 为 null", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: "只有回复文字" }] },
    });

    const app = buildApp();
    const res = await post(app, "p1", { message: "随便" });
    const body = await res.json();
    expect(body.reply).toBe("只有回复文字");
    expect(body.schemes).toBeNull();
  });

  it("---SCHEMES--- 后 JSON 损坏：schemes 为 null，reply 保留", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: "好的\n---SCHEMES---\n{ invalid" }] },
    });

    const app = buildApp();
    const res = await post(app, "p1", { message: "测试" });
    const body = await res.json();
    expect(body.reply).toBe("好的");
    expect(body.schemes).toBeNull();
  });

  it("空 parts 数组：返回降级提示", async () => {
    mockSessionPrompt.mockResolvedValue({ data: { parts: [] } });

    const app = buildApp();
    const res = await post(app, "p1", { message: "测试" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain("请再描述");
    expect(body.schemes).toBeNull();
  });

  it("parts 中无 text 类型：返回降级提示", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "tool_use", id: "t1" }] },
    });

    const app = buildApp();
    const res = await post(app, "p1", { message: "测试" });
    const body = await res.json();
    expect(body.reply).toContain("请再描述");
  });

  // 错误处理
  it("OpenCode SDK 抛出错误 → 500", async () => {
    mockSessionPrompt.mockRejectedValue(new Error("OpenCode timeout"));

    const app = buildApp();
    const res = await post(app, "p1", { message: "测试" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("OpenCode timeout");
  });

  it("session.create 返回无 id → 500", async () => {
    mockSessionCreate.mockResolvedValue({ data: null });

    const app = buildApp();
    const res = await post(app, "p1", { message: "测试" });
    expect(res.status).toBe(500);
  });

  // userId fallback
  it("无 x-user-id header 时使用 anonymous，请求正常处理", async () => {
    mockSessionPrompt.mockResolvedValue({
      data: { parts: [{ type: "text", text: 'OK\n---SCHEMES---\n{"schemes":[]}' }] },
    });

    const app = buildApp();
    const res = await app.request("/api/projects/p1/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "测试" }),
    });
    expect(res.status).toBe(200);
  });
});
