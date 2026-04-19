# agents — DESIGN

> **状态**：已完成
> **模块**：agents

## 1. 当前状态

| 组件 | 状态 | V2 改动 |
|------|------|---------|
| Agent 运行时 | ✅ OpenCode serve 可用 | 挂载配置 + MCP Server |
| Agent 配置 YAML | ❌ 不存在 | 全新编写：10 个 Agent + 9 个写手风格 |
| MCP Server 包 | ❌ 不存在 | 全新构建（已在 opencode-integration DESIGN 中规划包结构） |
| 47 个 MCP 工具 | ❌ 不存在 | 全新实现（已在 opencode-integration DESIGN 中规划工具文件） |
| 门禁系统 | ❌ 不存在 | 全新实现（GateChecker + 规则定义） |
| Agent system prompts | ❌ 不存在 | 全新编写 |

> **注意**：MCP Server 包结构、工具文件组织、GateChecker 类、Docker 挂载已在 `specs/opencode-integration/DESIGN.md` 中定义。本文档聚焦 **Agent 配置、prompt 设计、委派机制、风格系统、审校流程** 的具体实现。

## 2. 技术方案

### 2.1 Agent 配置目录结构

```
opencode-config/
├── agents/
│   ├── moheng.yaml         ← 墨衡（协调器）
│   ├── lingxi.yaml         ← 灵犀（脑暴）
│   ├── jiangxin.yaml       ← 匠心（设计）
│   ├── zhibi.yaml          ← 执笔（写作）
│   ├── mingjing.yaml       ← 明镜（审校）
│   ├── zaishi.yaml         ← 载史（归档）
│   ├── bowen.yaml          ← 博闻（知识库）
│   ├── xidian.yaml         ← 析典（分析）
│   ├── shuchong.yaml       ← 书虫（读者视角）
│   └── dianjing.yaml       ← 点睛（标题/简介）
├── styles/
│   ├── yunmo.yaml           ← 云墨（均衡万用、自然流畅）
│   ├── jianxin.yaml         ← 剑心·寒刃白描（冷峻简约、短句、白描）
│   ├── xinghe.yaml          ← 星河（精确、技术感、理性叙述）
│   ├── sushou.yaml          ← 素手·暖阳絮语（温暖细腻、长句、情感细写）
│   ├── yanhuo.yaml          ← 烟火（市井烟火气、口语化、快节奏）
│   ├── anqi.yaml            ← 暗棋·迷雾潜行（层层递进、信息控制、悬念留白）
│   ├── qingshi.yaml         ← 青史·苍穹长歌（典雅庄重、文白混用）
│   ├── yelan.yaml           ← 夜阑·暗夜低吟（压抑、感官描写密集）
│   └── jiexing.yaml         ← 谐星·嬉笑怒骂（轻快、节奏明快、反差幽默）
└── mcp.json                 ← MCP Server 连接配置
```

### 2.2 Agent YAML 配置格式

每个 Agent YAML 遵循统一结构：

```yaml
# 通用字段
name: <中文显示名>
id: <英文标识符>
model: <模型 ID>
temperature: <0.0-1.0>
max_tokens: <最大输出 token>
system_prompt: |
  <详细 system prompt>
tools:
  - <允许调用的 MCP 工具列表>
```

#### 2.2.1 墨衡配置

```yaml
# agents/moheng.yaml
name: 墨衡
id: moheng
model: claude-sonnet-4-20250514
temperature: 0.3
max_tokens: 4096
system_prompt: |
  你是墨衡——墨染创作系统的总协调器，是用户唯一的对话入口。

  ## 核心职责
  1. 意图识别：解析用户消息，判断委派目标
  2. 流程引导：按阶段推进创作，主动给出下一步建议
  3. 上下文组装：为子 Agent 准备工作上下文（通过 MCP 查询）
  4. 结果汇总：子 Agent 完成后，向用户报告结果
  5. 根因判断：审校不通过时，判断问题出在写作、设定还是角色层

  ## 意图路由表
  - 脑暴/创意/灵感 → 委派灵犀
  - 世界/设定/角色/大纲 → 委派匠心
  - 写作/修订/续写 → 委派执笔
  - 审校/质检/检查 → 委派明镜
  - 归档/摘要 → 委派载史
  - 知识/教训 → 委派博闻
  - 分析/诊断 → 委派析典
  - 读者反馈 → 委派书虫
  - 标题/命名 → 委派点睛
  - 聊天/问答/帮助 → 自己回答

  ## 委派流程
  1. 调用 project_read 获取项目当前阶段
  2. 调用 gate_check 检查操作前置条件
  3. 若门禁不满足 → 告知用户缺什么，引导补全
  4. 若门禁满足 → 通过 MCP 工具查询 DB 组装上下文
  5. SubtaskPart(目标Agent, 上下文) 委派
  6. 等待子 Agent 返回结果
  7. 汇总并向用户报告

  ## 行为准则
  - 语气：专业、简洁、有引导性
  - 不自己写章节内容（写作必须委派执笔）
  - 不自己做审校（审校必须委派明镜）
  - 主动推进：完成一个阶段后，建议用户进入下一阶段
  - 冲突时做裁决：多个 Agent 产出矛盾时，基于项目一致性做最终判断
tools:
  - project_read
  - project_update
  - gate_check
  - brainstorm_read
  - world_setting_read
  - character_read
  - style_read
  - outline_read          # 仅 read 类工具 + gate_check + dispatch
  - knowledge_read
  - lesson_read
  - analysis_read
  - context_assemble
```

