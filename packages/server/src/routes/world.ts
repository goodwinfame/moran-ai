/**
 * /api/projects/:id/world — 世界观设定 CRUD
 *
 * GET    /                — 列出所有子系统/设定
 * POST   /                — 新增子系统/设定
 * GET    /:settingId      — 获取单条设定详情
 * PUT    /:settingId      — 更新设定
 * DELETE /:settingId      — 删除设定
 */

import { Hono } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("world-routes");

/**
 * 世界设定条目 — 对应 §6 world_settings 表
 */
export interface WorldSettingData {
  id: string;
  projectId: string;
  section: string;
  name: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 内存存储 — key: id
const worldStore = new Map<string, WorldSettingData>();

// 预填充演示数据
function seedDemoWorld(projectId: string): void {
  const sections = [
    {
      section: "rules",
      name: "基础法则",
      content:
        "这是一个以灵气为基础的修仙世界。\n\n## 核心规则\n\n1. **灵气浓度**决定修炼速度，不同地域灵气浓度差异巨大\n2. **功法品级**分为：凡、黄、玄、地、天、仙\n3. **境界划分**：炼气→筑基→金丹→元婴→化神→渡劫→大乘\n4. 每个大境界内分前中后三期\n5. 突破瓶颈需要天材地宝辅助或顿悟",
    },
    {
      section: "subsystem:power",
      name: "修炼体系",
      content:
        "## 灵根体系\n\n修炼者需具备灵根才能感应天地灵气。灵根分为：\n- **天灵根**（单属性）：修炼速度最快，极其稀有\n- **异灵根**（变异属性）：雷灵根、冰灵根等，各有特殊优势\n- **双灵根**：较为常见，修炼速度中等\n- **三灵根/杂灵根**：修炼困难，但可通过特殊功法弥补\n\n## 战斗体系\n\n法术分为：攻击、防御、辅助、阵法四大类。\n高阶修士可领悟\"领域\"，在领域内拥有压制性优势。",
    },
    {
      section: "subsystem:social",
      name: "社会结构",
      content:
        "## 宗门制度\n\n修仙界以宗门为核心组织形式：\n- **一品宗门**：拥有化神期以上强者坐镇，掌控一方\n- **二品宗门**：元婴期为最高战力\n- **三品宗门**：金丹期为最高战力\n- **散修联盟**：无宗门归属的修士松散组织\n\n## 凡人社会\n\n凡人王朝受修仙宗门庇护，定期向宗门输送灵根弟子。部分凡人家族与修仙家族通婚以获取资源。",
    },
    {
      section: "subsystem:geography",
      name: "地理环境",
      content:
        "## 三界格局\n\n- **凡界**：灵气稀薄，适合炼气到金丹期修炼\n- **灵界**：灵气充裕，元婴期及以上修士聚集\n- **仙界**：传说中渡劫飞升后的去处\n\n## 凡界五域\n\n1. **东荒**：荒凉之地，隐藏上古遗迹\n2. **南疆**：毒虫妖兽横行，炼体修士圣地\n3. **西漠**：沙漠戈壁，散修联盟总部所在\n4. **北冥**：极寒之地，冰属性灵脉聚集\n5. **中州**：最繁华的核心区域，各大宗门林立",
    },
    {
      section: "subsystem:economy",
      name: "经济体系",
      content:
        "## 货币\n\n- **灵石**：修仙界通用货币，分下品、中品、上品、极品\n- 1中品 = 100下品，1上品 = 100中品\n- 凡人使用金银铜钱\n\n## 交易场所\n\n- **坊市**：宗门或城池内的固定交易市场\n- **拍卖会**：高阶灵材、秘法的竞拍\n- **黑市**：禁忌之物的交易场所",
    },
  ];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!s) continue;
    const id = `${projectId}-ws-${i + 1}`;
    const now = new Date().toISOString();
    worldStore.set(id, {
      id,
      projectId,
      section: s.section,
      name: s.name,
      content: s.content,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function createWorldRoute() {
  const route = new Hono();

  /** GET / — 列出项目的所有世界设定 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    // Lazily seed demo data
    const hasData = Array.from(worldStore.values()).some(
      (w) => w.projectId === projectId,
    );
    if (!hasData) {
      seedDemoWorld(projectId);
    }

    const settings = Array.from(worldStore.values())
      .filter((w) => w.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return c.json({ settings, total: settings.length });
  });

  /** POST / — 新增设定 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<{
      section: string;
      name: string;
      content: string;
      sortOrder?: number;
    }>();

    if (!body.section || !body.name || !body.content) {
      return c.json({ error: "section, name, and content are required" }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const setting: WorldSettingData = {
      id,
      projectId,
      section: body.section,
      name: body.name,
      content: body.content,
      sortOrder: body.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    worldStore.set(id, setting);
    log.info({ id, section: body.section, name: body.name }, "World setting created");

    return c.json(setting, 201);
  });

  /** GET /:settingId — 获取单条设定 */
  route.get("/:settingId", (c) => {
    const settingId = c.req.param("settingId");
    const setting = worldStore.get(settingId);
    if (!setting) {
      return c.json({ error: "World setting not found" }, 404);
    }
    return c.json(setting);
  });

  /** PUT /:settingId — 更新设定 */
  route.put("/:settingId", async (c) => {
    const settingId = c.req.param("settingId");
    const existing = worldStore.get(settingId);
    if (!existing) {
      return c.json({ error: "World setting not found" }, 404);
    }

    const body = await c.req.json<Partial<WorldSettingData>>();
    const updated: WorldSettingData = {
      ...existing,
      ...body,
      id: existing.id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    worldStore.set(settingId, updated);
    log.info({ settingId }, "World setting updated");

    return c.json(updated);
  });

  /** DELETE /:settingId — 删除设定 */
  route.delete("/:settingId", (c) => {
    const settingId = c.req.param("settingId");
    if (!worldStore.has(settingId)) {
      return c.json({ error: "World setting not found" }, 404);
    }

    worldStore.delete(settingId);
    log.info({ settingId }, "World setting deleted");

    return c.json({ deleted: true });
  });

  return route;
}
