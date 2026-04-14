/**
 * /api/projects/:id/styles — 风格配置管理
 *
 * GET    /                — 列出所有可用风格（内置 + 用户自定义）
 * POST   /                — 创建自定义风格
 * GET    /:styleId        — 获取单条风格详情
 * PUT    /:styleId        — 更新自定义风格
 * DELETE /:styleId        — 删除自定义风格
 * POST   /:styleId/fork   — Fork 内置风格为自定义
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("styles-routes");

/**
 * 风格列表项 (简要)
 */
export interface StyleListItem {
  styleId: string;
  displayName: string;
  genre: string;
  description: string;
  source: "builtin" | "user" | "fork";
  forkedFrom: string | null;
}

/**
 * 风格详情 (完整)
 */
export interface StyleDetail extends StyleListItem {
  version: number;
  modules: string[];
  reviewerFocus: string[];
  contextWeights: Record<string, number>;
  tone: Record<string, number>;
  forbidden: { words?: string[]; patterns?: string[] };
  encouraged: string[];
  proseGuide: string;
  examples: string;
  createdAt: string;
  updatedAt: string;
}

// 内置风格预设（只读）
const builtinStyles: StyleDetail[] = [
  {
    styleId: "yunmo",
    displayName: "执笔·云墨",
    genre: "通用",
    description: "默认风格，兼容各类题材。白描为主，适度描写，节奏平衡。",
    source: "builtin",
    forkedFrom: null,
    version: 1,
    modules: ["anti-ai", "prose-craft"],
    reviewerFocus: ["节奏控制", "白描质量"],
    contextWeights: { world: 1.0, character: 1.0, plot: 1.0 },
    tone: { humor: 0.3, tension: 0.5, romance: 0.3, dark: 0.2 },
    forbidden: { words: ["竟然", "不禁", "缓缓说道"], patterns: [] },
    encouraged: ["五感描写", "间接心理", "动作细节"],
    proseGuide:
      "以白描为骨，细节为肉。\n\n- 优先动作和对话推进叙事\n- 心理活动通过行为折射，少用直接心理描写\n- 环境描写服务于情绪，不堆砌辞藻\n- 对话要有性格区分度\n- 控制形容词密度，每段不超过两个",
    examples:
      "他推开门，院子里的桂花开了。\n\n风吹过来，带着甜腻的香气。他站在门槛上愣了一瞬——上次看到这棵树开花，母亲还在。\n\n他没有走过去，转身进了灶房。",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    styleId: "jianxin",
    displayName: "执笔·剑心",
    genre: "仙侠/武侠",
    description: "硬派仙侠风格，战斗紧凑，修炼体系严谨，叙事利落。",
    source: "builtin",
    forkedFrom: null,
    version: 1,
    modules: ["anti-ai", "prose-craft", "action-scene"],
    reviewerFocus: ["修炼体系一致性", "战斗节奏", "境界设定"],
    contextWeights: { world: 1.5, character: 1.0, plot: 1.2 },
    tone: { humor: 0.15, tension: 0.7, romance: 0.15, dark: 0.4 },
    forbidden: { words: ["竟然", "不禁", "缓缓说道", "他露出一丝微笑"], patterns: ["境界碾压式描写"] },
    encouraged: ["凌厉动作描写", "修炼突破细节", "天地异象"],
    proseGuide:
      "刀剑如文，利落干脆。\n\n- 战斗场景用短句推进，制造紧张感\n- 修炼描写注重身体感受和灵气流转\n- 减少感叹号使用，用动作代替情绪宣泄\n- 环境描写融入杀气/灵压等设定元素",
    examples:
      "剑光一闪。\n\n对面那人退了半步，衣袍被划开一道口子。他低头看了看，抬手拂去落在肩上的碎布。\n\n\u201c不错。\u201d他说，\u201c你是第三个能破我领域的人。\u201d\n\n沈墨尘没有接话，调整呼吸，灵气在丹田中重新凝聚。第一剑试探已经结束——下一剑，他必须全力以赴。",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    styleId: "qingshi",
    displayName: "执笔·倾世",
    genre: "言情/古言",
    description: "细腻情感描写，注重人物关系和心理转变。",
    source: "builtin",
    forkedFrom: null,
    version: 1,
    modules: ["anti-ai", "prose-craft", "emotion-scene"],
    reviewerFocus: ["情感真实性", "角色心理一致性", "对话性格区分"],
    contextWeights: { world: 0.8, character: 1.5, plot: 1.0 },
    tone: { humor: 0.25, tension: 0.4, romance: 0.8, dark: 0.1 },
    forbidden: { words: ["不禁红了眼眶", "心如刀绞", "缓缓说道"], patterns: [] },
    encouraged: ["微表情描写", "暗流涌动的对话", "环境映射心境"],
    proseGuide:
      "情动于中而形于言。\n\n- 情感表达通过细节传递，而非直接形容\n- 对话间留白，让读者自行体会\n- 肢体语言比内心独白更有力\n- 场景描写服务于情感氛围",
    examples:
      "她把杯子放在桌上，手指在杯沿停了一会儿。\n\n\u201c你什么时候走？\u201d\n\n\u201c后天。\u201d他说。\n\n她点了点头，起身去关窗。风其实并不大。",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    styleId: "anqi",
    displayName: "执笔·暗棋",
    genre: "悬疑/推理",
    description: "节奏精密，信息控制严格，伏笔编织细密。",
    source: "builtin",
    forkedFrom: null,
    version: 1,
    modules: ["anti-ai", "prose-craft", "foreshadow-craft"],
    reviewerFocus: ["线索逻辑", "信息披露节奏", "伏笔闭合"],
    contextWeights: { world: 1.0, character: 1.2, plot: 1.5 },
    tone: { humor: 0.1, tension: 0.85, romance: 0.05, dark: 0.6 },
    forbidden: { words: ["竟然", "不禁"], patterns: ["过早揭示答案"] },
    encouraged: ["不可靠叙事", "误导性暗示", "双关对话"],
    proseGuide:
      "每个词都是线索，每个沉默都有含义。\n\n- 严格控制信息披露顺序\n- 用氛围营造悬疑感\n- 对话中埋设双关和误导\n- 视角限制：读者不应知道侦探/主角不知道的事",
    examples:
      "档案室的灯又闪了一下。\n\n周队把手电夹在腋下，翻开第三个抽屉。里面只有一份文件——薄薄两页纸，档案编号被人用修正液涂掉了。\n\n他凑近看了看。修正液下面，隐约能辨认出一个\u201c沈\u201d字。",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    styleId: "xinghe",
    displayName: "执笔·星河",
    genre: "科幻",
    description: "硬科幻风格，技术描写精准，宏大叙事。",
    source: "builtin",
    forkedFrom: null,
    version: 1,
    modules: ["anti-ai", "prose-craft"],
    reviewerFocus: ["科技设定一致性", "术语准确性", "宏大感"],
    contextWeights: { world: 1.8, character: 0.8, plot: 1.0 },
    tone: { humor: 0.15, tension: 0.6, romance: 0.1, dark: 0.3 },
    forbidden: { words: ["缓缓说道"], patterns: [] },
    encouraged: ["技术细节", "宇宙尺度描写", "冷幽默"],
    proseGuide:
      "星辰大海，冷静而壮阔。\n\n- 技术描写要精准但不晦涩\n- 用数字和具体参数增加真实感\n- 宏大场景与个体命运形成张力\n- 减少感性描写，以理性视角叙事",
    examples:
      "信号延迟 4.2 秒。\n\n这意味着他说出去的每一个字，要在八秒半之后才能得到回应。足够让一颗心跳七十多下——如果对面那艘船上还有活人的话。\n\n舱内安静得只剩循环系统的低频嗡鸣。李维盯着通讯面板上跳动的波形，等待。",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

// 用户自定义风格 — 内存存储 (key: styleId)
const userStyleStore = new Map<string, StyleDetail>();

export function createStylesRoute() {
  const route = new Hono();

  /** GET / — 列出所有可用风格 */
  route.get("/", (c) => {
    const all: StyleListItem[] = [
      ...builtinStyles.map((s) => ({
        styleId: s.styleId,
        displayName: s.displayName,
        genre: s.genre,
        description: s.description,
        source: s.source,
        forkedFrom: s.forkedFrom,
      })),
      ...Array.from(userStyleStore.values()).map((s) => ({
        styleId: s.styleId,
        displayName: s.displayName,
        genre: s.genre,
        description: s.description,
        source: s.source,
        forkedFrom: s.forkedFrom,
      })),
    ];

    return c.json({ styles: all, total: all.length });
  });

  /** POST / — 创建自定义风格 */
  route.post("/", async (c) => {
    const body = await c.req.json<{
      displayName: string;
      genre?: string;
      description?: string;
      proseGuide?: string;
      examples?: string;
      modules?: string[];
      tone?: Record<string, number>;
      contextWeights?: Record<string, number>;
      forbidden?: { words?: string[]; patterns?: string[] };
      encouraged?: string[];
      reviewerFocus?: string[];
    }>();

    if (!body.displayName) {
      return c.json({ error: "displayName is required" }, 400);
    }

    const styleId = `user-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const style: StyleDetail = {
      styleId,
      displayName: body.displayName,
      genre: body.genre ?? "通用",
      description: body.description ?? "",
      source: "user",
      forkedFrom: null,
      version: 1,
      modules: body.modules ?? ["anti-ai", "prose-craft"],
      reviewerFocus: body.reviewerFocus ?? [],
      contextWeights: body.contextWeights ?? { world: 1.0, character: 1.0, plot: 1.0 },
      tone: body.tone ?? { humor: 0.3, tension: 0.5, romance: 0.3, dark: 0.2 },
      forbidden: body.forbidden ?? { words: [], patterns: [] },
      encouraged: body.encouraged ?? [],
      proseGuide: body.proseGuide ?? "",
      examples: body.examples ?? "",
      createdAt: now,
      updatedAt: now,
    };

    userStyleStore.set(styleId, style);
    log.info({ styleId, displayName: body.displayName }, "User style created");

    return c.json(style, 201);
  });

  /** GET /:styleId — 获取风格详情 */
  route.get("/:styleId", (c) => {
    const styleId = c.req.param("styleId");
    const builtin = builtinStyles.find((s) => s.styleId === styleId);
    if (builtin) return c.json(builtin);

    const userStyle = userStyleStore.get(styleId);
    if (userStyle) return c.json(userStyle);

    return c.json({ error: "Style not found" }, 404);
  });

  /** PUT /:styleId — 更新自定义风格 */
  route.put("/:styleId", async (c) => {
    const styleId = c.req.param("styleId");

    // Cannot edit builtin styles directly
    if (builtinStyles.some((s) => s.styleId === styleId)) {
      return c.json(
        { error: "Cannot edit builtin styles. Use fork instead." },
        403,
      );
    }

    const existing = userStyleStore.get(styleId);
    if (!existing) return c.json({ error: "Style not found" }, 404);

    const body = await c.req.json<Partial<StyleDetail>>();
    const updated: StyleDetail = {
      ...existing,
      ...body,
      styleId: existing.styleId,
      source: existing.source,
      forkedFrom: existing.forkedFrom,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    userStyleStore.set(styleId, updated);
    log.info({ styleId }, "User style updated");

    return c.json(updated);
  });

  /** DELETE /:styleId — 删除自定义风格 */
  route.delete("/:styleId", (c) => {
    const styleId = c.req.param("styleId");

    if (builtinStyles.some((s) => s.styleId === styleId)) {
      return c.json({ error: "Cannot delete builtin styles" }, 403);
    }

    if (!userStyleStore.has(styleId)) {
      return c.json({ error: "Style not found" }, 404);
    }

    userStyleStore.delete(styleId);
    log.info({ styleId }, "User style deleted");

    return c.json({ deleted: true });
  });

  /** POST /:styleId/fork — Fork 内置风格 */
  route.post("/:styleId/fork", async (c) => {
    const sourceId = c.req.param("styleId");
    const source = builtinStyles.find((s) => s.styleId === sourceId);
    if (!source) {
      return c.json({ error: "Source style not found (can only fork builtin)" }, 404);
    }

    const body = await c.req.json<{
      displayName?: string;
    }>().catch(() => ({}));

    const forkId = `fork-${sourceId}-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const forked: StyleDetail = {
      ...source,
      styleId: forkId,
      displayName: (body as { displayName?: string }).displayName ?? `${source.displayName} (自定义)`,
      source: "fork",
      forkedFrom: sourceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    userStyleStore.set(forkId, forked);
    log.info({ forkId, sourceId }, "Style forked");

    return c.json(forked, 201);
  });

  return route;
}