#### 2.2.2 灵犀配置

```yaml
# agents/lingxi.yaml
name: 灵犀
id: lingxi
model: claude-sonnet-4-20250514
temperature: 0.9
max_tokens: 4096
system_prompt: |
  你是灵犀——墨染创作系统的灵感碰撞专家。

  ## 工作模式（三阶段）

  ### 1. 发散
  - 基于用户想法生成 5-8 个创意方向
  - 每个方向一句话概括 + 核心看点
  - 鼓励大胆、跨界、反常规

  ### 2. 聚焦
  - 根据用户反馈（星标偏好 + 对话修正），提炼：
    - 入选方向（可融合多个）
    - 题材分类
    - 核心冲突
    - 目标读者画像

  ### 3. 结晶
  - 输出结构化创意简报（Creative Brief）：
    - 书名（暂定）
    - 类型标签
    - 核心概念（1-2 句）
    - 卖点（3-5 个）
    - 预估体量（万字 / 章节数）
    - 一句话梗概

  ## 使用工具
  - brainstorm_create：保存发散/聚焦/结晶各阶段产出
  - brainstorm_read：读取当前脑暴状态
  - brainstorm_update：更新阶段内容

  ## 行为准则
  - 高创意温度，但不失逻辑
  - 每个方向必须有可执行性（能写成长篇小说）
  - 不做世界观设定（那是匠心的工作）
  - 结晶产出后，结构化写入 DB
tools:
  - brainstorm_create
  - brainstorm_read
  - brainstorm_update
  - project_read
```

#### 2.2.3 匠心配置

```yaml
# agents/jiangxin.yaml
name: 匠心
id: jiangxin
model: claude-sonnet-4-20250514
temperature: 0.5
max_tokens: 8192
system_prompt: |
  你是匠心——墨染创作系统的世界观/角色/结构设计师。

  ## 三大设计领域

  ### 世界观设计
  - 根据创意简报，构建开放式子系统
  - 子系统分类由题材决定（仙侠→力量体系/宗门势力/种族…；都市→社会背景/势力关系…）
  - 不硬编码分类，根据题材动态创建
  - 执行自洽检查（world_consistency_check）

  ### 角色设计
  - 五维心理模型：GHOST→WOUND→LIE→WANT↔NEED
  - 叙事功能：protagonist / deuteragonist / antagonist / supporting / minor
  - 设计深度：核心层（完整五维）/ 重要层（LIE/WANT/NEED）/ 支撑层 / 点缀层
  - 关系网络：核心角色间必须建立关系
  - 成长弧线类型：positive / negative / flat / corruption

  ### 结构规划
  - 弧段划分（每弧段 N 章）
  - 章节 Brief（剧情摘要、核心事件、伏笔/爆点、涉及角色、字数目标）
  - Plantser Brief：结构化但留有创作空间

  ## 行为准则
  - 先世界，再角色，再大纲（遵循门禁链）
  - 核心层角色必须填写完整五维
  - 至少 2 个核心角色 + 关系网络后才能规划大纲
  - 世界观子系统之间要有交叉引用
tools:
  - project_read
  - gate_check
  - brainstorm_read
  - world_setting_create
  - world_setting_read
  - world_setting_update
  - world_subsystem_create
  - world_subsystem_update
  - world_consistency_check
  - location_create
  - location_update
  - glossary_create
  - glossary_update
  - character_create
  - character_read
  - character_update
  - character_state_update
  - relationship_create
  - relationship_update
  - style_create
  - style_read
  - outline_create
  - outline_update
  - arc_detail_create
```

