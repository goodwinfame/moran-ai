/**
 * /api/projects/:id/analysis — 析典分析任务路由
 *
 * POST   /                    — 提交新分析任务
 * GET    /                    — 列出项目所有分析记录
 * GET    /:analysisId         — 获取分析详情（含九维报告）
 * POST   /:analysisId/settle  — 将分析中提取的技法沉淀到知识库
 * GET    /compare             — 多作品同维度对比
 * GET    /:analysisId/export  — 导出分析报告（Markdown）
 */

import { Hono } from "hono";

// ── Types ──────────────────────────────────────────

/** 九大分析维度 */
export type AnalysisDimension =
  | "narrative_structure"
  | "character_design"
  | "world_building"
  | "foreshadowing"
  | "pacing_tension"
  | "shuanggan_mechanics"
  | "style_fingerprint"
  | "dialogue_voice"
  | "chapter_hooks";

export const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  narrative_structure: "① 叙事结构分析",
  character_design: "② 角色设计技法",
  world_building: "③ 世界观构建",
  foreshadowing: "④ 伏笔与线索",
  pacing_tension: "⑤ 节奏与张力",
  shuanggan_mechanics: "⑥ 爽感机制",
  style_fingerprint: "⑦ 文风指纹",
  dialogue_voice: "⑧ 对话与声音",
  chapter_hooks: "⑨ 章末钩子",
};

export const ALL_DIMENSIONS: AnalysisDimension[] = [
  "narrative_structure",
  "character_design",
  "world_building",
  "foreshadowing",
  "pacing_tension",
  "shuanggan_mechanics",
  "style_fingerprint",
  "dialogue_voice",
  "chapter_hooks",
];

/** 维度分析结果 */
export interface DimensionResult {
  dimension: AnalysisDimension;
  label: string;
  /** Markdown 格式分析内容 */
  content: string;
  /** 可操作建议 */
  actionableInsights: string[];
  /** 适用的消费方 Agent */
  consumers: string[];
}

/** 提取的写作技法 */
export interface WritingTechnique {
  id: string;
  title: string;
  description: string;
  /** 来源维度 */
  sourceDimension: AnalysisDimension;
  /** 分类 */
  category: "writing_technique" | "genre_knowledge" | "style_guide" | "reference_analysis";
  /** 是否已沉淀到知识库 */
  settled: boolean;
}

/** 作品元数据 */
export interface WorkMetadata {
  title: string;
  author: string;
  tags: string[];
  synopsis: string;
  wordCount?: number;
  rating?: number;
  platform?: string;
}

/** 分析任务状态 */
export type AnalysisStatus = "pending" | "searching" | "analyzing" | "reporting" | "settling" | "completed" | "failed";

/** 分析进度 */
export interface AnalysisProgressData {
  stage: "search" | "analyze" | "report" | "settle";
  dimension?: AnalysisDimension;
  message: string;
  /** 0-1 */
  progress: number;
  /** 已完成的维度 */
  completedDimensions: AnalysisDimension[];
}

/** 提交分析的请求体 */
export interface SubmitAnalysisRequest {
  workTitle: string;
  authorName?: string;
  userNotes?: string;
  /** 粘贴的文本片段 */
  providedTexts?: string[];
  /** 指定分析维度（默认全部九维） */
  dimensions?: AnalysisDimension[];
}

/** 分析任务记录 */
export interface AnalysisRecord {
  id: string;
  projectId: string;
  /** 作品信息 */
  work: WorkMetadata;
  /** 分析状态 */
  status: AnalysisStatus;
  /** 各维度分析结果 */
  dimensions: DimensionResult[];
  /** 提取的写作技法 */
  techniques: WritingTechnique[];
  /** 综合摘要 */
  overallSummary: string;
  /** 分析进度 */
  progress: AnalysisProgressData;
  /** LLM 用量 */
  totalUsage: { inputTokens: number; outputTokens: number };
  createdAt: string;
  updatedAt: string;
}

/** 对比视图请求 */
export interface CompareRequest {
  analysisIds: string[];
  dimension: AnalysisDimension;
}

/** 对比条目 */
export interface CompareEntry {
  analysisId: string;
  workTitle: string;
  dimension: AnalysisDimension;
  label: string;
  content: string;
  actionableInsights: string[];
}

// ── In-memory store ────────────────────────────────

const analysisStore = new Map<string, AnalysisRecord>();

function storeKey(projectId: string, analysisId: string) {
  return `${projectId}:${analysisId}`;
}

// ── Demo data generators ────────────────────────────

