/**
 * 析典 (xidian) — 九维分析 Prompt 模板
 *
 * 每个维度对应一个或多个学术理论框架，确保分析有章可循、可复现、有深度。
 * 设计原则：理论驱动而非自由总结。
 */

import type { AnalysisDimension } from "./types.js";
import { DIMENSION_LABELS } from "./types.js";

// ── System Prompt ──────────────────────────────────

export const XIDIAN_SYSTEM_PROMPT = `你是"析典"——一位深谙叙事学、文体学和网文研究的文学分析师。你的分析必须：

1. 基于明确的学术理论框架，每个结论都能追溯到具体理论
2. 提供量化指标（比率、频率、分布），不只是定性描述
3. 区分"事实观察"和"分析推论"
4. 产出可操作的建议——不是笼统的"写得好"，而是"具体怎么好、怎么学"
5. 输出严格按照要求的格式，不附加无关内容`;

export const XIDIAN_SEARCH_PROMPT = `你是"析典"的搜索助手。你的任务是收集分析参考作品所需的素材。

## 搜索策略
1. 先搜索作品名 + "写作分析/书评/技巧"，找已有的深度分析
2. 搜索作品名 + "评论/评价"，找读者反馈
3. 搜索作者名 + "写作风格/创作手法"，找作者相关分析
4. 如有网文平台信息，获取元数据（标签、字数、评分）

## 输出要求
以 JSON 格式返回，包含 metadata 和 materials 两个字段。`;

export const XIDIAN_SETTLE_PROMPT = `你是"析典"的知识提炼师。你的任务是将分析报告中的关键发现提炼为散文式知识库条目。

## 提炼规则
1. 每条知识 ≤800 tokens
2. 使用散文式自然语言，不要用列表或表格
3. 聚焦"怎么做"而非"是什么"——面向写作实践
4. 标注适用的消费方 Agent（灵犀/匠心/执笔/明镜/博闻）
5. 避免过度依赖具体作品细节——提炼为通用可复用的技法

## 输出格式
JSON 数组，每个元素包含 title, content, category, consumers 字段。`;

// ── 搜索 Prompt ──────────────────────────────────

export function buildSearchPrompt(
  workTitle: string,
  authorName?: string,
  userNotes?: string,
): string {
  const authorPart = authorName ? `\n作者：${authorName}` : "";
  const notesPart = userNotes ? `\n用户补充说明：${userNotes}` : "";

  return `请收集以下作品的分析素材：

## 目标作品
作品名：${workTitle}${authorPart}${notesPart}

## 请搜索并收集以下信息，以 JSON 格式返回：

\`\`\`json
{
  "metadata": {
    "title": "作品名",
    "author": "作者名",
    "tags": ["类型标签"],
    "synopsis": "简介(200字以内)",
    "wordCount": null,
    "rating": null,
    "platform": "发布平台"
  },
  "materials": [
    {
      "source": "来源名称",
      "type": "metadata|sample_text|review|analysis",
      "content": "素材内容",
      "url": "来源URL(如有)"
    }
  ]
}
\`\`\`

注意：
- 只获取免费/公开内容，不绕过付费墙
- 优先获取已有的深度分析文章
- 元数据尽量完整（评分、标签、字数）
- 读者评论选取有代表性的正面和负面评价`;
}

// ── 维度分析 Prompt 模板 ──────────────────────────