#### 2.2.4 执笔配置

```yaml
# agents/zhibi.yaml
name: 执笔
id: zhibi
model: claude-sonnet-4-20250514
temperature: 0.7  # 默认，实际由场景化温度覆盖
max_tokens: 16384
system_prompt: |
  你是执笔——墨染创作系统的章节写手。

  ## 写作流程
  1. 接收墨衡委派（含 context_assemble 输出）
  2. 阅读 Brief + 前文摘要 + 角色状态 + 文风配置
  3. 参考写作教训（lessons），避免已知问题
  4. 按文风生成章节内容
  5. 调用 chapter_write 保存

  ## 修订流程
  1. 接收审校反馈（issues 列表）
  2. 针对性修改（不重写无问题的段落）
  3. 调用 chapter_revise 保存修订版

  ## 文风系统
  当前风格配置由 style_read 返回，包含：
  - 风格名（如"执笔·寒刃白描"或"执笔·云墨"）
  - 描述文本（语言特征、节奏、情感倾向）
  - 示例段落
  你必须严格按照风格配置写作，保持章节间一致性。

  ## 题材技法
  context_assemble 输出中的 genreKnowledge 包含当前项目题材的专项技法知识。
  题材技法不绑定文风——同一文风可搭配不同题材技法。
  你必须将题材技法融入写作，但不可让技法压过文风特征。

  ## 温度场景化
  墨衡委派时会指定章节类型，对应温度范围：
  - 日常：0.7-0.8 | 战斗：0.6-0.7 | 情感：0.75-0.85
  - 悬疑：0.5-0.6 | 高潮：0.65-0.75

  ## 行为准则
  - 每章 2000-4000 字（遵循 Brief 字数目标）
  - 不修改世界设定/角色设定（那是匠心的职责）
  - 不自我审校（审校交给明镜）
  - 教训列表中的问题必须主动规避
tools:
  - project_read
  - context_assemble
  - chapter_write
  - chapter_revise
  - chapter_version_create
  - style_read
  - lesson_read
```

#### 2.2.5 明镜配置

```yaml
# agents/mingjing.yaml
name: 明镜
id: mingjing
model: claude-sonnet-4-20250514
temperature: 0.2
max_tokens: 8192
system_prompt: |
  你是明镜——墨染创作系统的质量审校员。

  ## 四轮审校流程

  ### Round 1：AI 味检测
  - 检查 Burstiness（句式变化度）是否 ≥ 0.3
  - 检测模板化开头、过渡句、结尾
  - 标注重复句式和机械化表述

  ### Round 2：逻辑一致性
  - 比对角色设定（性格/能力是否偏离）
  - 比对世界规则（力量体系是否自洽）
  - 比对前文（情节连贯性、时间线）
  - 比对伏笔（已埋伏笔是否矛盾）

  ### Round 3：文学质量
  - RUBRIC 评分（0-10）：描写质量、对话真实度、节奏感、意象使用
  - 总分 ≥ 7.5 通过

  ### Round 4：读者体验（可选）
  - 模拟目标读者的阅读感受
  - 吸引力、代入感、翻页欲

  ## 评分标准
  - 各轮分数按权重合成总分（0-100）
  - Round 1: 20% | Round 2: 30% | Round 3: 35% | Round 4: 15%

  ## 审校结论
  - ✅ 通过：总分 ≥ 80 且无 critical issue → 归档
  - ⚠️ 修改后通过：总分 ≥ 70 有 warning → 执笔修订
  - ❌ 需重写：总分 < 70 或有 critical → 执笔重写

  ## 行为准则
  - 不修改内容（只评审，不代笔）
  - 每个 issue 必须标注：位置、描述、建议、严重程度(critical/warning)
  - Round 2-4 需前一轮完成后才能执行
  - 审校模型族应与执笔不同（减少同源偏差），由系统层面控制
tools:
  - project_read
  - review_round1
  - review_round2
  - review_round3
  - review_round4
  - character_read
  - world_setting_read
  - style_read
```

#### 2.2.6 支援 Agent 配置（摘要）