function generateDemoAnalysis(projectId: string, workTitle: string, authorName?: string): AnalysisRecord {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const dimensions: DimensionResult[] = ALL_DIMENSIONS.map((dim) => ({
    dimension: dim,
    label: DIMENSION_LABELS[dim],
    content: generateDimContent(dim, workTitle),
    actionableInsights: generateInsights(dim),
    consumers: getConsumers(dim),
  }));

  const techniques: WritingTechnique[] = [
    {
      id: crypto.randomUUID(),
      title: "多线叙事交织",
      description: `《${workTitle}》采用三线并进的叙事结构，主线和两条副线在高潮处交汇，产生强烈的戏剧张力。每条线索独立运行又互相影响，读者的预期不断被打破和重建。`,
      sourceDimension: "narrative_structure",
      category: "writing_technique",
      settled: false,
    },
    {
      id: crypto.randomUUID(),
      title: "角色缺陷驱动情节",
      description: `角色的核心缺陷不仅是性格标签，更是推动情节发展的引擎。主角的执念导致了三次重大决策失误，每次失误都将故事推向新的方向，避免了"角色是情节工具"的通病。`,
      sourceDimension: "character_design",
      category: "writing_technique",
      settled: false,
    },
    {
      id: crypto.randomUUID(),
      title: "契诃夫之枪的变体运用",
      description: `伏笔不仅是"前文埋线，后文回收"的简单模式。作品中多次使用"假契诃夫之枪"——看似伏笔的元素最终揭示为红鲱鱼，真正的伏笔藏在读者习以为常的日常描写中。`,
      sourceDimension: "foreshadowing",
      category: "writing_technique",
      settled: false,
    },
    {
      id: crypto.randomUUID(),
      title: "节奏松紧的量化控制",
      description: `高潮场景的动作句平均长度控制在12字以内，而抒情段落平均超过25字。这种有意识的句长控制直接影响了阅读节奏，配合段落长度变化制造出电影般的镜头感。`,
      sourceDimension: "pacing_tension",
      category: "style_guide",
      settled: false,
    },
    {
      id: crypto.randomUUID(),
      title: "悬念钩子的四种变体",
      description: `章末钩子不局限于悬念，而是灵活运用四种变体：悬念型（未完的危机）、反转型（认知颠覆）、情感型（情感高点戛然而止）、预示型（看似无关的一句暗语）。`,
      sourceDimension: "chapter_hooks",
      category: "genre_knowledge",
      settled: false,
    },
  ];

  return {
    id,
    projectId,
    work: {
      title: workTitle,
      author: authorName ?? "未知作者",
      tags: ["玄幻", "长篇", "男频"],
      synopsis: `《${workTitle}》是一部融合了多种元素的作品，以精巧的叙事结构和深刻的人物塑造著称。`,
      wordCount: 3_500_000,
      rating: 8.6,
      platform: "起点中文网",
    },
    status: "completed",
    dimensions,
    techniques,
    overallSummary: generateOverallSummary(workTitle),
    progress: {
      stage: "settle",
      message: "分析完成",
      progress: 1,
      completedDimensions: [...ALL_DIMENSIONS],
    },
    totalUsage: { inputTokens: 245_000, outputTokens: 68_000 },
    createdAt: now,
    updatedAt: now,
  };
}