/** 维度专用理论框架和分析要求 */
const DIMENSION_PROMPTS: Record<AnalysisDimension, {
  theory: string;
  requirements: string;
  structuredFields: string;
}> = {
  narrative_structure: {
    theory: `## 理论框架
- **Genette 叙事话语理论** (1972)：时序(顺叙/倒叙/预叙)、时距(场景/概要/省略)、频率(单次/反复)、聚焦(零/内/外聚焦)
- **Todorov 叙事平衡理论** (1969)：平衡→失衡→认知→化解→新平衡 周期
- **Campbell 英雄之旅** (1949)：17阶段映射(召唤→跨越阈限→试炼→蜕变→归来)
- **Propp 叙事功能** (1928)：31种叙事功能和7种角色功能`,
    requirements: `1. 分析叙事时序结构——顺叙/倒叙/预叙的比例和使用场景
2. 计算叙事时距分布——场景(实时)/概要(跳跃)/省略(略过)的百分比
3. 识别聚焦模式——主要采用哪种聚焦？何时切换？切换频率？
4. 映射 Todorov 平衡周期——每个弧段的平衡-失衡-恢复周期长度
5. 如适用，映射英雄之旅阶段——标注各阶段对应的章节范围
6. 识别 Propp 叙事功能——标注关键事件对应的叙事功能类型`,
    structuredFields: `narrative_structure:
  overall_pattern: "叙事模式描述"
  focalization:
    dominant: "主要聚焦类型及占比"
    shifts: "聚焦切换模式"
  pacing_ratio:
    scene: "场景(实时叙述)占比%"
    summary: "概要(时间跳跃)占比%"
    ellipsis: "省略占比%"
  equilibrium_cycle:
    avg_disruption_to_resolution: "平均失衡到恢复的章数"
    macro_cycle: "宏观平衡周期"`,
  },

  character_design: {
    theory: `## 理论框架
- **九型人格 (Enneagram)**：Riso-Hudson 体系，含压力/成长方向线和侧翼
- **WANT/NEED/LIE/GHOST** (K.M. Weiland)：四维心理模型——表面欲望/深层需求/核心谎言/创伤根源
- **社会网络分析**：Labatut & Bost (2019)，角色互动网络的度中心性/介数中心性/派系聚类`,
    requirements: `1. 为主要角色（至少3个）建立九型人格画像——主型、侧翼、压力/成长方向
2. 为主角和核心配角推演 WANT/NEED/LIE/GHOST 四维模型
3. 分析角色网络——识别 hub 角色、桥接角色、派系聚类
4. 评估角色弧线——每个主要角色的成长/变化轨迹
5. 识别角色声音差异化——每个角色是否有独特的说话方式？
6. 分析角色关系动力学——关系的张力来源和变化驱动力`,
    structuredFields: `characters:
  protagonist:
    name: "主角名"
    enneagram: "九型人格类型"
    want: "表面欲望"
    need: "深层需求"
    lie: "核心谎言"
    ghost: "创伤根源"
  network:
    hub_characters: ["中心角色(度中心性)"]
    faction_clusters: ["派系名"]`,
  },

  world_building: {
    theory: `## 理论框架
- **Sanderson 魔法三定律** (2007-2012)：定律1(理解度↔解决力)、定律2(限制>力量)、定律3(扩展而非添加)
- **力量体系拓扑**：层级结构、相克关系、代价结构、社会嵌入度
- **政治经济世界体系** (改编自 Wallerstein)：权力节点、资源流向、冲突轴线、信息控制`,
    requirements: `1. 评估力量体系的硬/软程度——规则在使用前是否详细解释？
2. 打分 Sanderson 三定律遵守度（各项 1-10 分）
3. 分析力量体系的社会嵌入度——修为/力量如何影响社会结构？
4. 识别权力三角/多角——主要权力机构及其制衡关系
5. 分析信息不对称——信息差如何驱动冲突？
6. 评估世界观的独特性和内在一致性`,
    structuredFields: `world_building:
  power_system:
    type: "硬/软魔法程度"
    sanderson_compliance:
      law1_score: "1-10 理解度↔解决力"
      law2_score: "1-10 限制>力量"
      law3_score: "1-10 扩展而非添加"
    social_embedding: "力量与社会结构的关系"
  political_structure:
    power_nodes: ["权力节点"]
    information_asymmetry: "信息不对称分析"`,
  },

  foreshadowing: {
    theory: `## 理论框架
- **契诃夫之枪** (Chekhov, 1889)：被额外描述关注的元素必须在后文发挥作用
- **Setup-Payoff 模式** (Robert McKee, *Story*, 1997)：植入类型(问题/角色/主题)、信息门控、铺垫密度
- **红鲱鱼**：悬疑传统中的误导线索技法`,
    requirements: `1. 识别并分类伏笔类型——问题植入/角色植入/主题植入的分布
2. 计算平均铺垫-回收距离（章数）
3. 评估红鲱鱼使用率——线索/假线索比率
4. 识别"带电对象"——被额外关注但尚未回收的契诃夫之枪
5. 分析信息门控技法——秘密如何分步揭露？
6. 评估伏笔系统的整体设计质量——有无烂尾伏笔？`,
    structuredFields: `foreshadowing:
  avg_setup_payoff_distance: "平均铺垫-回收距离(章数)"
  plant_types:
    question_plants: "问题植入占比%"
    character_plants: "角色植入占比%"
    thematic_plants: "主题植入占比%"
  red_herring_rate: "红鲱鱼比率"
  signature_technique: "标志性伏笔技法"`,
  },

  pacing_tension: {
    theory: `## 理论框架
- **Scene-Sequel 节奏** (Dwight Swain, 1976)：场景(目标→冲突→灾难) / 续幕(反应→困境→决定)
- **张力曲线建模**：叙事强度理论，0-10 强度评分
- **Genette 叙事速度**：场景/概要/省略/停顿的分布和变化率`,
    requirements: `1. 分析 Scene-Sequel 比率——各弧段的 S/S 分布
2. 建模张力曲线——整体形态(阶梯式/波浪式/U型)
3. 检测平坦区域——连续低张力超过多少章？有无新冲突注入？
4. 计算高潮密度——每多少章一个大高潮？
5. 分析叙事速度变化——行动弧段 vs 过渡弧段的速度差异
6. 评估节奏控制的整体质量——有无节奏失控的区域？`,
    structuredFields: `pacing:
  scene_sequel_ratio: "场景:续幕比率"
  tension_curve:
    pattern: "张力曲线整体形态"
    flat_zones: "平坦区域特征"
    peak_density: "高潮密度(每X章一个)"
  narrative_speed:
    action_arcs: "行动弧段速度特征"
    transition_arcs: "过渡弧段速度特征"`,
  },

  shuanggan_mechanics: {
    theory: `## 理论框架
- **爽感生成体系** (刘飞宏, 2022)：四类爽点——开金手指/能力升级/扮猪吃虎/卧薪尝胆
- **金手指类型学** (陈紫琼, 2023)：主角优势获取方式分类、"作弊逻辑"分析
- **章末钩子力学**：起点中文网编辑方法论，钩子类型(冲突/情报/命运/反转)`,
    requirements: `1. 识别四类爽点的分布热图——各类爽点出现频率和分布
2. 分析爽感进化——从早期到后期爽点类型的演变
3. 评估金手指的公平感知——读者觉得主角优势合理吗？
4. 分析能力升级节奏——升级间隔、升级代价、升级爽感
5. 计算章末钩子平均强度（1-10）
6. 分析高爽感章节的共同特征——是什么让这些章节特别"爽"？`,
    structuredFields: `shuanggan_mechanics:
  dominant_types: ["爽点类型(占比%)"]
  evolution: "爽感进化路径"
  golden_finger:
    type: "金手指类型"
    fairness_perception: "公平感知评价"
  chapter_hooks:
    avg_hook_strength: "平均钩子强度(1-10)"
    hook_types: ["钩子类型(占比%)"]`,
  },

  style_fingerprint: {
    theory: `## 理论框架
- **计算文体学** (Biber, 1988)：多维分析——类型-标记比(TTR)、平均句长、功能词比率、语气词分布
- **中文可读性指数(CRIE)**：章节可读性评分
- **Burstiness 指标**：句长变异系数，反映文本节奏多样性（≥0.35 为佳）`,
    requirements: `1. 计算关键文体指标——平均句长、TTR、对话叙述比
2. 估算 Burstiness——句长变化是否足够多样？
3. 识别标志性文风特征——用3-5条总结该作品的文风指纹
4. 分析不同段落类型的风格差异——战斗/对话/描写/心理各有何特点
5. 评估词汇丰富度——TTR 和低频词使用
6. 识别语言创新——有无独特的语言使用方式？`,
    structuredFields: `style_fingerprint:
  avg_sentence_length: "平均句长(字)"
  dialogue_narrative_ratio: "对话叙述比"
  burstiness: "Burstiness 值"
  signature_features:
    - "特征1"
    - "特征2"
  vocabulary_richness:
    ttr: "类型-标记比"`,
  },

  dialogue_voice: {
    theory: `## 理论框架
- **角色声音分析**：叙事学传统 + 计算语言学——每个角色的词汇指纹(高频词/句式偏好/语气词)
- **对话归属分析** (Elson et al., 2010)：对话网络——谁和谁说话、说什么、频率`,
    requirements: `1. 为主要角色建立声音指纹——高频词、句式偏好、语气词
2. 评估角色声音差异化——去掉对话标签后能否识别说话人？
3. 分析对话网络——谁和谁交流最多？信息通过什么路径传播？
4. 评估对话功能分布——推进剧情/展现性格/传递信息/制造冲突各占多少？
5. 识别对话技巧——潜台词、信息不对称对话、双关等
6. 分析对话标签使用——是否过度依赖"说道"？有无创造性替代？`,
    structuredFields: `dialogue_voice:
  character_voices:
    - name: "角色名"
      fingerprint: "声音指纹描述"
      distinguishability: "辨识度(1-10)"
  dialogue_network:
    most_frequent_pairs: ["角色A-角色B"]
    information_hubs: ["信息中心角色"]`,
  },

  chapter_hooks: {
    theory: `## 理论框架
- **钩子类型学**：冲突悬念（未完成的对抗）、情报悬念（未揭露的信息）、命运悬念（未确定的命运）、反转悬念（颠覆预期）
- **连载力学**：网文连载的章末必须让读者"忍不住翻下一章"
- **未完成效应 (Zeigarnik Effect)**：未完成的任务比已完成的更令人记忆深刻`,
    requirements: `1. 分类章末钩子类型——冲突/情报/命运/反转各占多少？
2. 分析钩子位置——通常在结尾多少字处开始布局？
3. 量化钩子强度——基于未完成因果链数量、条件句频率、疑问频率
4. 识别高强度钩子的共同模式——什么样的钩子最有效？
5. 检测钩子疲劳——同类钩子是否过度使用导致效果递减？
6. 评估钩子与正文的关系——钩子是否有机融入而非生硬附加？`,
    structuredFields: `chapter_hooks:
  type_distribution:
    conflict: "冲突悬念占比%"
    intelligence: "情报悬念占比%"
    fate: "命运悬念占比%"
    reversal: "反转悬念占比%"
  avg_hook_strength: "平均强度(1-10)"
  hook_position: "钩子通常开始位置(结尾前X字)"
  fatigue_detected: "是否检测到钩子疲劳"`,
  },
};

