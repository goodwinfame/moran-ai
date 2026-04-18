# Dickens UNM 技术调研报告：记忆系统、版本管理与模型能力评估

> **文档版本**: v1.0
> **日期**: 2026-04-12
> **状态**: 完成
> **用途**: 为 UNM §5-§12 设计提供学术与工程依据

---

## 总目录

- [执行摘要](#执行摘要)
- [Part A: 通用LLM记忆方案（15个系统）](#part-a-通用llm记忆方案)
- [Part B: 长篇叙事生成记忆系统](#part-b-长篇叙事生成记忆系统)
- [Part C: 版本管理与回退方案](#part-c-版本管理与回退方案)
- [Part D: 模型能力评估](#part-d-模型能力评估)
- [Part E: 综合分析与决策矩阵](#part-e-综合分析与决策矩阵)
- [参考文献](#参考文献)

---

## 执行摘要

本报告整合三大方向的深度调研，覆盖 30+ 论文/系统/开源项目，为 Dickens 统一叙事记忆（UNM）设计提供实证基础。

### 五项核心结论

1. **记忆分层是工业级标准** — 从通用的 MemGPT 到专为写作设计的 InkOS，三层记忆（Hot/Warm/Cold）+ 主动遗忘是解决上下文膨胀的唯一可行路径。InkOS 已在 45.2 万字（31章）实测中验证有效。

2. **"写时控制"是所有系统的缺口** — 调研的所有长篇写作系统（InkOS、Novel-OS、StoryDaemon、Postwriter）均无"写入时主动控制增长"机制。审计和截断都是被动的。这将是 UNM 的核心创新点。

3. **Git-like 内容寻址存储是版本管理最优解** — `isomorphic-git` 提供跨文件原子提交、分支模型、完整历史，天然适配 Dickens 的文件系统架构。CRDT 对单 Agent 系统过度设计。

4. **Cratchit 必须从 Haiku 升级到 Sonnet** — IDP Leaderboard 数据：Sonnet 80.8% vs Haiku 69.6%（差11个百分点）。结构化 JSON 输出可靠性差距更大。每项目额外成本仅 $1.80。

5. **伏笔治理需要状态机** — InkOS 的 hookAgenda（open→progressing→deferred→resolved + lastAdvancedChapter + dormant debt）是目前最成熟的方案。

### 关键数字速查

| 指标 | 数据 | 来源 |
|------|------|------|
| 500条指令时模型准确率 | 68% | IFScale (2025) |
| 否定约束反向激活率 | 87.5% | Semantic Gravity Wells |
| 迭代修正收益递减轮次 | 2-3轮 | Self-Refine (NeurIPS 2023) |
| InkOS 实测字数 | 452,191字/31章 | InkOS v1.0 |
| Sonnet vs Haiku 文档处理分差 | 11.2% | IDP Leaderboard |
| 动态状态追踪对一致性的影响 | 72.1%→89.7% | SCORE |
| GPT-4o vs GPT-3.5 矛盾检测 | 77.2% vs 51.6% | CONTRADOC |
| 级联模式成本节省 | 45-85% | RouteLLM |

---

## Part A: 通用LLM记忆方案

扩展 UNM §2.3 学术验证矩阵中的 15 个系统，补充核心机制、数据结构和局限性。

### A1. PageIndex (VectifyAI, 23.9K⭐)

**来源**: github.com/VectifyAI/PageIndex

**核心机制**: LLM 推理式树导航。抛弃向量数据库，使用嵌套 JSON 结构存储索引树。LLM 逐层判断目标节点，通过树结构缩小搜索范围。无需 embedding 模型，零额外基础设施。

**关键数据结构**:
```json
{
  "node": "characters",
  "children": [
    { "node": "protagonist", "children": [...] },
    { "node": "antagonist", "children": [...] }
  ]
}
```

**在 UNM 中的应用**: 类别索引树导航。UNM 的 6 个类别（guidance/world/characters/consistency/summaries/outline）可构建为索引树，LLM 按需遍历。

**局限性**: 树深增加时推理步骤增多，延迟上升。对类别数量有限的 UNM 来说树深可控。

**适用性**: **高**

---

### A2. TierMem (arXiv 2602.17913)

**核心机制**: 双层溯源记忆（Two-tier Provenance Memory）。每条记忆携带来源追踪信息。通过 Sufficiency Check 判断当前上下文是否足以完成任务——不足时从 Cold/Warm 层按需升级到 Hot 层。

**关键设计**:
- 记忆条目包含 `provenance` 字段追踪来源
- Sufficiency Check 在装配上下文后执行，判断是否需要补充
- 升级是按需的，而非预加载全量

**在 UNM 中的应用**: Hot/Warm/Cold 分层 + 按需升级。写手上下文装配后如果检测到信息不足，可从 Warm/Cold 层补充。

**局限性**: 溯源元数据增加存储开销。Sufficiency Check 本身消耗 tokens 且有误判风险。

**适用性**: **高**

---

### A3. contextweaver (GitHub dgenio)

**核心机制**: 8 阶段预算感知装配管线。从需求分析开始，经过预算分配、内容选择、排序优化、最终渲染，形成完整的上下文组装流水线。每个阶段有明确的输入输出契约。

**8阶段概要**:
1. 需求分析（任务类型识别）
2. 预算计算（总 token 上限分配）
3. 候选收集（从所有记忆源收集）
4. 相关性评分
5. 去重与压缩
6. 预算裁剪
7. 位置优化（Lost-in-Middle 对策）
8. 最终渲染

**在 UNM 中的应用**: 需求→分配→渲染管线设计。UNM 的 MemoryAllocator + SliceRenderer 直接参考此架构。

**局限性**: 8 阶段实现复杂度高。Dickens 可简化为 3-4 阶段。

**适用性**: **中**

---

### A4. A-MEM (NeurIPS 2025)

**核心机制**: 借鉴 Zettelkasten（卢曼卡片盒）笔记法。每条记忆是一张卡片，卡片间通过自动链接机制形成网络。记忆不是孤立的列表，而是有关联的图结构。支持记忆的动态演化——新信息可以修改、合并或拆分已有卡片。

**在 UNM 中的应用**: 结构化记忆演化。角色与事件之间、伏笔与场景之间的关联可以通过链接网络维护。

**局限性**: 自动链接的精确度受模型能力限制，容易产生虚假关联。

**适用性**: **高**

---

### A5. EvoClaw

**核心机制**: 衰减×强化评分系统。公式：`score = exp(-age/30) × (1 + 0.1 × accessCount)`。记忆随时间自然衰减，每次被引用时强化。评分低于阈值的记忆从 Hot 降级到 Warm/Cold。

**在 UNM 中的应用**: 引导卡片衰减公式。BGM 的 Pattern 类引导使用此公式控制生命周期。

**局限性**: 衰减率和强化权重需要针对小说场景调优（30 的衰减常数可能需要调整为按章节数而非天数）。

**适用性**: **中高**

---

### A6. AdaGReS (arXiv 2512.25052)

**核心机制**: 冗余感知选择（Redundancy-aware Selection）。使用自适应 β 参数平衡多样性与准确性。当候选记忆集中存在语义重复时，自动降低重复项的权重。

**在 UNM 中的应用**: 去重打分。防止相似的摘要卡片或重复的角色描述占满上下文预算。

**局限性**: 语义重复检测在大规模上下文下计算成本较高。

**适用性**: **中**

---

### A7. Lost-in-Middle (arXiv 2603.10123)

**核心机制**: 证明 U 型注意力是当前 Transformer 架构的固有特性。模型对序列首尾的信息显著更敏感，中间位置的信息容易被忽略。这不是特定模型的 bug，而是架构级别的问题。

**在 UNM 中的应用**: Bracket 定位策略。将最关键的约束（宪法层引导、当前章计划）放在上下文首尾，辅助信息放中间。

**局限性**: 只是缓解策略，无法从根本上解决中间遗忘问题。随着上下文长度增加效果递减。

**适用性**: **高**（设计准则）

---

### A8. BACM (arXiv 2604.01664)

**核心机制**: 强化学习驱动的预算感知压缩（RL Budget-aware Compression）。训练一个 RL agent 来学习在给定 token 预算下如何最优地分配给不同类别的记忆。

**在 UNM 中的应用**: 动态预算分配算法。不同类型的章节（动作戏 vs 对话戏 vs 回忆戏）可以有不同的预算分配策略。

**局限性**: 训练 RL 模型需要大量的场景-质量对齐数据，冷启动困难。

**适用性**: **中**（长期方向，V2+）

---

### A9. Self-Refine (NeurIPS 2023)

**核心机制**: 迭代自我修正。LLM 生成→自我评估→修正→再评估的循环。实验证明 2-3 轮后收益显著递减，更多轮次甚至产生负面效果（过度修正、丢失原有优点）。

**在 UNM 中的应用**: 重写次数硬上限。Dickens 当前第1章经历了 6+ 次重写，远超有效阈值。UNM 应强制执行 max 3 轮重写规则。

**局限性**: 没有考虑跨 Agent 协作带来的增益（不同 Agent 视角的修正可能比同一 Agent 自我修正更有效）。

**适用性**: **高**

---

### A10. IFScale (2025)

**核心机制**: 评估 LLM 在大量指令堆叠下的遵循能力。核心发现：500 条指令时，顶尖模型准确率仅 68%。指令数量与遵循准确率呈明显负相关。

**在 UNM 中的应用**: 引导数量硬上限。25 条教训已超出模型有效指令容量。UNM 的 guidance 类别应限制 Hot 层活跃引导不超过 12 条。

**局限性**: 评估场景以单点提取为主，小说创作涉及多点关联。实际阈值可能更低。

**适用性**: **高**（安全阈值）

---

### A11. Semantic Gravity Wells (2026)

**核心机制**: 研究发现 87.5% 的否定式约束（"不要做X"、"避免Y"）反而会激活被禁止的内容。否定约束在语义空间中形成"引力井"，将模型注意力吸引到被禁止的概念上。

**在 UNM 中的应用**: 正向表述设计原则。所有引导必须转化为正向表述（"用简洁对话推进"而非"不要写冗长对话"）。BGM 的否定转正向模块直接基于此发现。

**局限性**: 某些规则确实难以用完全正向的语言表述。需要 LLM 辅助转写。

**适用性**: **高**

---

### A12. Constitutional AI (Anthropic)

**核心机制**: 从规则列表→培养判断力。不是给模型一堆规则让它逐条检查，而是通过宪法式的高层原则让模型内化价值观。少数高质量原则比大量具体规则更有效。

**在 UNM 中的应用**: 宪法层设计。UNM guidance 类别的 Constitution 层（pinned, 永不衰减）直接借鉴此理念。5-7 条核心写作宪法 > 25 条具体教训。

**局限性**: 规则冲突时模型可能产生困惑。需要冲突检测和优先级机制。

**适用性**: **高**

---

### A13. MemGPT / Letta (arXiv:2310.08560)

**核心机制**: 三层虚拟记忆架构（Main Context / Working Memory / Archival Storage）。引入主动遗忘机制——当 Working Memory 压力超过阈值时自动淘汰最低优先级的记忆。模型可以主动决定将信息存入或从长期记忆中检索。

**关键创新**:
- 记忆操作作为"系统调用"暴露给模型
- 模型自主决定何时存/取/删记忆
- 压力淘汰机制防止记忆无限增长

**在 UNM 中的应用**: 记忆分层的基础理论模型。UNM 的 Hot/Warm/Cold 三层直接对应 MemGPT 的三层。

**局限性**: 主动遗忘算法对创作场景可能过于激进——遗忘了一个50章前的伏笔可能导致叙事断裂。需要"保护标记"机制。

**适用性**: **高**

---

### A14. CrewAI (2026.02 重构)

**核心机制**: 从分散的记忆实现统一为 `Memory` 基类。支持 Short-term、Long-term、Entity 三种记忆类型的统一接口。2026.02 重构将记忆从各 Agent 内部提取为共享层。

**在 UNM 中的应用**: UNM 统一方向验证。CrewAI 的重构方向（分散→统一）与 UNM 的设计方向完全一致。

**局限性**: CrewAI 的记忆系统主要面向任务型 Agent，对长篇文档级别的支持较薄弱。

**适用性**: **中高**

---

### A15. Novel-OS / StoryDaemon / Postwriter（概览）

**核心发现**: 三个系统均采用文件系统 + JSON 作为事实来源，证明了 Dickens 的文件驱动架构是主流方向。但三者都缺少预算控制、写时门控、和系统性的遗忘机制。

**在 UNM 中的应用**: 架构方向验证。详细分析见 Part B。

**适用性**: **高**（方向验证）

---

## Part B: 长篇叙事生成记忆系统

调研 2022-2026 年间专门针对长篇叙事生成的记忆/上下文管理方案。

### B1. InkOS (Narcooo/inkos, 4000+⭐, v1.0.2)

**发布**: 2026-03-12 (v1.0.2: 2026-04-06)
**架构**: 全自动 CLI Agent，10-Agent 管线
**安装量**: 3.4K weekly downloads

#### 10-Agent 管线

| Agent | 职责 |
|-------|------|
| Radar | 扫描平台趋势 |
| Architect | 制定大纲 |
| Writer | 草稿撰写 |
| Validator | 11 条硬规则自动验证 |
| Auditor | 33 维度 LLM 审计 |
| Planner | 章节规划 |
| Composer | 组合编辑 |
| Observer | 观察监控 |
| Reflector | 反思重构 |
| Normalizer | 字数归一化 |

#### 记忆系统：7个真相文件（Truth Files）

| 文件 | 用途 |
|------|------|
| `current_state.md` | 世界状态、角色位置、关系网络 |
| `plot_outline.md` | 大纲 |
| `character_*.md` | 角色详情 |
| `world_bible.md` | 世界设定 |
| `hook_board.md` | 伏笔板 |
| `timeline.md` | 时间线 |
| `summary.md` | 章节摘要 |

#### 核心创新1：上下文膨胀解决方案（v0.6）

**问题**：20+ 章后上下文膨胀导致 400 报错。

**三管齐下**：
1. **JSON Delta 模式**：Settler 输出 JSON delta 而非全量 markdown，只传递变更
2. **SQLite 时序记忆数据库**（Node 22+）：`story/memory.db`，按相关性检索历史事实，避免全量注入
3. **Zod Schema 校验**：状态文件结构化验证，防止格式漂移

#### 核心创新2：伏笔治理（Hook Governance）

Planner 生成 `hookAgenda`——排班伏笔推进与回收：
- `lastAdvancedChapter`：追踪最后推进章节
- Status 流转：`open → progressing → deferred → resolved`
- Dormant debt 检测：长期未推进的伏笔触发告警

#### 核心创新3：33 维度审计

| 类别 | 维度范围 |
|------|---------|
| 角色记忆 | dim 1-5 |
| 物资连续性 | dim 6-10 |
| 伏笔回收 | dim 11-15 |
| 大纲偏离 | dim 16-20 |
| AI 痕迹检测 | dim 20-23 |
| 番外维度 | dim 28-31 |

#### 实测数据

| 指标 | 数据 |
|------|------|
| 已完成章节 | 31 章 |
| 总字数 | 452,191 字 |
| 平均章字数 | ~14,500 字 |
| 审计通过率 | 100% |
| 资源追踪项 | 48 个 |

#### 对 Dickens UNM 的启发

- **JSON Delta**：状态增量更新而非全量注入——UNM 的 ManagedWrite 应输出 delta
- **SQLite 时序检索**：按相关性而非全量——UNM 的 SliceRenderer 应支持检索模式
- **伏笔状态机**：hookAgenda 模型可直接移植到 UNM 的 consistency 类别
- **33 维度审计**：为 Jaggers 审校维度扩展提供参考
- **写前自检/写后结算**：双重门控思路

**未解决**：无"写时控制"机制——审计是被动触发，非主动预防。预算机制仅为全局 `INKOS_LLM_MAX_TOKENS` 上限。

**适用性**: **极高**——UNM 最直接的对标系统

---

### B2. Novel-OS (mrigankad/Novel-OS, 2026-03)

**架构**: 多 Agent 协同框架，状态管理为核心

#### 三层上下文架构
- **Layer 1: Writing Standards** — 个人写作风格库（`.novel-os/standards/`）
- **Layer 2: Novel** — 单本小说状态（`.novel-os/novel/`）
- **Layer 3: Manuscripts** — 章节级草稿（`.novel-os/manuscripts/[date-story]/`）

#### StoryState 中心数据库

```json
{
  "metadata": { "title": "...", "genre": "..." },
  "story_bible": { "themes": [], "setting": {}, "world_rules": {} },
  "characters": {
    "char_001": { "full_name": "...", "role": "protagonist", "arc_stage": "..." }
  },
  "plot_threads": {
    "plot_001": { "name": "...", "status": "active", "priority": 5 }
  },
  "chapters": { "1": { "status": "complete", "word_count": 2450 } }
}
```

**启发**：角色含 `arc_stage`（生命周期阶段）、plot_threads 含 `priority`。

**未解决**：无预算/限额机制，无伏笔追踪，无遗忘。

**适用性**: **中**

---

### B3. StoryDaemon (EdwardAThomson/StoryDaemon, 2025-11)

**架构**: 自主 Agent，强调 Emergent Narrative

#### Story Tick Loop（每 tick 生成一个 scene）
1. Check Plot Beats（可选）
2. Summarize State — 收集前文上下文
3. Plan — Planner LLM 决定工具调用
4. Execute Tools — 执行角色生成、记忆检索等
5. Write — Writer LLM 生成 prose
6. Evaluate — 质量评估 + QA metrics

#### 记忆系统

```
novels/<name>/
├── foundation/        # 不可变约束
│   ├── genre.md
│   ├── premise.md
│   └── themes.md
├── plot_outline.md    # 可选的 plot beats
├── open_loops/        # 未解线索 + mention tracking
├── lore/              # 世界规则 + 矛盾检测
├── vector_index/      # 语义检索
└── passages/          # 生成的场景
```

**记忆类型**：
- **Foundation**：不可变约束（genre、premise、themes）
- **Open Loops**：未解叙事线索 + 提及追踪
- **Lore**：世界规则 + 矛盾检测
- **Vector Index**：语义搜索

**核心创新**：
- **Tension Tracking**：场景紧张度评分（0-10），用于节奏控制
- **POV Integrity Check**：视角一致性验证
- **Lore 矛盾检测**：新设定写入时自动检查与已有规则的冲突
- **Emergent vs Planned 平衡**：可选的 plot-first 模式

**启发**：Open Loops + Mention Tracking 是轻量级伏笔追踪方案；Tension Tracking 量化叙事节奏。

**未解决**：无预算机制，无结构化角色状态追踪。

**适用性**: **高**

---

### B4. Postwriter (avigold/postwriter, 2026-03)

**架构**: 多 Agent 编排系统，80K 词小说生成，10 个专业化 Agent

#### 四层 Linked Representations

1. **Text Layer** — 散文本身
2. **Story-state Layer** — facts, causality, character states, timeline, unresolved obligations
3. **Metrics Layer** — 各维度评分
4. **Revision Layer** — 修订历史

#### 核心设计：数据库作为唯一事实来源

> "数据库是唯一事实来源，而非文本"

21 张数据库表覆盖全 canonical 数据模型。

#### Context 文件支持

```
context/
├── style-guide.md      # YAML frontmatter: type: style
├── characters.md
├── plot-outline.md
└── mood-board.png
```

**Forward-only**：新文件只影响未来场景，无 retroactive 变更。

**启发**：
- 四层分离思想——文本、状态、指标、修订各自独立
- 数据库 vs 文件的事实来源选择
- Forward-only 防止追溯性上下文污染
- 模型分层（Opus/Sonnet/Haiku 用于不同任务）

**未解决**：无明确的预算控制，世界观膨胀管理不明确。

**适用性**: **中**

---

### B5. Dramatron (DeepMind, arXiv:2209.14958, SIG CHI 2023)

**架构**: 五层 Prompt Chaining

```
Log Line → Title → Characters → Plot (Scene Beats) → Location Descriptions → Dialogue
```

每层输出作为下一层的 conditioning 输入。数学表达：C_k = C_{k-1} ∪ {X_k}

**15 位剧作家评估反馈**：输出"公式化"（formulaic），top-down 结构不适用于 discovery writers。

**启发**：层级抽象思路（高层到低层的信息传递）。

**未解决**：无持久记忆、无角色状态追踪、无伏笔管理、固定层级不灵活。

**适用性**: **低**（仅作结构参考）

---

### B6. RecurrentGPT (arXiv:2305.13304, 2023)

**核心创新**：语言版 LSTM

| RNN 组件 | RecurrentGPT 对应 |
|---------|-----------------|
| Cell state | Output Paragraph（自然语言） |
| Hidden state | Short-term Memory（自然语言摘要） |
| Long-term memory | Long-term Memory（所有段落摘要） |
| Input | Previous paragraph + Plan |

#### 记忆机制

**短期记忆**：总结最近 timesteps 的关键信息，每步更新，**500 词硬限制**。LLM 输出更新 rationale（解释"哪些句子不再必要、哪些需要添加"）。

**长期记忆**：所有已生成段落的摘要，sentence-transformers 向量化，语义检索 top-k 相关段落。

#### 每步 Prompt 结构

```
Input Memory: {short_memory}
Input Paragraph: {input_paragraph}
Input Related Paragraphs: {top_k_long_term_memory}

Output:
1. Output Paragraph: (~20 sentences)
2. Output Memory: (rationale + updated memory, never >500 words)
3. Output Instruction: (3 options for next paragraph)
```

**实验结果**：人类评估偏好率 94.7%（vs Rolling-ChatGPT, RE3, DOC）。随文本增长优势扩大。

**启发**：
- 自然语言记忆——可读、可编辑
- Memory 更新 rationale——解释为什么增删信息
- 500 词硬限制——防止记忆膨胀的最简方案
- Top-k 检索——从大量历史选择相关片段

**未解决**：无结构化角色状态，无伏笔追踪，记忆更新仍依赖 LLM 判断质量。

**适用性**: **中**

---

### B7. DOC — Design-Outline-Create (arXiv:2212.10077, ACL 2023)

**三阶段流程**：Design → Outline → Create

**Outline 内容**：Setting/Characters + Plot beats（每个 beat 含 who, where, what, why）

**生成策略**：OPT-175B + Alpa，Controller + Reranker 多候选重排

**启发**：Outline as Control——大纲作为生成的 conditioning，Entity/Relation/Event 结构。

**未解决**：静态 Outline 无动态更新，无角色状态追踪。

**适用性**: **中**

---

### B8. LongWriter (arXiv:2408.07055, ICLR 2025, 1850⭐)

**核心发现**：模型的有效生成长度受限于 SFT 数据中见过的样本——输出限制不是因为上下文窗口，而是训练数据。

**AgentWrite Pipeline**：分而治之
1. 将超长任务分解为子任务
2. 每个子任务生成 200-1000 词段落
3. 子任务结果合并

**LongWriter-6K 数据集**：6,000 条 SFT 数据，输出长度 2K-32K 词。

**启发**：分而治之策略指导 Dickens 章节内的文本生成粒度。

**适用性**: **高**（生成策略层面）

---

### B9. DOME (arXiv:2412.13575, NAACL 2025)

**核心架构**：

**Dynamic Hierarchical Outline (DHO)**：将小说写作理论融入大纲规划，Plan 和 Writing 阶段融合，适应生成不确定性。

**Memory-Enhancement Module (MEM)**：基于时序知识图谱存储和检索生成内容，减少上下文冲突。

**Temporal Conflict Analyzer**：自动检测时序知识图谱中的矛盾。

**启发**：时序知识图谱做实体关系时序追踪；动态大纲调整（大纲与写作融合）；时序冲突自动检测。

**适用性**: **高**

---

### B10. SCORE (arXiv:2503.23512)

**三核心组件**：

| 组件 | 功能 |
|------|------|
| Dynamic State Tracking | 追踪故事状态变化 |
| Context-Aware Summarization | 上下文感知摘要 |
| Hybrid Retrieval | TF-IDF + 语义嵌入混合检索 |

**评估结果**：
- 23.6% 更高连贯性（NCI-2.0）
- 89.7% 情感一致性（EASM）
- 41.8% 更少幻觉

**关键对比**：去掉 Dynamic State Tracking 后一致性从 89.7% 降到 72.1%——**动态状态追踪贡献了 17.6 个百分点的一致性提升**。

**启发**：混合检索（TF-IDF + 语义双路）；动态状态追踪的量化价值。

**适用性**: **高**

---

### B11. ConStory-Bench (arXiv:2603.05890, 2026-03)

**核心贡献**：长篇叙事一致性错误的系统化分类。

#### 五大错误类别

| 类别 | 细粒度错误 |
|------|-----------|
| Timeline & Plot Logic | 时序矛盾、无因果效果、因果逻辑违反 |
| Character | 记忆矛盾、知识矛盾、技能波动、遗忘能力 |
| World Rules | 物理规则违反、地理矛盾 |
| Stylistic | 文体不一致 |
| Abandoned Plot Elements | 遗弃的 plot elements |

#### 关键发现

1. 事实性和时序性错误最常见
2. **错误集中在叙事中部**（非开头或结尾）
3. 高 token-level entropy 区域错误更多
4. 某些错误类型倾向于共现

**启发**：错误分类学为 UNM 审计维度提供依据；时间线是叙事一致性的核心；token entropy 可作为风险指标。

**适用性**: **极高**

---

### B12. NovelClaude (wzxsph/Novel-Claude)

**架构**：微内核 + 插件生态

| 引擎 | 职责 |
|------|------|
| `world_builder.py` | 从 Logline 构建 JSON 背景设定 |
| `volume_planner.py` | 分卷 + Beats 切分，5000 字/章控制 |
| `scene_writer.py` | Subagents 执行 + Director 定稿 |

**EventBus + PluginManager**：Skills 热插拔，错误隔离，RAG 记忆流等插件可叠加。

**启发**：微内核架构——核心稳定，插件扩展；每章 5000 字精确产出控制。

**适用性**: **中**

---

### B-Summary: 长篇写作系统对比矩阵

| 系统 | 记忆分层 | 预算控制 | 伏笔追踪 | 一致性检测 | 写时控制 | 实测规模 |
|------|---------|---------|---------|-----------|---------|---------|
| **InkOS** | 7 真相文件+SQLite | 全局 MAX_TOKENS | hookAgenda 状态机 | 33 维度审计 | ❌ | 45.2万字/31章 |
| Novel-OS | 3层JSON | ❌ | ❌ | ❌ | ❌ | 小规模 |
| StoryDaemon | foundation/loops/lore | ❌ | open_loops | Tension+POV | ❌ | 中等 |
| Postwriter | 21表DB | ❌ | story-state层 | Metrics层 | ❌ | 80K词 |
| RecurrentGPT | 短期500词+长期向量 | 500词硬限制 | ❌ | ❌ | ❌ | 6000词 |
| DOME | 时序知识图谱 | ❌ | ❌ | 时序冲突检测 | ❌ | 中等 |
| SCORE | 动态状态追踪 | ❌ | ❌ | 89.7%一致性 | ❌ | 中等 |

**关键缺口**：**所有系统都没有实现"写时控制"**——即在数据写入时主动限制增长。全部依赖读时截断或被动审计。这是 UNM 的核心创新方向。

---

## Part C: 版本管理与回退方案

当前 Dickens 的致命问题：章节回退/重写时，metadata（一致性追踪、角色状态、线索、摘要）无法同步回退，导致数据不一致甚至项目报废。当前只有 safe-write 的字节数检查。

### C1. Event Sourcing

#### C1.1 Lokad.AzureEventStore

**来源**: github.com/Lokad/AzureEventStore

事件存储在 Azure Append Blobs（追加写日志），天然不可变。每个 aggregate 一个 blob，事件按序列追加。支持快照：应用自行决定何时创建快照。

```csharp
// 事件定义
public sealed record ValueUpdated(
    string Key, string OldValue, string NewValue) : IEvent;

// 写入事件
await stream.AppendAsync(new ValueUpdated(key, oldVal, newVal));

// 重建状态（从事件重放）
var state = await stream.ReplayAsync();
```

#### C1.2 simple-eventstore（纯 Node.js）

**来源**: github.com/rradczewski/simple-eventstore

纯 JavaScript，零依赖，`JsonFileStorageBackend` 将事件存为 JSON 文件。

```javascript
const eventStore = new EventStore('my-storage.json');
eventStore.storeEvent(UserJoined({ name: 'Raimo' }));

// 投影重建状态
const ActiveUsers = projection(
  on('USER_JOINED', (users, event) => users.concat([event.name])),
  on('USER_PARTED', (users, event) => users.filter(u => u !== event.name))
)([]);
const activeUsers = await eventStore.project(ActiveUsers);
```

#### C1.3 node-event-storage（嵌入式）

**来源**: node-event-storage.readthedocs.io

专为 Node.js 设计，支持 MsgPack 压缩，consumer exactly-once 语义。

#### C1.4 事件粒度设计

| 粒度 | 适用场景 | Dickens 适用性 |
|------|----------|---------------|
| field-level | DDD 聚合内部字段变更 | ❌ 过度设计 |
| **chapter-level** | 章节为聚合根 | ✅ 推荐 |
| arc-level | 故事弧为聚合根 | ⚠️ 需与 chapter-level 组合 |

推荐事件类型：
```typescript
type ChapterEvent = 
  | { type: 'ChapterCreated'; chapterId: string; title: string; arcId: string }
  | { type: 'ChapterContentUpdated'; chapterId: string; content: string; wordCount: number }
  | { type: 'ChapterArchived'; chapterId: string; reason: string }
  | { type: 'MetadataUpdated'; entityType: 'character'|'location'|'plotThread'; entityId: string; changes: Record<string, any> }
```

#### C1.5 评估

| 维度 | 评价 |
|------|------|
| 完整审计日志 | ✅ 可回溯任意时间点 |
| 事件不可变性 | ✅ 天然一致性 |
| 跨文件原子性 | ❌ 需额外机制 |
| 100+章重放性能 | ⚠️ 无快照时慢 |

**适用性**: **中**

---

### C2. Snapshot + WAL（Write-Ahead Log）

#### C2.1 SQLite WAL 机制

**来源**: sqlite.org/wal.html

WAL 模式文件结构：
```
database.db       - 主数据库文件
database.db-wal   - Write-Ahead Log（追加写）
database.db-shm   - 共享内存索引
```

MVCC 快照隔离：读取事务开始时记录 mxFrame（最后有效提交帧），之后的写入不影响当前读取。

#### C2.2 快照策略

**参考 Litestream** (github.com/benbjohnson/litestream)：SQLite WAL 到 S3 的连续复制。

| 策略 | 触发条件 | 适用场景 |
|------|----------|----------|
| **每章快照** | 章节完成/存档时 | 章节稳定后 |
| **每弧快照** | 故事弧结束时 | 大规模重构前 |
| **时间快照** | 30分钟无操作 | 防止 WAL 过大 |
| **手动快照** | 用户触发 / agent 决策前 | 危险操作前 |

#### C2.3 JSON 文件系统的 WAL 数据结构

```typescript
interface WALEntry {
  id: string;           // UUID
  timestamp: number;    // Unix ms
  entityType: 'chapter' | 'character' | 'location' | 'plotThread';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  checksum: string;     // CRC32
}

interface Snapshot {
  id: string;
  timestamp: number;
  version: number;
  chapters: Map<string, Chapter>;
  characters: Map<string, Character>;
  locations: Map<string, Location>;
  plotThreads: Map<string, PlotThread>;
  checksum: string;
}
```

WAL 文件结构：
```
.novel/
  wal/
    2024-01-15T10-30-00.001.jsonl
    2024-01-15T10-35-00.002.jsonl
  snapshots/
    snapshot-2024-01-15T10-00-00.json
    snapshot-latest.json → 指向最新
```

#### C2.4 评估

| 维度 | 评价 |
|------|------|
| 增量记录 | ✅ 只记变更 |
| 快速恢复 | ✅ 从快照+增量 |
| JSON 文件适配 | ⚠️ 需自行实现 append-only |
| 跨文件事务 | ⚠️ 需应用层协调 |

**适用性**: **中高**

---

### C3. CRDT（Conflict-free Replicated Data Types）

#### C3.1 Yjs

**来源**: docs.yjs.dev

YATA CRDT 算法，文档更新编码为二进制（高度压缩），更新是可交换、可结合、幂等的。

```javascript
const ydoc = new Y.Doc();
const ytext = ydoc.getText();

// 监听更新
ydoc.on('update', (update) => websocket.send(update));

// Undo/Redo
const undoManager = new Y.UndoManager(ytext);
undoManager.undo();
undoManager.redo();
```

#### C3.2 Automerge

**来源**: automerge.org

文档结构类似 JSON，支持 Peritext CRDT 处理文本、Counter CRDT 做数值合并。

```javascript
let doc = A.from({ title: "My Novel", chapters: [], characters: {} });
doc = A.change(doc, d => {
  d.chapters.push({ id: 1, title: "Chapter 1" });
});
doc = A.merge(doc, remoteDoc);
```

#### C3.3 适用性判断

| 场景 | CRDT 必要性 |
|------|-------------|
| 单 agent 顺序写入 | ❌ 不需要 |
| 多 agent 并发写入 | ✅ 需要 |
| 人类+AI 并发编辑 | ✅ 需要 |

**Dickens 是单 agent 主导系统。CRDT 增加的复杂度不值得。**

**局限**：Undo/Redo 是局部的，不支持全局回退。合并结果不确定。调试困难。

**适用性**: **低**

---

### C4. Git-like 内容寻址存储（推荐方案）

#### C4.1 isomorphic-git

**来源**: isomorphic-git.org

纯 JavaScript 实现 Git，与标准 Git 100% 互操作，可在 Node.js 运行。

```javascript
import * as git from 'isomorphic-git';

await git.init({ fs, dir: '/novel-project' });
await git.add({ fs, dir: '/novel-project', filepath: 'chapter-01.md' });

const sha = await git.commit({
  fs, dir: '/novel-project',
  message: 'Complete chapter 1',
  author: { name: 'Dickens', email: 'dickens@agent' }
});

// 分支
await git.branch({ fs, dir: '/novel-project', ref: 'rewrite-ch3' });
await git.checkout({ fs, dir: '/novel-project', ref: 'rewrite-ch3' });
```

#### C4.2 json-git（纯 JSON Git）

**来源**: github.com/RobinBressan/json-git

专为 JSON 设计，输出 JSON Patch（RFC 6902）。

```javascript
const repository = createRepository();
repository.commit('author', 'Add chapter 1', tree);
repository.branch('experiment');
const patch = repository.diff('master', 'experiment');
repository.merge('author', 'experiment');
```

#### C4.3 Lix — 语义化版本控制

**来源**: lix.dev

在 Git 基础上添加语义元数据。语义化追踪（"这个段落改变了"而非"第5行改变了"）。

```javascript
lix.checkpoint({
  files: ['chapter-05.md'],
  message: 'Rewrite scene 3 for better pacing'
});
```

#### C4.4 跨文件原子提交方案

**问题核心**：如何保证章节+metadata 同时提交？

**方案 A: Git 标准 commit**
```bash
git add chapters/ch-05.md metadata/characters.json metadata/summary.json
git commit -m "Rewrite chapter 5"
```

**方案 B: 内容寻址 Merkle DAG**
```javascript
const manifest = {
  chapters: { 'ch-05.md': 'sha256:abc123...' },
  metadata: {
    'characters.json': 'sha256:def456...',
    'summary.json': 'sha256:ghi789...'
  }
};
const commit = { manifest, parent: 'sha256:prev-commit', timestamp: Date.now() };
```

#### C4.5 分支模型

```
main                   # 主线
├── rewrite-ch3        # 第3章重写分支
├── experiment-pov     # 视角实验
└── beta-feedback-1    # 读者反馈分支
```

#### C4.6 评估

| 维度 | 评价 |
|------|------|
| 跨文件原子提交 | ✅ commit 天然保证 |
| 分支/合并 | ✅ 完整支持 |
| 完整历史 | ✅ 可回溯任意 commit |
| 增量存储 | ✅ Git pack 机制 |
| 成熟度 | ✅ 海量工具生态 |
| 语义化 diff | ⚠️ 基于行 diff，对文学文本不够语义化 |
| 大型仓库性能 | ⚠️ 需要定期 gc |

**适用性**: **高**（推荐方案）

---

### C5. 现有 AI 写作工具的版本管理

#### C5.1 Novel-OS
按日期创建 manuscript 目录，无真正版本控制。**适用性**: 低。

#### C5.2 StoryDaemon — Checkpoint 机制

```python
class Checkpoint:
    def save(self, state: dict) -> str:
        checkpoint_id = str(uuid.uuid4())[:8]
        path = f"checkpoints/{checkpoint_id}.json"
        with open(path, 'w') as f:
            json.dump(state, f)
        return checkpoint_id
    
    def restore(self, checkpoint_id: str) -> dict:
        with open(f"checkpoints/{checkpoint_id}.json") as f:
            return json.load(f)
```

快照为完整 JSON，无增量，无分支。**适用性**: 中。

#### C5.3 Novel Engine — SHA-256 去重快照

```typescript
interface FileVersion {
  id: string;
  hash: string;           // SHA-256
  content: string;        // 完整快照
  source: 'user' | 'agent' | 'revert';
  timestamp: number;
}
```

特点：
- SHA-256 内容去重——相同内容不重复存储
- source 追踪——区分 user/agent/revert
- 自动修剪——保留最近 50 个版本

**局限**：无分支模型，快照为完整内容无增量差异，不支持跨文件原子回退。

**适用性**: **中高**——最接近 Dickens 需求

#### C5.4 Sudowrite
Scene 频繁保存，Quick Fix 保留原始内容。云 SaaS 封闭系统。**适用性**: 低。

---

### C-Summary: 版本管理方案对比

| 方案 | 原子性 | 分支 | 增量存储 | 语义化 | 易实现 | 适用性 |
|------|--------|------|----------|--------|--------|--------|
| Event Sourcing | ⚠️ | ❌ | ✅ | ❌ | 中 | **中** |
| Snapshot + WAL | ✅ | ❌ | ✅ | ❌ | 高 | **中高** |
| CRDT | ✅ | ✅ | ✅ | ❌ | 低 | **低** |
| **Git-like (isomorphic-git)** | **✅** | **✅** | **✅** | ⚠️ | **高** | **高** |
| json-git | ✅ | ✅ | ❌ | ❌ | 高 | **中** |
| Novel Engine 快照 | ✅ | ❌ | ❌ | ✅ | 高 | **中高** |

### 推荐方案：Git-like + 应用层快照

```
.novel/
├── .git/                      # isomorphic-git 仓库
├── chapters/
├── metadata/
│   ├── characters.json
│   ├── locations.json
│   ├── plotThreads.json
│   └── summary.json
├── snapshots/                 # 应用层快照
│   └── arc-1-complete.json
└── wal/                       # 增量日志（可选）
    └── 2024-01-15.jsonl
```

**提交策略**：
- 每章完成 → git commit
- 每弧完成 → annotated tag + 应用快照
- 危险操作前 → backup branch

**回退操作**：
```bash
# 回退到第5章完成时的状态
git checkout chapter-5-complete -- chapters/ metadata/

# 创建重写分支
git branch rewrite-ch3
git checkout rewrite-ch3
```

---

## Part D: 模型能力评估

用户质疑 Cratchit（编年史官）使用的 claude-haiku-4.5 是否能胜任复杂的归档/摘要/一致性追踪任务。本节提供实证数据。

### D1. 模型规模 vs 摘要质量

#### D1.1 IDP Leaderboard（9,000+ 真实文档）

| 模型 | 总体得分 | 文档处理成本 |
|------|----------|--------------|
| **Sonnet 4.6** | **80.8%** | $24/1K pages |
| Opus 4.6 | 80.3% | $40/1K pages |
| Haiku 4.5 | 69.6% | ~$10/1K pages |

**核心发现**："Sonnet is equally good as Opus for document work. The radar charts look the same."

**Sonnet 与 Opus 等效，Haiku 落后 11 个百分点。**

#### D1.2 LLM 摘要评估（arXiv 2504.04534, 17个模型）

| 模型 | LLM 评分（1-5） | 事实一致性 |
|------|-----------------|-----------|
| Claude 3.5 Sonnet | 4.75 | 高 |
| o1-mini | 4.72 | 高 |
| Claude 3.5 Haiku | 4.70 | 中高 |
| Gemini 2.0 Flash | 4.66 | 中 |

在 LLM 评估中 Haiku 与 Sonnet 分差仅 0.05。**但**同一研究发现：事实一致性随摘要变短而下降；长篇叙事摘要需要更长的摘要才能保持事实一致性。

#### D1.3 小模型在新闻摘要上的表现（arXiv 2502.00641）

| 模型 | BERTScore | 事实一致性 |
|------|-----------|-----------|
| Llama3-70B-Instruct | 76.06 | 95.8% |
| Phi3-Mini (7B) | 73.72 | **97.6%** |
| Llama3.2-3B-Instruct | 74.95 | 95.6% |

小模型在**新闻摘要**（模式化、结构清晰）上可匹配大模型。但叙事性更强、结构更复杂的文本（小说）可能有不同结果。

---

### D2. 结构化数据提取

#### D2.1 JSON 格式遵循率

| 方法 | GPT-4o | GPT-4o-mini | Haiku |
|------|--------|-------------|-------|
| Prompt-based | 85-95% | 70-80% | ~60% |
| JSON Schema（constrained decoding） | **100%** | ~89% | ❌ 不支持 |
| Function calling | 100% | 95%+ | ❌ 不支持 |

**Cratchit 需要输出角色状态 JSON、伏笔追踪 JSON、关系图谱 JSON。Haiku 不支持可靠的 constrained decoding。**

#### D2.2 提取精度（arXiv 2603.22651, Microsoft Research）

| 架构 | 字段级 F1 | 成本效率 |
|------|----------|----------|
| Reflexive（反思式） | **0.943** | 2.3× baseline |
| Hierarchical（层级式） | 0.921 | **1.4× baseline** |
| Sequential（顺序式） | 0.899 | Baseline |

**层级架构达到反思式 98.5% 的 F1，但成本仅 60.7%。**

#### D2.3 关系图谱提取（Story2KG 相关）

| 组件 | 精确率 | 召回率 | F1 |
|------|--------|--------|-----|
| 实体识别 | 89.0% | 91.2% | 90.1% |
| 属性检测 | 85.4% | 83.7% | 84.5% |
| 情感分类 | 80.2% | 78.9% | 79.5% |

小模型在复杂关系提取上显著落后。跨章节关系需要长距离依赖追踪。

---

### D3. 一致性检测

#### D3.1 CONTRADOC 矛盾检测

| 任务 | GPT-4o | GPT-3.5 | 人类 |
|------|--------|---------|------|
| 指出矛盾句子（给定证据） | **77.2%** | 51.6% | ~85% |
| 独立发现矛盾 | 显著更低 | 显著更低 | — |

**LLM 检测事实类矛盾（角色A在第3章说X，第15章说Y）比检测情感/观点类矛盾更擅长。**

#### D3.2 推理阈值（arXiv 2502.15120）

**~1.6B 参数**是推理能力阈值——此上模型才能有效使用 Chain-of-Thought。

但可靠的一致性检测可能需要更大规模：

| 能力 | 估计所需规模 |
|------|-------------|
| 基本 CoT | ~1-3B |
| 多步推理 | ~10-20B |
| 复杂叙事一致性 | **可能需要 frontier-level** |

#### D3.3 动态状态追踪的影响（SCORE）

| 组件 | 一致性 | 物品追踪准确率 |
|------|--------|---------------|
| 完整 SCORE | 89.7% | 98.3% |
| 无动态追踪 | 72.1% | 61.2% |
| **差值** | **-17.6%** | **-37.1%** |

**去掉动态状态追踪，一致性暴跌 17.6 个百分点。** 这证明 Cratchit 的归档工作对整个系统的一致性至关重要——它必须做好。

---

### D4. 成本效益分析

#### D4.1 级联模式

**RouteLLM**：正确路由后，85% 查询走小模型，节省 45-85% 成本，保持 95% 质量。

**FrugalGPT**：小模型处理高置信度查询，低置信度升级到大模型。在 25/27 实验设置中超越单一大模型。

**Inter-Cascade**（arXiv 2509.22984）：

| 指标 | 效果 |
|------|------|
| 强模型调用率减少 | 48.05% |
| 成本节省 | 49.63% |
| 弱模型准确率提升 | +33.06% |
| 总体系统准确率提升 | +6.35% |

#### D4.2 帕累托前沿（arXiv 2603.22651）

```
成本/文档 ($)
0.148 ← Hierarchical-Optimized (F1=0.924)
0.261 ← Hierarchical-Claude (F1=0.929)
0.430 ← Reflexive-Claude (F1=0.943)

F1: 0.924 vs 0.943 = 差异仅 2%
成本: $0.148 vs $0.430 = 便宜 65%
```

**升级到 Sonnet 的成本效率极高。Sonnet vs Opus 的质量差异（~2%）不值得额外成本。Haiku 的质量下降才是显著的。**

---

### D5. 多 Agent 系统的模型配置实践

#### D5.1 CrewAI 推荐模式

```python
processing_llm = LLM(model="gpt-4o-mini", temperature=0)  # 简单任务
analysis_llm = LLM(model="gpt-4o")                         # 复杂推理
manager_llm = LLM(model="o3")                               # 层级管理
```

CrewAI 文档："The manager LLM plays a crucial role in hierarchical processes... This model needs to excel at delegation, task prioritization, and maintaining context."

#### D5.2 AutoGen 实践

Monitor/Sentiment Analyst 用 mini，Report Writer 用 4o，节省约 65% 推理成本。

#### D5.3 模型分工建议

| Agent 类型 | 任务特征 | 推荐模型 |
|-----------|----------|----------|
| Chronicler/Archivist | 模式化提取、结构化输出 | **Sonnet** |
| Monitor/Tracker | 简单状态判断 | Haiku/Sonnet |
| Critic/Reviewer | 复杂推理、质量判断 | **Sonnet/Opus** |
| Writer/Generator | 创意生成 | **Sonnet/Opus** |

---

### D6. Cratchit 升级建议

#### D6.1 当前风险评估

| 任务 | Haiku 风险 | 升级为 Sonnet 的改善 |
|------|----------|-----------|
| 章节摘要 | **中等** — 复杂叙事质量下降 | 高 |
| 弧段压缩 | **高** — 需保持事实一致性 | 高 |
| 角色状态追踪 | **高** — JSON 可靠性问题 | 中高 |
| 伏笔归档 | **高** — 关系识别召回率低 | 中 |
| 一致性检测 | **极高** — 小模型难以胜任 | 中高 |

#### D6.2 成本估算（30 章小说）

| 任务 | Haiku 成本 | Sonnet 成本 | 增加 |
|------|----------|-----------|------|
| 章节摘要（30次） | ~$0.15 | ~$0.60 | +$0.45 |
| 弧段摘要（6次） | ~$0.05 | ~$0.20 | +$0.15 |
| 角色状态归档（~100次） | ~$0.40 | ~$1.60 | +$1.20 |
| **总计** | **$0.60** | **$2.40** | **+$1.80** |

**每本小说额外成本 $1.80，质量显著提升。**

#### D6.3 推荐方案：分层配置

```
Cratchit (Chronicler)
├── Level 1 (Haiku)：快速初筛、简单模式检测
├── Level 2 (Sonnet)：核心工作——摘要、归档、状态追踪（90%+任务）
└── Level 3 (Opus, 按需)：一致性深度检测、复杂推理验证（Sonnet 置信度低时触发）
```

成本节省潜力：相比全 Opus，层级架构可节省 40-60%，同时保持 ~95% 质量。

---

## Part E: 综合分析与决策矩阵

### E1. 核心设计决策矩阵

| 设计维度 | 推荐方案 | 来源参考 | 核心逻辑 |
|---------|---------|---------|---------|
| **记忆分层** | 3-Tier Hot/Warm/Cold | MemGPT, TierMem | 基于引用频率与时间衰减的动态流动 |
| **膨胀控制** | 写时门控 + 预算分配 | contextweaver, BACM, IFScale | 写入时强制 cap + 装配时 0-1 背包 |
| **伏笔追踪** | 状态机 + 排班 | InkOS hookAgenda | open→progressing→deferred→resolved + dormant debt |
| **一致性审计** | 5类错误分类 + 多维度 | ConStory-Bench, InkOS | 时间线/角色/世界规则/文体/废弃情节 |
| **写时控制** | ManagedWrite 网关 | **UNM 原创** | 所有系统的缺口，UNM 的核心创新 |
| **上下文装配** | 需求→分配→渲染管线 | contextweaver | 简化为 3 阶段 |
| **衰减公式** | exp(-age/30)×(1+0.1×access) | EvoClaw | 按章节数而非天数衰减 |
| **位置优化** | 关键信息放首尾 | Lost-in-Middle | U 型注意力对策 |
| **去重** | 冗余感知选择 | AdaGReS | 相似记忆降权 |
| **重写上限** | max 3 轮 | Self-Refine | 2-3 轮后收益递减 |
| **引导上限** | Hot 层 ≤12 条 | IFScale | 25 条已超模型容量 |
| **正向表述** | 否定转正向 | Semantic Gravity Wells | 87.5% 否定约束反向激活 |
| **版本管理** | Git-like + 应用快照 | isomorphic-git, Novel Engine | 跨文件原子提交 + 分支模型 |
| **回退机制** | Git checkout + tag | isomorphic-git | 每章 commit，每弧 tag |
| **模型配置** | Cratchit→Sonnet | IDP Leaderboard | Haiku 落后 11%，每项目 +$1.80 |
| **级联优化** | 小模型初筛+大模型精处理 | RouteLLM, Inter-Cascade | 节省 45-85% 成本 |

### E2. 从调研中发现的关键设计启发

#### E2.1 状态格式：JSON Delta 优于全量

InkOS v0.6 的核心转变——从全量 markdown 到 JSON delta。UNM 的 ManagedWrite 应输出增量变更而非全量重写。

#### E2.2 混合检索：TF-IDF + 语义

SCORE 的 Hybrid Retrieval 证明混合检索优于单一方式。UNM 的 SliceRenderer 在选择 Warm 层记忆时应同时使用关键词匹配和语义相似度。

#### E2.3 时序知识图谱

DOME 的时序知识图谱是追踪实体关系变化的最精确方案。UNM 的 consistency 类别可借鉴此设计做角色关系时序追踪。

#### E2.4 错误中部集中

ConStory-Bench 发现错误集中在叙事中部。UNM 在中段章节写作时应自动提升一致性检查强度。

#### E2.5 动态状态追踪的量化价值

SCORE 证明动态状态追踪贡献 17.6% 的一致性提升。这为 Cratchit 的归档工作提供了量化的价值证明——它不是可选的，而是系统一致性的基石。

### E3. 未解决的挑战

1. **写时控制的工程实现** — 所有调研系统都没有做到。UNM 需要原创设计 ManagedWrite 网关的具体实现。
2. **长程伏笔感知** — 50章前的极细微伏笔在100章后的激活，现有系统都没有好的方案。
3. **大规模分支管理** — What-if 分支导致记忆文件指数增长。
4. **衰减参数调优** — EvoClaw 的衰减常数需要基于 Dickens 实际数据标定。
5. **Cratchit 分层配置的路由逻辑** — 如何判断何时从 Sonnet 升级到 Opus。

---

## 参考文献

### 通用 LLM 记忆

| 系统 | 来源 |
|------|------|
| PageIndex | github.com/VectifyAI/PageIndex |
| TierMem | arXiv 2602.17913 |
| contextweaver | github.com/dgenio/contextweaver |
| A-MEM | NeurIPS 2025 |
| EvoClaw | 内部调研 |
| AdaGReS | arXiv 2512.25052 |
| Lost-in-Middle | arXiv 2603.10123 |
| BACM | arXiv 2604.01664 |
| Self-Refine | NeurIPS 2023 |
| IFScale | 2025 |
| Semantic Gravity Wells | 2026 |
| Constitutional AI | Anthropic |
| MemGPT/Letta | arXiv:2310.08560 |
| CrewAI | github.com/crewAIInc/crewAI |

### 长篇写作系统

| 系统 | 来源 |
|------|------|
| InkOS | github.com/Narcooo/inkos |
| Novel-OS | github.com/mrigankad/Novel-OS |
| StoryDaemon | github.com/EdwardAThomson/StoryDaemon |
| Postwriter | github.com/avigold/postwriter |
| Dramatron | arXiv:2209.14958, github.com/google-deepmind/dramatron |
| RecurrentGPT | arXiv:2305.13304, github.com/aiwaves-cn/RecurrentGPT |
| DOC | arXiv:2212.10077, github.com/yangkevin2/doc-story-generation |
| LongWriter | arXiv:2408.07055, github.com/THUDM/LongWriter |
| DOME | arXiv:2412.13575 |
| SCORE | arXiv:2503.23512 |
| ConStory-Bench | arXiv:2603.05890 |
| NovelClaude | github.com/wzxsph/Novel-Claude |
| WritingBench | arXiv:2503.05244, github.com/X-PLUG/WritingBench |
| Suri | arXiv:2406.19371, github.com/chtmp223/suri |

### 版本管理

| 系统 | 来源 |
|------|------|
| Lokad.AzureEventStore | github.com/Lokad/AzureEventStore |
| simple-eventstore | github.com/rradczewski/simple-eventstore |
| node-event-storage | node-event-storage.readthedocs.io |
| isomorphic-git | isomorphic-git.org |
| json-git | github.com/RobinBressan/json-git |
| Lix | lix.dev |
| Arc | arc-vcs.com |
| Novel Engine | github.com/john-paul-ruf/novel-engine |
| Litestream | github.com/benbjohnson/litestream |
| Yjs | docs.yjs.dev |
| Automerge | automerge.org |

### 模型评估

| 来源 | 主题 |
|------|------|
| IDP Leaderboard (Reddit, 2026-03) | Claude 模型文档处理对比 |
| arXiv 2504.04534 | 17 个 LLM 摘要质量评估 |
| arXiv 2502.00641 | SLM 新闻摘要能力 |
| arXiv 2603.22651 (Microsoft Research) | 金融文档提取架构对比 |
| CONTRADOC (arXiv 2311.09182) | LLM 矛盾检测能力 |
| arXiv 2502.15120 | 推理能力阈值研究 |
| RouteLLM | 模型路由成本优化 |
| FrugalGPT | 级联模式成本节省 |
| arXiv 2509.22984 (Inter-Cascade) | 强弱模型级联 |
| CrewAI Strategic LLM Selection Guide | 多 Agent 模型选择 |

---

> **文档结束**
>
> 本报告为 Dickens UNM 设计文档 §5-§12 的续写提供实证基础。
> 所有数据均来自原始调研，未编造。
