/**
 * /api/projects/:id/characters — 角色管理 CRUD
 *
 * GET    /                — 列出所有角色
 * POST   /                — 新增角色
 * GET    /:charId         — 获取角色详情
 * PUT    /:charId         — 更新角色
 * DELETE /:charId         — 删除角色
 * GET    /graph           — 关系图数据 (Cytoscape.js 格式)
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("characters-routes");

/**
 * 角色数据 — 对应 §6 characters + character_dna 表
 */
export interface CharacterData {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  description: string;
  personality: string;
  background: string;
  goals: string[];
  firstAppearance: number | null;
  arc: string | null;
  profileContent: string | null;
  /** DNA 四维心理模型 */
  dna: CharacterDNA | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterDNA {
  ghost: string;
  wound: string;
  lie: string;
  want: string;
  need: string;
  arcType: "positive" | "negative" | "flat" | "corruption";
  defaultMode: string;
  stressResponse: string;
  tell: string;
}

/**
 * 角色关系
 */
export interface RelationshipData {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description: string;
}

// 内存存储
const characterStore = new Map<string, CharacterData>();
const relationshipStore = new Map<string, RelationshipData>();

function seedDemoCharacters(projectId: string): void {
  const chars: Array<Omit<CharacterData, "id" | "projectId" | "createdAt" | "updatedAt">> = [
    {
      name: "沈墨尘",
      aliases: ["墨尘", "废物大少"],
      role: "protagonist",
      description: "沈家嫡子，幼时被测出杂灵根，沦为家族笑柄。性格外热内冷，善于隐忍。",
      personality: "外热内冷，善于隐忍。看似随和温吞，内心极度执着。在利益纷争中保持底线，但不迂腐。",
      background: "沈家曾为中州一品家族，父亲在一次秘境探索中失踪。母亲为护他周全，散尽修为封印了他的真正灵根。",
      goals: ["找到失踪的父亲", "解开灵根封印的秘密", "让沈家重回巅峰"],
      firstAppearance: 1,
      arc: "从被人看不起的废物少爷成长为撼动修仙界格局的强者",
      profileContent: null,
      dna: {
        ghost: "目睹母亲散尽修为倒在血泊中",
        wound: "对自身无力保护至亲的深层恐惧",
        lie: "只有变得足够强大，才能保护身边的人",
        want: "找到父亲，恢复家族荣光",
        need: "接受失去是人生的一部分，学会放手",
        arcType: "positive",
        defaultMode: "温和谦逊，不引人注目",
        stressResponse: "沉默寡言，独自承受",
        tell: "紧张时无意识地摩挲左手腕上的玉镯——母亲留下的遗物",
      },
    },
    {
      name: "凌霜",
      aliases: ["霜儿", "冰仙子"],
      role: "supporting",
      description: "北冥冰宫嫡传弟子，天赋异禀的冰灵根修士。外表清冷，实则重情重义。",
      personality: "外冷内热。对陌生人冷若冰霜，对认可的人温柔体贴。做事果断利落，不拖泥带水。",
      background: "自幼被冰宫收养，从未见过父母。在严苛的修炼环境中成长，养成了独立坚强的性格。",
      goals: ["突破化神期", "找到自己的身世之谜"],
      firstAppearance: 5,
      arc: "从封闭自我到敞开心扉",
      profileContent: null,
      dna: {
        ghost: "幼时在暴风雪中被遗弃的模糊记忆",
        wound: "深层的被抛弃感",
        lie: "不依赖任何人就不会被抛弃",
        want: "成为冰宫最强弟子证明自己的价值",
        need: "学会信任他人，接受被爱",
        arcType: "positive",
        defaultMode: "冷淡疏离，一切公事公办",
        stressResponse: "更加封闭自我，拒人千里之外",
        tell: "不自觉地搓揉手指——幼时冻伤留下的习惯",
      },
    },
    {
      name: "陆九渊",
      aliases: ["九渊", "黑袍"],
      role: "antagonist",
      description: "天一宗大长老，表面道貌岸然，实则野心勃勃。暗中修炼禁术，谋划颠覆宗门秩序。",
      personality: "城府极深，善于伪装。对外和蔼可亲，对内铁血手腕。极度自负，认为自己才是引领修仙界的人。",
      background: "出身散修家庭，凭借过人天赋和手段一步步爬到天一宗大长老之位。曾被宗门世家弟子羞辱，自此对所有世家怀恨在心。",
      goals: ["掌控天一宗", "建立以实力为唯一标准的新秩序"],
      firstAppearance: 8,
      arc: "从被压迫者变成压迫者，最终被自己的执念吞噬",
      profileContent: null,
      dna: {
        ghost: "年轻时被世家弟子当众羞辱踩踏",
        wound: "对卑微出身的深层自卑",
        lie: "只有权力才能获得尊严",
        want: "掌控一切，再也不被人看不起",
        need: "放下仇恨，认识到尊严来自内心而非权力",
        arcType: "negative",
        defaultMode: "温文尔雅，长者风范",
        stressResponse: "暴怒，暴露出真实的偏执本性",
        tell: "微笑时右手会不自觉地握拳——压抑着内心的狂暴",
      },
    },
    {
      name: "赵小虎",
      aliases: ["小虎", "虎哥"],
      role: "supporting",
      description: "沈墨尘的发小，出身凡人猎户家庭。意外觉醒灵根后与沈墨尘一同拜入宗门。",
      personality: "直率豪爽，重义气。有点莽但关键时刻靠谱。",
      background: "山村猎户之子，十二岁时在山中打猎意外触发灵根觉醒。",
      goals: ["保护好兄弟", "让家人过上好日子"],
      firstAppearance: 1,
      arc: "从鲁莽少年成长为可靠的伙伴",
      profileContent: null,
      dna: null,
    },
  ];

  const rels: Array<Omit<RelationshipData, "id">> = [];
  const charIds: string[] = [];

  const now = new Date().toISOString();
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!ch) continue;
    const id = `${projectId}-char-${i + 1}`;
    charIds.push(id);
    characterStore.set(id, {
      ...ch,
      id,
      projectId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create relationships
  const id0 = charIds[0];
  const id1 = charIds[1];
  const id2 = charIds[2];
  const id3 = charIds[3];
  if (id0 && id1) {
    rels.push({ sourceId: id0, targetId: id1, type: "知己/恋人", description: "彼此欣赏，逐渐发展为恋人" });
  }
  if (id0 && id3) {
    rels.push({ sourceId: id0, targetId: id3, type: "发小/兄弟", description: "从小一起长大的兄弟" });
  }
  if (id0 && id2) {
    rels.push({ sourceId: id0, targetId: id2, type: "敌对", description: "陆九渊暗中针对沈家" });
  }
  if (id1 && id2) {
    rels.push({ sourceId: id1, targetId: id2, type: "师叔侄", description: "表面的宗门长辈关系" });
  }

  for (let i = 0; i < rels.length; i++) {
    const r = rels[i];
    if (!r) continue;
    const relId = `${projectId}-rel-${i + 1}`;
    relationshipStore.set(relId, { ...r, id: relId });
  }
}

export function createCharactersRoute() {
  const route = new Hono();

  /** GET / — 列出所有角色 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const hasData = Array.from(characterStore.values()).some(
      (ch) => ch.projectId === projectId,
    );
    if (!hasData) seedDemoCharacters(projectId);

    const characters = Array.from(characterStore.values())
      .filter((ch) => ch.projectId === projectId)
      .sort((a, b) => {
        const roleOrder = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };
        return roleOrder[a.role] - roleOrder[b.role];
      });

    return c.json({ characters, total: characters.length });
  });

  /** POST / — 新增角色 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const body = await c.req.json<{
      name: string;
      role?: CharacterData["role"];
      description?: string;
      personality?: string;
      background?: string;
      goals?: string[];
      dna?: CharacterDNA | null;
    }>();

    if (!body.name) return c.json({ error: "name is required" }, 400);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const character: CharacterData = {
      id,
      projectId,
      name: body.name,
      aliases: [],
      role: body.role ?? "minor",
      description: body.description ?? "",
      personality: body.personality ?? "",
      background: body.background ?? "",
      goals: body.goals ?? [],
      firstAppearance: null,
      arc: null,
      profileContent: null,
      dna: body.dna ?? null,
      createdAt: now,
      updatedAt: now,
    };

    characterStore.set(id, character);
    log.info({ id, name: body.name }, "Character created");

    return c.json(character, 201);
  });

  /** GET /graph — 关系图数据 (§5.3.7) */
  route.get("/graph", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) return c.json({ error: "Missing project ID" }, 400);

    const hasData = Array.from(characterStore.values()).some(
      (ch) => ch.projectId === projectId,
    );
    if (!hasData) seedDemoCharacters(projectId);

    const characters = Array.from(characterStore.values()).filter(
      (ch) => ch.projectId === projectId,
    );

    const roleColors: Record<string, string> = {
      protagonist: "#e53e3e",
      antagonist: "#805ad5",
      supporting: "#3182ce",
      minor: "#718096",
    };

    const nodes = characters.map((ch) => ({
      id: ch.id,
      label: ch.name,
      role: ch.role,
      color: roleColors[ch.role] ?? "#718096",
    }));

    const edges = Array.from(relationshipStore.values())
      .filter((r) => {
        const src = characterStore.get(r.sourceId);
        return src?.projectId === projectId;
      })
      .map((r) => ({
        id: r.id,
        source: r.sourceId,
        target: r.targetId,
        label: r.type,
        description: r.description,
      }));

    return c.json({ nodes, edges });
  });