// ── 构建单维度分析 Prompt ──────────────────────────

export function buildDimensionPrompt(
  dimension: AnalysisDimension,
  workTitle: string,
  materials: string,
  userNotes?: string,
): string {
  const config = DIMENSION_PROMPTS[dimension];
  const notesPart = userNotes ? `\n\n## 用户补充说明\n${userNotes}` : "";

  return `请对作品《${workTitle}》进行【${DIMENSION_LABELS[dimension]}】分析。

${config.theory}

## 分析要求
${config.requirements}

## 可用素材
${materials}${notesPart}

## 输出格式

请以 JSON 格式返回：

\`\`\`json
{
  "content": "Markdown 格式的分析正文（引用理论、提供证据、给出量化指标）",
  "structuredData": "YAML 格式的结构化数据（参考以下字段）:\\n${config.structuredFields}",
  "actionableInsights": [
    "可操作建议1（面向写作实践，不是笼统的评价）",
    "可操作建议2"
  ],
  "consumers": ["适用的消费方Agent: lingxi/jiangxin/zhibi/mingjing/bowen"]
}
\`\`\``;
}

// ── 知识沉淀 Prompt ──────────────────────────────

export function buildSettlementPrompt(
  workTitle: string,
  dimensionAnalyses: Array<{ dimension: AnalysisDimension; label: string; content: string; insights: string[] }>,
): string {
  const analyses = dimensionAnalyses
    .map((d) => `### ${d.label}\n${d.content}\n\n**可操作建议**：\n${d.insights.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n---\n\n");

  return `请将以下《${workTitle}》的分析报告提炼为知识库条目。

## 分析报告

${analyses}

## 提炼规则

1. 每条知识 ≤800 tokens，使用散文式自然语言
2. 聚焦"怎么做"——面向写作实践
3. 标注消费方: lingxi(创意脑暴) / jiangxin(世界角色设计) / zhibi(章节写作) / mingjing(审校) / bowen(知识查证)
4. 分类: writing_technique(写作技法) / genre_knowledge(题材知识) / style_guide(风格指南) / reference_analysis(参考分析)
5. 避免过度依赖具体作品细节——提炼为通用可复用的技法
6. 每个维度提炼 1-3 条（总计不超过 20 条）

## 输出格式

\`\`\`json
[
  {
    "title": "条目标题",
    "content": "散文式指南内容(≤800 tokens)",
    "category": "writing_technique|genre_knowledge|style_guide|reference_analysis",
    "consumers": ["zhibi", "mingjing"]
  }
]
\`\`\``;
}

// ── 综合摘要 Prompt ──────────────────────────────

export function buildSummaryPrompt(
  workTitle: string,
  dimensionSummaries: string,
): string {
  return `请为《${workTitle}》的九维分析生成一份综合摘要。

## 各维度分析概要

${dimensionSummaries}

## 要求

1. 字数控制在 500-800 字
2. 突出该作品最值得学习的 3-5 个核心技法
3. 指出该作品的局限性或可改进之处
4. 给出总体评价——适合什么类型的创作参考

请直接返回 Markdown 格式的摘要文本，不需要 JSON 包裹。`;
}

// ── 辅助：获取维度 Prompt 配置 ──────────────────

export function getDimensionConfig(dimension: AnalysisDimension): {
  theory: string;
  requirements: string;
  structuredFields: string;
} {
  return DIMENSION_PROMPTS[dimension];
}