function generateDimContent(dim: AnalysisDimension, workTitle: string): string {
  const templates: Record<AnalysisDimension, string> = {
    narrative_structure: `## 叙事结构分析\n\n《${workTitle}》采用**多线交织的递进式结构**。\n\n### 宏观结构\n- 三幕式大框架（出发→试炼→回归），但在传统框架内嵌套了多个子环\n- 全文分4个大弧段，每弧段12-15章，弧段间有2-3章过渡缓冲\n\n### 叙事视角\n- 主体采用第三人称有限视角，绑定主角\n- 关键章节切换至配角视角，用于信息补全和悬念制造\n- 视角切换频率随剧情紧凑度提高\n\n### 时间处理\n- 线性为主，偶有插叙（角色回忆），插叙长度严格控制在800字以内\n- 时间压缩用于训练/旅途等重复性场景\n- 高潮场景采用慢镜头叙事，1分钟内事件展开超过3000字`,
    character_design: `## 角色设计技法\n\n### 核心角色分析\n- 主角具备清晰的WANT-NEED矛盾：表面追求力量/地位，内心渴望被认可和归属\n- 角色弧光非线性：不是一路成长，而是经历两次重大回退（第28章、第52章）\n\n### 配角体系\n- 采用"功能+情感"双重设计——每个配角既推动情节，又映射主角内心某个侧面\n- 反派不是"绝对恶"，而是"另一种选择"的具象化\n\n### 声音辨识度\n- 每个角色有独特的口头禅、思维模式和行为习惯\n- 对话不加角色名也能辨识说话者`,
    world_building: `## 世界观构建\n\n### 力量体系\n- 硬魔法倾向：规则清晰、代价明确、与剧情紧密绑定\n- Sanderson第一定律高度遵循：魔法限制比魔法能力更重要\n\n### 社会结构\n- 多方势力博弈：至少5个主要派系，各有利益诉求\n- 经济系统存在且影响剧情（不是纯粹的武力至上）\n\n### 设定信息释放\n- 采用"冰山策略"：已展示设定约占总设定的40%\n- 设定通过角色行为自然展现，而非旁白解说`,
    foreshadowing: `## 伏笔与线索\n\n### 伏笔层次\n- **表层伏笔**（3-5章回收）：道具、对话暗示\n- **中层伏笔**（10-20章回收）：人物关系、势力布局\n- **深层伏笔**（跨弧段回收）：世界观真相、角色身世\n\n### 技法特色\n- 红鲱鱼使用频率恰当（约占伏笔总量的20%）\n- 伏笔回收时常有"二次反转"——读者以为猜到了，实际还有更深一层\n- 日常描写中暗藏伏笔，不突兀`,
    pacing_tension: `## 节奏与张力\n\n### 张力曲线\n- 整体遵循"波浪递增"模式，每一波的峰值高于上一波\n- 低谷期不空转，用于角色建设和伏笔铺设\n\n### 场景节奏\n- 动作场景：短句为主，每段≤100字，画面感强\n- 过渡场景：适度描写，避免流水账\n- 情感场景：长句+留白，给读者呼吸空间\n\n### 章节节奏\n- 章节长度波动控制在均值的±20%\n- 紧张章节倾向短小精悍（2500字），舒缓章节允许更长（4000字）`,
    shuanggan_mechanics: `## 爽感机制\n\n### 核心爽点\n- 实力碾压的递进展示：每次升级后有一个"牛刀小试"场景\n- 打脸流的高级变体：不是无脑打脸，而是通过信息差制造反转\n- 智商在线：主角的胜利来自谋略而非单纯力量\n\n### 爽感节奏\n- 每5-7章至少一个小爽点\n- 每弧段结尾有一个大爽点\n- 爽点之间用困境和压力蓄势\n\n### 避免的陷阱\n- 没有无限升级：力量天花板清晰，避免数值膨胀\n- 配角不是纸板人：反派有自己的逻辑和底线`,
    style_fingerprint: `## 文风指纹\n\n### 句式特征\n- 动作描写偏好短促有力的独立句\n- 心理描写倾向使用自由间接引语\n- 几乎不用"他想"、"他认为"等心理标签词\n\n### 修辞风格\n- 比喻新鲜，避免"犹如xxx般"的套路比喻\n- 偏好通感修辞（视觉→触觉、听觉→味觉）\n- 幽默感通过角色间的自然互动实现，而非叙述者的旁白\n\n### 可读性\n- 平均句长：18字（在网文中偏短，阅读节奏快）\n- 对话叙述比：约45%（对话量充足但不过度）`,
    dialogue_voice: `## 对话与声音\n\n### 角色声音辨识\n- 每个主要角色有独特的语言习惯和用词风格\n- 同一信息由不同角色传达时，表达方式明显不同\n\n### 对话功能\n- 对话承载信息传递、关系展示和节奏调节三重功能\n- 避免"独白式对话"——没有角色突然长篇大论解释设定\n\n### 潜台词\n- 高冲突场景中大量使用潜台词，角色说的和想的不一致\n- 通过对话中的微妙变化暗示角色情感波动`,
    chapter_hooks: `## 章末钩子\n\n### 钩子类型分布\n- **悬念型**（40%）：未解决的危机、突发事件\n- **反转型**（25%）：信息颠覆、身份揭示\n- **情感型**（20%）：情感高点或低谷的戛然而止\n- **预示型**（15%）：看似平淡实则暗藏玄机\n\n### 技法特色\n- 钩子强度与章节位置相关：弧段中期最强，过渡章节适当柔和\n- 避免"假钩子"——不会用下一章前几段就化解的伪悬念来骗翻页\n- 部分钩子跨多章回收，形成"钩子链"效果`,
  };
  return templates[dim];
}