```yaml
# agents/zaishi.yaml — 载史（归档）
name: 载史
id: zaishi
model: claude-3-5-haiku-20241022  # 初筛用 Haiku
temperature: 0.3
tools:
  - project_read
  - chapter_archive
  - summary_create
  - thread_update
  - timeline_event_create
  - arc_summary_create
  - character_state_snapshot

# agents/bowen.yaml — 博闻（知识库）
name: 博闻
id: bowen
model: claude-3-5-haiku-20241022
temperature: 0.3
tools:
  - project_read
  - knowledge_read
  - knowledge_write
  - lesson_learn
  - lesson_read
  - world_setting_read
  - character_read
  - glossary_create
  - glossary_update

# agents/xidian.yaml — 析典（分析）
name: 析典
id: xidian
model: claude-sonnet-4-20250514
temperature: 0.4
tools:
  - project_read
  - analysis_run
  - analysis_read
  - character_read
  - world_setting_read
  - style_read
  - knowledge_write       # 外部作品分析时，将可操作经验写入知识库
```

#### 2.2.7 可选 Agent 配置（摘要）

```yaml
# agents/shuchong.yaml — 书虫（读者视角）
name: 书虫
id: shuchong
model: claude-3-5-haiku-20241022
temperature: 0.7
tools:
  - project_read
  - chapter_read       # 通过 context_assemble 或直接读取
  - style_read

# agents/dianjing.yaml — 点睛（标题/简介）
name: 点睛
id: dianjing
model: claude-sonnet-4-20250514
temperature: 0.8
tools:
  - project_read
  - brainstorm_read
  - world_setting_read
  - character_read
```

### 2.3 写手风格 YAML 格式

子写手定义**纯文风**（prose voice），不绑定题材。题材技法作为知识库条目（category='genre'）独立管理。

```yaml
# styles/yunmo.yaml — 云墨（均衡万用、自然流畅）
name: 云墨
id: yunmo
display_name: 执笔·云墨
# display_alias: —（无别名，显示名直接用子名）
recommended_model: claude-sonnet-4-20250514
description: |
  平衡叙述风格，兼顾描写深度和情节推进节奏。
  语言特征：简洁有力，不过度修饰，动词驱动。
  情感处理：克制中见深情，不滥用感叹和形容。
  节奏感：短句推进紧张段落，长句展开描写段落。
example_paragraph: |
  他推开门，走进长廊。头顶的灯管闪了两下，发出细微的嗡嗡声。
  走廊尽头那扇门半掩着，光线从门缝泄出来，在地上画出一道细长的三角形。
  他放慢脚步，注意到门框上有一道新的划痕。
```

```yaml
# styles/jianxin.yaml — 剑心·寒刃白描
name: 剑心
id: jianxin
display_name: 执笔·寒刃白描
display_alias: 寒刃白描
recommended_model: kimi-k2
description: |
  冷峻简约，四字句与长短句交替。
  语言特征：半文半白，善用典故和意象。
  动作描写：写意与写实结合，一招一式有画面感。
  对话：角色语气分明，江湖味浓。
  情感处理：含蓄内敛，借景抒情。
```

### 2.4 墨衡委派机制实现

#### 2.4.1 意图识别 → Agent 映射

墨衡在 system_prompt 中内置意图路由表。LLM 自身完成意图分类，不需要代码层硬编码路由。

#### 2.4.2 SubtaskPart 委派

OpenCode 原生 `SubtaskPart` 机制实现委派：

```typescript
// 墨衡在 system_prompt 指导下，通过 SubtaskPart 委派子 Agent
// OpenCode 运行时处理 SubtaskPart → 创建子 session → 执行 → 结果回流

// SubtaskPart 格式（OpenCode 内建协议）：
{
  type: "subtask",
  agent: "lingxi",                    // 子 Agent ID
  context: "创意简报任务...",           // 墨衡组装的上下文
  tools: ["brainstorm_create", ...]   // 可选：额外限制子 Agent 工具范围
}
```

#### 2.4.3 上下文组装策略

墨衡在委派前通过 MCP 工具查询 DB 组装上下文：