  /** GET /:charId — 获取角色详情 */
  route.get("/:charId", (c) => {
    const charId = c.req.param("charId");
    const character = characterStore.get(charId);
    if (!character) return c.json({ error: "Character not found" }, 404);
    return c.json(character);
  });

  /** PUT /:charId — 更新角色 */
  route.put("/:charId", async (c) => {
    const charId = c.req.param("charId");
    const existing = characterStore.get(charId);
    if (!existing) return c.json({ error: "Character not found" }, 404);

    const body = await c.req.json<Partial<CharacterData>>();
    const updated: CharacterData = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    characterStore.set(charId, updated);
    log.info({ charId, name: updated.name }, "Character updated");

    return c.json(updated);
  });

  /** DELETE /:charId — 删除角色 */
  route.delete("/:charId", (c) => {
    const charId = c.req.param("charId");
    if (!characterStore.has(charId)) {
      return c.json({ error: "Character not found" }, 404);
    }

    characterStore.delete(charId);
    // Also remove relationships involving this character
    for (const [relId, rel] of relationshipStore) {
      if (rel.sourceId === charId || rel.targetId === charId) {
        relationshipStore.delete(relId);
      }
    }

    log.info({ charId }, "Character deleted");
    return c.json({ deleted: true });
  });

  return route;
}