function generateInsights(dim: AnalysisDimension): string[] {
  const insightsMap: Record<AnalysisDimension, string[]> = {
    narrative_structure: [
      "弧段间的2-3章过渡区可以用于伏笔铺设和角色关系深化",
      "视角切换不超过全文15%，避免分散读者注意力",
    ],
    character_design: [
      "角色弧光设计时预设2次以上回退点，增加真实感",
      "配角的功能性和情感性权重应该大致均衡",
    ],
    world_building: [
      "设定展示遵循'冰山策略'，已展示部分不超过50%",
      "经济/政治系统需要对剧情产生实际影响",
    ],
    foreshadowing: [
      "三层伏笔结构：表层(3-5章)、中层(10-20章)、深层(跨弧段)",
      "红鲱鱼占比控制在15-25%",
    ],
    pacing_tension: [
      "动作场景段落≤100字，情感场景适当放长",
      "章节长度波动控制在均值±20%",
    ],
    shuanggan_mechanics: [
      "每5-7章安排一个小爽点，弧段结尾安排大爽点",
      "爽点前需要充分蓄势，避免空中楼阁",
    ],
    style_fingerprint: [
      "心理描写优先使用自由间接引语而非心理标签",
      "比喻追求新鲜感，避免套路化修辞",
    ],
    dialogue_voice: [
      "对话承载三重功能：信息传递+关系展示+节奏调节",
      "高冲突场景用潜台词替代直白表达",
    ],
    chapter_hooks: [
      "钩子类型分布建议：悬念40%、反转25%、情感20%、预示15%",
      "弧段中期钩子强度最高，过渡章节适当柔和",
    ],
  };
  return insightsMap[dim];
}

function getConsumers(dim: AnalysisDimension): string[] {
  const map: Record<AnalysisDimension, string[]> = {
    narrative_structure: ["lingxi", "jiangxin"],
    character_design: ["lingxi", "jiangxin", "zhibi"],
    world_building: ["lingxi", "zhibi"],
    foreshadowing: ["lingxi", "jiangxin", "bowen"],
    pacing_tension: ["zhibi", "mingjing"],
    shuanggan_mechanics: ["lingxi", "zhibi"],
    style_fingerprint: ["zhibi", "mingjing"],
    dialogue_voice: ["zhibi", "mingjing"],
    chapter_hooks: ["zhibi", "jiangxin"],
  };
  return map[dim];
}

function generateOverallSummary(workTitle: string): string {
  return `# ${workTitle} 综合分析报告

## 核心优势

1. **叙事结构精巧**：多线交织的递进式结构，弧段划分清晰，过渡自然。视角运用灵活但不混乱。
2. **角色塑造立体**：角色具有清晰的内在矛盾（WANT vs NEED），弧光设计包含回退点，增强真实感。
3. **伏笔技巧成熟**：三层伏笔体系运作良好，红鲱鱼使用恰当，伏笔回收带有二次反转。
4. **节奏控制精准**：动作/情感/过渡场景节奏分明，章节长度波动合理。

## 可改进方向

1. 世界观中经济体系的展示可以更自然
2. 部分中期章节的爽感密度略低
3. 少数配角的声音辨识度有待加强

## 核心写作智慧

> 好的故事不是"发生了什么"，而是"为什么读者在意发生了什么"。角色的内在矛盾是读者代入的锚点，伏笔是维持好奇心的钩子，节奏是控制阅读体验的呼吸。三者缺一不可。`;
}

// ── 预生成 demo 数据 ────────────────────────────────

function seedDemoData(projectId: string) {
  const demo1 = generateDemoAnalysis(projectId, "大奉打更人", "卖报小郎君");
  const demo2 = generateDemoAnalysis(projectId, "诡秘之主", "爱潜水的乌贼");
  // Make demo2 older
  demo2.createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  analysisStore.set(storeKey(projectId, demo1.id), demo1);
  analysisStore.set(storeKey(projectId, demo2.id), demo2);
}

// ── Route factory ────────────────────────────────