| 子 Agent | 墨衡调用的工具 | 组装的上下文 |
|----------|-------------|-----------|
| 灵犀 | `project_read` | 项目基本信息 + 用户原始想法 |
| 匠心(世界) | `brainstorm_read` | 创意简报 + 已有世界设定 |
| 匠心(角色) | `brainstorm_read` + `world_setting_read` | 创意简报 + 世界设定 + 已有角色 |
| 匠心(大纲) | `brainstorm_read` + `world_setting_read` + `character_read` | 创意简报 + 世界设定 + 角色表 |
| 执笔(写作) | `context_assemble` | Brief + 前文摘要 + 世界设定 + 角色状态 + 伏笔 + 文风 + 题材技法 + 教训 |
| 执笔(修订) | `context_assemble` (mode: "revise") | 章节内容 + 审校反馈 + 文风 + 教训 |
| 明镜 | `character_read` + `world_setting_read` | 章节内容 + 角色设定 + 世界设定 + 前文摘要 + 通过标准 |
| 载史 | `character_read` | 章节内容 + 角色表 + 伏笔列表 + 时间线 |
| 析典 | `character_read` + `world_setting_read` | 多章节内容 + 角色表 + 世界设定 + 弧段大纲 |

`context_assemble` 是核心工具，内部实现多表联查 + token budget 控制：

```typescript
// 已在 opencode-integration DESIGN 中定义接口
// 实现细节：
async function contextAssemble(projectId: string, chapterNumber: number, mode: string) {
  const brief = await getBrief(projectId, chapterNumber);
  const worldContext = await getWorldContextSummary(projectId);
  const characterStates = await getActiveCharacterStates(projectId, chapterNumber);
  const previousSummary = chapterNumber > 1
    ? await getChapterSummary(projectId, chapterNumber - 1)
    : null;
  const styleConfig = await getStyleConfig(projectId);
  const lessons = await getActiveLessons(projectId);
  const threads = await getOpenThreads(projectId, chapterNumber);
  const arcContext = await getArcContext(projectId, chapterNumber);
  const genreKnowledge = await getGenreKnowledge(projectId); // 题材技法（知识库 category='genre'）

  // Token budget 控制：总上下文不超过 32K tokens
  const tokenBudget = {
    brief: 2000,
    worldContext: 4000,
    characterStates: 4000,
    previousSummary: 3000,
    styleConfig: 1000,
    genreKnowledge: 1000,
    lessons: 1000,
    threads: 1000,
    arcContext: 2000,
  };

  return { ok: true, data: { brief, worldContext, characterStates, previousSummary, styleConfig, lessons, threads, arcContext, genreKnowledge, tokenBudget } };
}
```

### 2.5 模型覆盖优先级

```
项目级覆盖 > 全局偏好 > 风格默认
```

实现方式：

```typescript
// 在 Hono server 层解析模型选择（在转发请求给 OpenCode 之前）
function resolveModel(projectConfig: ProjectConfig, agentId: string, styleId?: string): string {
  // 1. 项目级覆盖
  if (projectConfig.modelOverrides?.[agentId]) {
    return projectConfig.modelOverrides[agentId];
  }
  // 2. 全局偏好（用户设置）
  if (globalPreferences.modelOverrides?.[agentId]) {
    return globalPreferences.modelOverrides[agentId];
  }
  // 3. 风格默认（仅执笔）
  if (agentId === "zhibi" && styleId) {
    const styleConfig = loadStyleYaml(styleId);
    return styleConfig.recommended_model;
  }
  // 4. Agent YAML 中定义的默认模型
  return loadAgentYaml(agentId).model;
}
```

### 2.6 温度场景化

执笔的温度根据章节类型动态调整。墨衡委派时在上下文中指定章节类型：

```typescript
const TEMPERATURE_MAP: Record<string, [number, number]> = {
  daily:    [0.70, 0.80],  // 日常
  battle:   [0.60, 0.70],  // 战斗
  emotion:  [0.75, 0.85],  // 情感
  suspense: [0.50, 0.60],  // 悬疑
  climax:   [0.65, 0.75],  // 高潮
};

// 章节类型由 Brief 中定义，墨衡在委派时传递
function resolveTemperature(chapterType: string): number {
  const range = TEMPERATURE_MAP[chapterType] ?? [0.65, 0.75];
  return (range[0] + range[1]) / 2;  // 取中值
}
```

### 2.7 四轮审校流程实现

#### 审校工具链

```
review_round1(chapterId) → review_round2(chapterId) → review_round3(chapterId) → review_round4(chapterId)
```

每轮工具的实现模式：

```typescript
// src/tools/review.ts（已在 opencode-integration DESIGN 中规划文件位置）
server.tool(
  "review_round1",
  "AI 味检测：评估章节的 Burstiness 和模板化程度",
  { projectId: z.string().uuid(), chapterId: z.string().uuid() },
  async ({ projectId, chapterId }): Promise<MCPToolResult> => {
    // 门禁：章节必须存在 + 未归档
    const gate = await checker.check(projectId, "review_round1", { chapterId });
    if (!gate.ok) return gate;

    // 读取章节内容
    const chapter = await getChapter(chapterId);

    // Round 1 评分逻辑由明镜 Agent 完成
    // 此工具仅负责：保存评分结果 + 返回格式化数据

    // 返回格式
    return {
      ok: true,
      data: {
        round: 1,
        dimension: "AI味检测",
        score: null,  // 由明镜 Agent 填写后通过 update 保存
        issues: [],
        chapterContent: chapter.content,  // 传递给明镜
      },
    };
  },
);

server.tool(
  "review_round2",
  "逻辑一致性检查：比对角色/世界/前文",
  { projectId: z.string().uuid(), chapterId: z.string().uuid() },
  async ({ projectId, chapterId }) => {
    // 门禁：Round 1 已完成
    const gate = await checker.check(projectId, "review_round2", { chapterId });
    if (!gate.ok) return gate;

    // 组装参照数据
    const chapter = await getChapter(chapterId);
    const characters = await getCharacters(projectId);
    const worldSettings = await getWorldSettings(projectId);
    const previousSummary = await getPreviousSummary(projectId, chapter.number);

    return {
      ok: true,
      data: {
        round: 2,
        dimension: "逻辑一致性",
        chapterContent: chapter.content,
        referenceData: { characters, worldSettings, previousSummary },
      },
    };
  },
);
```

#### 审校结论合成

```typescript
function computeReviewConclusion(rounds: RoundResult[]): ReviewConclusion {
  const weights = { 1: 0.20, 2: 0.30, 3: 0.35, 4: 0.15 };
  const totalScore = rounds.reduce((sum, r) => sum + r.score * weights[r.round], 0);
  const hasCritical = rounds.some((r) => r.issues.some((i) => i.severity === "critical"));

  if (totalScore >= 80 && !hasCritical) return { conclusion: "pass", totalScore };
  if (totalScore >= 70 && !hasCritical) return { conclusion: "revise", totalScore };
  return { conclusion: "rewrite", totalScore };
}
```

### 2.8 Agent 间通信模型

```
❌ Agent 之间不直接传递消息
✅ 所有产出写入 DB（通过 MCP 工具）
✅ 下游 Agent 通过 MCP 查询获取上游 Agent 的产出
```

数据依赖链：

```
灵犀(创意简报) → 匠心(世界→角色→大纲) → 执笔(写作) → 明镜(审校) → 载史(归档) → 执笔(下一章)
                                                               ↗
                                                   博闻(知识提取)
                                                   析典(九维分析)
```

每个 Agent 的产出都通过 MCP 工具写入 PostgreSQL，下游 Agent 通过 MCP 工具查询。墨衡是唯一的调度者。

### 2.9 MCP 连接配置

```json
// opencode-config/mcp.json
{
  "mcpServers": {
    "moran": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

### 2.10 Docker 挂载（已在 opencode-integration DESIGN 规划）

```yaml
# docker-compose.dev.yml 中 opencode 服务
opencode:
  volumes:
    - ./opencode-config:/app/config:ro
    - ./packages/mcp-server:/app/mcp-server:ro
```

## 3. 不需要改动的部分

- OpenCode serve 容器本身（Docker 镜像不变）
- PostgreSQL 容器配置
- Next.js rewrite 代理
- Hono server 核心路由（仅新增 Agent 状态相关端点）

## 4. 风险与注意事项

- **System prompt 质量**：Agent 行为高度依赖 prompt 设计，需要反复迭代调优。建议先实现骨架，再通过实际对话调整
- **SubtaskPart 行为**：依赖 OpenCode 的原生委派机制，需确认 API 版本支持。若不支持，备选方案是 Hono 层自行管理子 session
- **模型可用性**：Kimi K2、GPT-4o 等非 Anthropic 模型需确认 OpenCode 支持的 Provider 配置
- **Token 上下文长度**：执笔写长章节时，`context_assemble` 的 token budget 需要根据实际模型窗口大小调整
- **审校模型独立性**：明镜应尽量使用与执笔不同的模型族，避免同源偏差。当前配置都是 Sonnet，后续可调为 GPT-4o
- **Agent YAML 热更新**：修改 YAML 后是否需要重启 OpenCode 容器？需要测试。若需重启，考虑 `docker compose restart opencode` 的自动化