export function createAnalysisRoute() {
  const route = new Hono();

  // Seed demo data on first request
  let seeded = false;

  /** GET / — 列出所有分析记录 */
  route.get("/", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    if (!seeded) {
      seedDemoData(projectId);
      seeded = true;
    }

    const records: AnalysisRecord[] = [];
    for (const [key, val] of analysisStore.entries()) {
      if (key.startsWith(`${projectId}:`)) {
        records.push(val);
      }
    }

    // Sort by createdAt desc
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({
      analyses: records.map((r) => ({
        id: r.id,
        workTitle: r.work.title,
        author: r.work.author,
        status: r.status,
        dimensionCount: r.dimensions.length,
        techniqueCount: r.techniques.length,
        createdAt: r.createdAt,
      })),
      total: records.length,
    });
  });

  /** GET /compare — 多作品同维度对比 */
  route.get("/compare", (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const ids = c.req.query("ids")?.split(",") ?? [];
    const dimension = c.req.query("dimension") as AnalysisDimension | undefined;

    if (ids.length < 2 || !dimension) {
      return c.json({ error: "Need at least 2 analysis IDs and a dimension" }, 400);
    }

    const entries: CompareEntry[] = [];
    for (const aId of ids) {
      const record = analysisStore.get(storeKey(projectId, aId));
      if (!record) continue;

      const dimResult = record.dimensions.find((d) => d.dimension === dimension);
      if (dimResult) {
        entries.push({
          analysisId: aId,
          workTitle: record.work.title,
          dimension: dimResult.dimension,
          label: dimResult.label,
          content: dimResult.content,
          actionableInsights: dimResult.actionableInsights,
        });
      }
    }

    return c.json({ entries, dimension, label: DIMENSION_LABELS[dimension] });
  });

  /** GET /:analysisId — 获取分析详情 */
  route.get("/:analysisId", (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const record = analysisStore.get(storeKey(projectId, analysisId));
    if (!record) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    return c.json(record);
  });

  /** POST / — 提交新分析任务 */
  route.post("/", async (c) => {
    const projectId = c.req.param("id");
    if (!projectId) {
      return c.json({ error: "Missing project ID" }, 400);
    }

    const body = await c.req.json<SubmitAnalysisRequest>();
    if (!body.workTitle?.trim()) {
      return c.json({ error: "workTitle is required" }, 400);
    }

    // In dev mode, generate demo analysis instantly
    const record = generateDemoAnalysis(projectId, body.workTitle, body.authorName);
    analysisStore.set(storeKey(projectId, record.id), record);

    return c.json(record, 201);
  });

  /** POST /:analysisId/settle — 沉淀技法到知识库 */
  route.post("/:analysisId/settle", async (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const record = analysisStore.get(storeKey(projectId, analysisId));
    if (!record) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    const body = await c.req.json<{ techniqueIds?: string[] }>().catch(() => ({} as { techniqueIds?: string[] }));
    const techniqueIds = body.techniqueIds;

    // Mark specified techniques (or all) as settled
    let settledCount = 0;
    for (const tech of record.techniques) {
      if (!techniqueIds || techniqueIds.includes(tech.id)) {
        if (!tech.settled) {
          tech.settled = true;
          settledCount++;
        }
      }
    }

    record.updatedAt = new Date().toISOString();
    analysisStore.set(storeKey(projectId, record.id), record);

    return c.json({ settledCount, totalTechniques: record.techniques.length });
  });

  /** GET /:analysisId/export — 导出分析报告（Markdown） */
  route.get("/:analysisId/export", (c) => {
    const projectId = c.req.param("id");
    const analysisId = c.req.param("analysisId");
    if (!projectId || !analysisId) {
      return c.json({ error: "Missing project ID or analysis ID" }, 400);
    }

    const record = analysisStore.get(storeKey(projectId, analysisId));
    if (!record) {
      return c.json({ error: "Analysis not found" }, 404);
    }

    const md = exportToMarkdown(record);

    const encodedName = encodeURIComponent(`${record.work.title}-analysis.md`);
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
    return c.body(md);
  });

  return route;
}

// ── Export helper ────────────────────────────────

function exportToMarkdown(record: AnalysisRecord): string {
  const lines: string[] = [];

  lines.push(`# 《${record.work.title}》九维分析报告`);
  lines.push("");
  lines.push(`> 作者：${record.work.author} | 分析时间：${record.createdAt}`);
  lines.push(`> 标签：${record.work.tags.join("、")} | 评分：${record.work.rating ?? "N/A"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Overall summary
  lines.push(record.overallSummary);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Each dimension
  for (const dim of record.dimensions) {
    lines.push(dim.content);
    lines.push("");
    if (dim.actionableInsights.length > 0) {
      lines.push("**可操作建议：**");
      for (const insight of dim.actionableInsights) {
        lines.push(`- ${insight}`);
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  // Techniques
  if (record.techniques.length > 0) {
    lines.push("## 提取的写作技法");
    lines.push("");
    for (const tech of record.techniques) {
      lines.push(`### ${tech.title}`);
      lines.push("");
      lines.push(tech.description);
      lines.push("");
      lines.push(`_来源维度：${DIMENSION_LABELS[tech.sourceDimension]}_`);
      lines.push("");
    }
  }

  // Usage
  lines.push("---");
  lines.push("");
  lines.push(`_总用量：输入 ${record.totalUsage.inputTokens.toLocaleString()} tokens，输出 ${record.totalUsage.outputTokens.toLocaleString()} tokens_`);

  return lines.join("\n");
}
