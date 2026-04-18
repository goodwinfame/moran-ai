# Dickens 约束管理系统 —— 有限引导记忆（BGM）完全重设计方案

> **文档版本**: v1.1
> **日期**: 2026-04-12
> **状态**: ⚠️ **已被 UNM 吸收** — 本方案完整保留为 UNM 的引导类别策略（GuidanceCategoryPolicy），详见 [`docs/unm-design.md`](unm-design.md) §4.3 + §7.1
>
> **后续文档**: [Dickens 统一叙事记忆（UNM）v2.0](unm-design.md) — BGM 仅解决引导/教训膨胀问题（链路1），UNM 扩展为覆盖全部 6 条数据增长链路的统一方案。

---

## 目录

1. [问题诊断](#1-问题诊断)
2. [设计哲学](#2-设计哲学)
3. [三层有限记忆模型](#3-三层有限记忆模型)
4. [数据架构](#4-数据架构)
5. [状态机：约束生命周期](#5-状态机约束生命周期)
6. [上下文装配重设计](#6-上下文装配重设计)
7. [否定转正向](#7-否定转正向)
8. [Jaggers输出改革](#8-jaggers输出改革)
9. [写手可见格式：引导卡片](#9-写手可见格式引导卡片)
10. [螺旋检测与恢复](#10-螺旋检测与恢复)
11. [实现计划](#11-实现计划)
12. [迁移策略](#12-迁移策略)
13. [注意事项与升级路径](#13-注意事项与升级路径)

---

## 1. 问题诊断

### 1.1 根因：约束熵增死亡螺旋

当前系统存在一个根本性架构缺陷：**审校发现 = 写手指令**。

Jaggers 每发现一个问题，就自动变成一条永久教训塞进写手 prompt。这导致：

1. 每轮审校生成新教训
2. 教训单调递增（只增不减）
3. 所有 active 教训全量注入写手上下文（P1优先级）
4. 写手被淹没 → 少写以避免违规 → 质量下降
5. 质量下降触发更多修正 → 更多教训 → 循环


### 1.2 实证数据

**第1章字数变化时间线**：

| 时间 | 事件 | 内容字数(chars) | 驱动因素 |
|------|------|----------------|---------|
| v1 (4/11 15:21) | 宝玉首稿 | 8,045 | 写作目标 8000-10000字 |
| v2 (4/11 15:53) | 大幅删减 | 3,677 | 审校退回重写 |
| v3 (4/11 18:53) | 重写恢复 | 5,924 | 重写 |
| 4/12 03:17 | **用户主动降低字数目标** | — | 用户指示"字数太长了，只写5000字" |
| 4/12 03:33 | **用户补充说明** | — | "不要很简单的剧情硬要写满多少字" |
| v4 (4/12 05:03) | daiyu重写 | 5,869 | 写作目标调至 5000-6000字 |
| v5 (4/12 06:38) | baoyu重写 | 5,860 | 审校退回换写手 |
| v6 (4/12 12:20) | baoyu修订 | 4,998 | 审校循环中持续编辑 |
| 当前 (edit v7-v41) | 局部编辑 | 2,766 | Jaggers多轮退回→编辑清理 |

**关键区分**：
- 8,045 → 5,869：**用户主动决策**——字数目标从"8000-10000"降至"5000-6000"，属于合理的写作要求调整，不是系统退化
- 5,869 → 2,766：**系统退化信号**——在用户设定的5000字目标下，审校循环持续压缩字数至目标的47%，这才是约束过载的表现

> ⚠️ 注：manifest.json 记录的是 content 字节数（UTF-8 编码后），文件系统字节数约为 2.8 倍（中文3字节/字 + markdown overhead），本文档统一使用 content chars。

**其他退化指标**：

| 指标 | 数值 |
|------|------|
| 教训总数 | 25条，19条active，14条must-fix |
| 矛盾教训对 | les-003 vs les-023, les-009 vs les-024 |
| 审校循环中字数持续萎缩 | v4(5,869) → 当前(2,766)，在5000字目标下缩水53% |
| edit版本累积 | v6之后有35次局部编辑（v7-v41），均未触发正式版本记录 |

### 1.3 学术验证

| 论文 | 核心发现 | 与当前系统的关联 |
|------|---------|----------------|
| Self-Refine (NeurIPS 2023) | 迭代修正2-3轮后收益递减 | 第1章6次重写远超有效阈值 |
| Contextual Drag (ICLR 2026) | 上下文错误偏置后续生成 | 错误教训污染后续所有版本 |
| IFScale (2025) | 500条指令时准确率仅68% | 25条教训已超出模型有效指令容量 |
| Over-Specification Paradox (UCL 2026) | 超阈值S*=0.509后性能二次衰减 | 约束密度超过临界点 |
| Semantic Gravity Wells (2026) | 87.5%的否定约束反向激活被禁内容 | "不要强调异常"反而激活异常描写 |
| Constitutional AI (Anthropic) | 从规则列表→培养判断力 | 当前系统是纯规则列表模式 |
| MemGPT/Letta | 三层记忆+主动遗忘+记忆压力淘汰 | 当前系统无遗忘机制 |
| Generative Agents (Stanford) | 记忆流+反思压缩+加权检索 | 当前系统无相关性检索 |

---

## 2. 设计哲学

### 2.1 核心理念

> **把"教训列表"替换为"有限引导记忆"：审校输出是证据，不是记忆。只有极少数经过筛选、衰减、正向表述的引导卡片才能到达写手。**

### 2.2 四条铁律

| # | 铁律 | 解释 |
|---|------|------|
| 1 | **反馈是证据，不是记忆** | 审校发现先进"证据库"，不自动变成写手指令 |
| 2 | **记忆必须竞争上下文** | 写手可见的引导是稀缺资源，必须争夺 token 预算 |
| 3 | **遗忘是功能，不是Bug** | 约束有衰减、有冷却、有归档——掌握了就淡出 |
| 4 | **原则胜过禁令** | 写手收到的是正向引导卡片，不是"不准做X"清单 |


---

## 3. 三层有限记忆模型

### 3.1 架构总览

```
+-------------------------------------------+
|  Tier 1: 宪法 (Constitution)               |  <-- 项目级原则，3-7条，极少变动
|  例: "让权力具象化"                          |
+-------------------------------------------+
|  Tier 2: 模式 (Pattern)                     |  <-- 可复用写作技法引导
|  例: "回忆闪回控制在3行以内"                  |      衰减+冷却，最多12条存储/3条注入
+-------------------------------------------+
|  Tier 3: 补丁 (Patch)                       |  <-- 当前章节局部修复
|  例: "第3段时间线对不上"                      |      通过即消失，最多2条注入
+-------------------------------------------+

              其余全部
                 |
                 v
+-------------------------------------------+
|  证据归档 (Archive/Evidence)                |  <-- 历史记录，写手永远看不到
|  可无限增长，不影响写手上下文                  |
+-------------------------------------------+
```

### 3.2 关键变化

| 维度 | 旧系统 | 新系统 |
|------|--------|--------|
| 写手可见约束数 | 全部active（19-25条） | 最多6-7张卡片 |
| 约束生命周期 | 永久active | candidate→active→cooling→archived |
| 约束格式 | "不要做X"禁令列表 | 正向引导卡片：When/Do/Why |
| 审校输出 | 直接变成永久教训 | 先进证据库，经路由才可能晋升 |
| 冲突处理 | 全部注入，写手自己判断 | 冲突隔离，永不到达写手 |
| 遗忘机制 | 无 | 掌握衰减、时间冷却、自动归档 |
| 螺旋检测 | 无 | 4信号监控+3级恢复模式 |


---

## 4. 数据架构

### 4.1 核心实体：GuidanceNode（替代 Lesson）

```typescript
type GuidanceTier = 'constitution' | 'pattern' | 'patch'

type GuidanceState =
  | 'candidate'    // 候选，还没有足够证据
  | 'active'       // 活跃，会被注入写手上下文
  | 'cooling'      // 冷却中，写手已掌握或近期无关
  | 'resolved'     // 补丁已解决
  | 'archived'     // 归档，永不注入
  | 'conflicted'   // 冲突隔离区，永不注入
  | 'superseded'   // 已被取代

type GuidanceSeverity = 'critical' | 'important' | 'optional'
type GuidanceOrigin = 'review' | 'human' | 'canon' | 'migration'

interface GuidanceScope {
  permanence: 'chapter' | 'arc' | 'project'
  chapters?: number[]
  chapterRange?: [number, number]
  arcIds?: number[]
  povs?: string[]
  sceneTypes?: ('setup'|'conflict'|'reveal'|'transition'|'reflection'|'action')[]
  characters?: string[]
  locations?: string[]
  modes?: ('write'|'revise'|'rewrite')[]
}

interface EvidenceRef {
  type: 'review' | 'human-note' | 'canon-doc' | 'migration'
  chapterNumber?: number
  version?: number
  reviewer?: string
  excerpt?: string
  issueType?: string
  createdAt: string
}

interface GuidanceMetrics {
  timesRetrieved: number        // 被选中注入次数
  successfulUses: number        // 注入后写手没违反
  failedUses: number            // 注入后写手仍违反
  lastRetrievedChapter?: number
  lastTriggeredChapter?: number
  lastSatisfiedChapter?: number
  eligibleChapterCount: number  // 适用的章节总数
}

interface GuidanceRelation {
  type: 'derived-from' | 'supports' | 'specializes' | 'conflicts' | 'supersedes'
  targetId: string
  note?: string
}

interface GuidanceNode {
  id: string
  tier: GuidanceTier
  state: GuidanceState

  // ---- 写手可见部分（正向表述）----
  title: string           // 简短标题，如"让权力具象化"
  topic: string           // 归一化主题，如"institutional-power"
  directive: string       // 正向行动指令
  when: string            // 适用条件
  why: string             // 预期效果

  // ---- 后端专用（永不注入写手）----
  antiPattern?: string    // 反面模式，仅供系统检测用
  replacementStrategy?: string

  severity: GuidanceSeverity
  origin: GuidanceOrigin
  sourcePriority: number  // canon=4 > human=3 > pattern=2 > patch=1
  confidence: number      // 0..1

  scope: GuidanceScope
  evidence: EvidenceRef[]
  relations: GuidanceRelation[]
  metrics: GuidanceMetrics

  createdAt: string
  updatedAt: string
  expiresAtChapter?: number   // 补丁/候选的过期章节
  halfLifeChapters?: number   // 衰减半衰期
}
```


### 4.2 审校发现：ReviewFinding（替代直接创建教训）

```typescript
type PermanenceHint = 'patch' | 'candidate-pattern' | 'principle-review' | 'discard'

interface ReviewFinding {
  id: string
  chapterNumber: number
  version: number
  category: 'structure' | 'continuity' | 'style' | 'clarity' | 'canon'
  severity: GuidanceSeverity

  summary: string          // 问题摘要
  evidence: string         // 原文引用
  impact: string           // 影响
  positiveFix: string      // 正向修复建议（必填！）
  antiPattern?: string     // 反面模式（可选）

  scopeHint: 'local' | 'recurring' | 'project' | 'preference'
  permanenceHint: PermanenceHint

  status: 'new' | 'routed' | 'resolved' | 'expired'
  routedNodeIds?: string[] // 路由到了哪些 GuidanceNode
  createdAt: string
}
```

### 4.3 冲突追踪

```typescript
interface ConflictSet {
  id: string
  topic: string
  nodeIds: string[]
  resolution: 'scoped-split' | 'winner-takes-precedence' | 'manual-review'
  activeNodeIds: string[]
  archivedNodeIds: string[]
  note: string
  createdAt: string
  updatedAt: string
}
```

### 4.4 存储布局

```
metadata/guidance/
  constitution.json           <-- 宪法原则（热路径）
  active.json                 <-- 活跃模式+补丁（热路径）
  conflicts.json              <-- 冲突隔离区
  health.jsonl                <-- 健康快照（追加写入）
  findings/
    ch-0001.json              <-- 按章节存储的审校发现
    ch-0002.json
  archive/
    archive-0001-0100.ndjson  <-- 归档证据（冷存储）
    archive-0101-0200.ndjson
  migration-report.json       <-- 迁移报告
```

**热路径规则**：context-builder 只读取 `constitution.json` + `active.json` + 当前章节 findings/patches。归档数据**永不**加载到写手上下文。


---

## 5. 状态机：约束生命周期

### 5.1 补丁 (Patch) 生命周期

```
[审校发现] --> candidate --> active --> resolved（章节通过）
                                   --> expired（超过2次重写仍未解决）
                                   --> promoted to pattern（跨章重现）
```

- 默认 TTL：当前章节 + 2次重写
- 章节通过后自动归档
- 如果跨章节重现，路由为模式候选

### 5.2 模式 (Pattern) 生命周期

```
[补丁晋升/人工确认] --> candidate --> active --> cooling --> archived
                                           \
                               conflicted <--+（检测到冲突时）
                               superseded <--（被更好的取代时）
```

**晋升条件**（candidate -> active，全部满足）：

- 正向表述已确认
- 无未解决冲突
- 证据 >= 3条，跨 >= 2个章节；**或**证据 >= 2条 + 人工确认
- 作用域可以具体描述

**冷却条件**（active -> cooling，任一满足）：

- 最近6个适用章节的掌握率 >= 0.8
- 连续8个适用章节未被检索
- 被更具体的规则取代

**归档条件**（cooling -> archived，任一满足）：

- 连续12个适用章节未被检索
- 掌握率持续高位且无新违反
- 项目已离开相关弧段/范围

### 5.3 宪法 (Constitution) 生命周期

```
[源文档/人工] --> draft --> active --> retired | superseded
```

- 宪法原则来自项目设定文档和人工决策，**不由审校自动产生**
- 极少变动，最多7条，目标5条

### 5.4 数量硬上限

| 层级 | 存储上限 | 注入上限 |
|------|---------|---------|
| 宪法 | 7条 | 3条 |
| 活跃模式 | 12条 | 3条 |
| 补丁 | 无存储限制 | 2条 |

这是约束熵的核心制动器。


---

## 6. 上下文装配重设计

### 6.1 当前问题

- 教训在 write 模式是 P1，在 revise 模式是 P0
- 所有 active 教训全量注入，2000字符上限
- 25条教训塞满预算，挤占故事/角色/世界的空间
- P0/P1/P2 三级太粗糙，无法精细控制预算分配

### 6.2 新方案：硬预算分区

#### Write 模式（首次写作）

| 分区 | 预算占比 | 内容 |
|------|---------|------|
| 故事任务+章节节拍 | 35% | 计划、目标、beats |
| 连续性（角色/世界/线索） | 30% | 角色档案、世界设定、前文摘要 |
| 场景/声音锚点 | 8% | 文风指南、示范段落 |
| **引导卡片** | **12%，硬上限 900 tokens** | **最多6张卡片** |
| 弹性预留 | 15% | 应对超长角色档案等 |

#### Revise 模式（局部修改）

| 分区 | 预算占比 | 内容 |
|------|---------|------|
| 退回指令+本次目标 | 20% | Jaggers 反馈 |
| 相关连续性 | 22% | 需要的角色/世界信息 |
| 当前章节锚点 | 18% | 待修改段落上下文 |
| **引导+补丁** | **18%，硬上限 1200 tokens** | **最多7张卡片** |
| 弹性预留 | 22% | |

#### Recovery 模式（螺旋触发后）

| 分区 | 预算占比 | 内容 |
|------|---------|------|
| 章节计划+主要目标 | 40% | 只留核心故事任务 |
| 连续性 | 30% | 精简版 |
| **引导** | **10%** | **最多4张卡片（宪法2+模式1+补丁2）** |
| 弹性预留 | 20% | |

### 6.3 引导卡片注入上限（铁律）

| 模式 | 宪法 | 模式 | 补丁 | 总计 |
|------|------|------|------|------|
| write | <=3 | <=3 | 0 | **<=6** |
| revise | <=3 | <=2 | <=2 | **<=7** |
| rewrite | <=2 | <=2 | <=2 | **<=6** |
| recovery | <=2 | <=1 | <=2 | **<=4** |


### 6.4 选择算法

```typescript
function score(node: GuidanceNode, chapterDescriptor: ChapterDescriptor): number {
  return (
    0.40 * scopeOverlap(node.scope, chapterDescriptor) +  // 作用域匹配
    0.20 * severityWeight(node.severity) +                 // 严重程度
    0.20 * failurePressure(node) +                         // 近期失败率
    0.10 * recency(node) +                                 // 时间衰减
    0.10 * sourcePriority(node) -                          // 来源优先级
    0.20 * mastery(node) -                                 // 掌握度扣减
    0.20 * conflictPenalty(node)                            // 冲突惩罚
  )
}
```

**权重说明**：

| 因子 | 权重 | 含义 |
|------|------|------|
| scopeOverlap | +0.40 | 与当前章节的作用域匹配度（模式、弧段、POV、场景类型、角色、场所） |
| severityWeight | +0.20 | critical=1.0, important=0.7, optional=0.4 |
| failurePressure | +0.20 | 近期失败次数/近期检索次数 |
| recency | +0.10 | 按章节距离衰减 |
| sourcePriority | +0.10 | canon=4 > human=3 > pattern=2 > patch=1 |
| mastery | -0.20 | 成功次数/适用次数（越高越不需要注入） |
| conflictPenalty | -0.20 | 有未解决冲突=1.0，否则=0 |

### 6.5 检索流程

```
1. 加载 constitution.json + active.json + 当前章节 patches
2. 过滤掉 conflicted / archived / resolved / superseded
3. 对每个 pattern 按章节描述符打分
4. 按 topic 聚类，每个 topic 只保留最高分节点
5. 冲突检查（若仍有冲突，隔离低分方）
6. 按预算和卡片上限截断
7. 渲染为正向引导卡片
```


---

## 7. 否定转正向

### 7.1 核心发现

Semantic Gravity Wells 论文证明 **87.5% 的否定约束（"不要做X"）反而激活被禁行为**。

当前系统的教训大量使用否定句式：
- "不要强调异常"
- "不要开篇描写设定"
- "禁止使用技术细节"

这些否定指令在模型的注意力中反而**强化**了被禁止的概念。

### 7.2 转换规则

所有写手可见引导**必须是正向表述**。系统维护 `antiPattern` 字段但**永不注入**给写手。

| 原始（禁止） | 转换后（引导） |
|-------------|-------------|
| "不要强调异常" | **When** 异常不是本场决策触发器时 **Do** 聚焦角色即时目标，通过感知只揭示一处不规则 **Why** 保持张力不滑向说明文 |
| "不要开篇描写设定" | **When** 章节开头 **Do** 以角色的感官和行动带入场景 **Why** 读者通过角色眼睛发现世界 |
| "必须写权限运用" | **When** 场景涉及身份/权限/地位 **Do** 展示谁能阻挡、需要什么、交换了什么 **Why** 让制度权力变成戏剧冲突 |
| "禁止使用技术细节" | **When** 角色使用系统功能时 **Do** 用角色的主观体验和感受来呈现 **Why** 维持沉浸感 |

### 7.3 无法转正向的处理

如果系统无法推导出正向替代方案，该发现**不得晋升为活跃引导**，只保留为证据归档。

这确保了写手永远不会收到"不要做X"式的指令。


---

## 8. Jaggers 输出改革

### 8.1 当前问题

Jaggers 审校输出没有数量限制，每个发现都可能变成永久教训。这是约束爆炸的源头管道。

### 8.2 新审校报告格式

```typescript
interface ReviewReport {
  verdict: 'pass' | 'revise' | 'rewrite'
  dominantIssue?: string        // 主要问题（只1个）

  score: {
    overall: number
    structure: number
    scene: number
    prose: number
    continuity: number
  }

  findings: ReviewFinding[]     // 硬上限：最多3条
}
```

### 8.3 硬限制

| 规则 | 限制 |
|------|------|
| 总发现数 | **<= 3** |
| primary 发现 | **恰好1条** |
| 可建议永久化的发现（permanenceHint != 'patch'/'discard'） | **<= 1条/每次审校** |
| preference 类型 | 默认 `discard`，不进入引导系统 |
| 纯否定表述 | **禁止**，必须提供 `positiveFix` |
| 第2次+重写后的审校 | 最多 1 primary + 1 secondary |

### 8.4 分类路由表

每条 ReviewFinding 根据 `scopeHint` 和 `permanenceHint` 路由：

| Finding 类型 | 路由 | 默认生命期 |
|-------------|------|-----------|
| 单次文本/局部问题 | `patch` | 章节通过或2次重写 |
| 同一章节多版本重复 | `patch` | 同上 |
| 跨2+章节重复 | `candidate pattern` | 6章验证期 |
| 源文档/世界观/POV 不变量 | `principle review` | 批准后永久 |
| 偏好/口味 | `discard` 或归档 | 永不写手可见 |
| 纯否定无正向方案 | 归档为证据 | 永不活跃 |

### 8.5 晋升规则

| 转换 | 条件 |
|------|------|
| patch -> resolved | 章节通过，或审校不再标记该问题 |
| patch -> pattern candidate | 同一归一化topic在 **2个不同章节** 失败，或在 **12章内出现3条** findings |
| candidate -> active | 正向表述存在 + 无冲突 + 证据>=3跨>=2章（或>=2+人工确认）+ 作用域可描述 |
| active -> cooling | 掌握率>=0.8（6章）/ 8章未检索 / 被更具体规则取代 |
| cooling -> archived | 12章未检索 / 掌握率高+无新违反 / 项目离开相关范围 |


---

## 9. 写手可见格式：引导卡片

### 9.1 卡片格式

```
[原则] 让权力具象化
When: 场景涉及身份、权限、地位
Do: 展示谁能阻挡进展、需要什么代价、交换了什么
Why: 让抽象等级变成戏剧冲突
```

```
[技法] 闪回三行原则
When: 需要回忆或倒叙时
Do: 将回忆压缩到3行以内，用感官细节而非叙述
Why: 防止节奏断裂，保持读者在当前场景
```

```
[补丁] 第3段时间线修正
When: 修改第3段
Do: 林若溪离开面馆后是"黄昏"不是"午后"
Why: 与第2章开头衔接
```

### 9.2 Prompt 中的位置

引导卡片放在**故事任务之后**，不是之前。这确保写手的注意力优先在故事上。

```
1. 本章主要目标（章节计划/beats）
2. 前文摘要+连续性事实
3. 角色/世界设定
4. 【引导卡片】（最多6张）
5. 文风/声音锚点
```

### 9.3 压缩规则

- 同 topic 合并为1张卡片
- 已掌握的模式（cooling状态）不注入
- 每个 topic 聚类只保留最高分
- revise 模式的补丁合并为最多2条任务


---

## 10. 螺旋检测与恢复

### 10.1 健康快照

每章每版本记录一条健康快照，追加到 `health.jsonl`：

```typescript
interface GuidanceHealthSnapshot {
  chapterNumber: number
  version: number
  mode: 'write' | 'revise' | 'rewrite'

  wordCount: number
  targetWordCount: number        // 用户设定的字数目标（从大纲/项目配置读取）
  bestHealthyWordCount: number   // 在当前目标下的历史最佳健康字数
  reviewScore: number
  rewriteCount: number

  guidanceTokens: number       // 引导占用的 token 数
  visibleGuidanceCount: number // 注入的引导卡片数
  activePatternCount: number
  openPatchCount: number
  conflictCount: number

  dominantIssue?: string
  spiralScore: number
  createdAt: string
}
```

### 10.2 螺旋分数

```typescript
spiralScore =
  0.30 * shrinkSignal +      // 字数萎缩信号
  0.25 * scoreDropSignal +   // 分数连续下降信号
  0.20 * guidancePressure +  // 引导 token 超预算比例
  0.15 * patchCarryover +    // 补丁延续到下一章比例
  0.10 * conflictPressure    // 未解决冲突数/总活跃数
```

**各信号计算**：

| 信号 | 触发条件 | 值 |
|------|---------|------|
| shrinkSignal | 当前字数 / bestHealthyWordCount < 0.7 | 1.0 |
| scoreDropSignal | 连续2次重写分数下降 | 1.0 |
| guidancePressure | 引导 token 超出预算比例 | 0..1 |
| patchCarryover | 上一章补丁延续到本章的比例 | 0..1 |
| conflictPressure | 未解决冲突数 / 总活跃引导数 | 0..1 |

> **关键：`bestHealthyWordCount` 的基线逻辑**
>
> `bestHealthyWordCount` 不是简单的历史最大字数，而是**在当前 `targetWordCount` 下的最佳健康字数**：
>
> 1. **用户调整字数目标时**（如从8000降到5000），`bestHealthyWordCount` 必须重置为新目标值，旧基线作废
> 2. **健康字数定义**：审校分数 >= 70 且未处于恢复模式时的字数
> 3. **更新规则**：`bestHealthyWordCount = max(bestHealthyWordCount, wordCount)` 仅在健康版本上执行
> 4. **目的**：区分"用户主动要求精简"（合理的目标调整）和"审校循环导致萎缩"（系统退化）
>
> 例：用户设定5000字目标 → daiyu写出5,869字（健康基线） → 审校循环压到2,766字 → shrinkSignal = 2766/5869 = 0.47 < 0.7 → 触发。
> 而如果用户主动从8000降到5000，不会触发——因为基线已随目标重置。

### 10.3 触发条件

**硬触发**（任意2条同时成立即触发恢复模式）：

1. 字数 < bestHealthyWordCount 的 70%，连续2次重写（基线已排除用户主动调整因素）
2. 审校分数连续2次重写下降
3. 同一 dominantIssue 重复出现，且引导数量增加了
4. 未解决冲突存活到第2次重写
5. 可见引导数量超过上限

**分数触发**：`spiralScore >= 0.65`

### 10.4 恢复模式三级

| 级别 | 触发条件 | 操作 |
|------|---------|------|
| **R1: 减负恢复** | 首次触发 | 冻结所有晋升；宪法<=2 + 模式<=1 + 补丁<=2；选1个主要目标 |
| **R2: 全新重写** | R1失败 | 不喂回之前章节文本；从大纲+连续性+1主目标+1副约束重新生成；用最后健康版本做参考 |
| **R3: 重置+人工** | R2失败2次 | 恢复到最后健康版本；归档所有失败补丁；请求人工决策 |

**关键设计**：退化是一个**系统可检测状态**，不是模糊感觉。健康快照提供量化数据支持决策。


---

## 11. 实现计划

### 11.1 新文件

| 文件 | 职责 | 预估 LOC |
|------|------|---------|
| `src/guidance/guidance-types.ts` | 所有类型定义（GuidanceNode, ReviewFinding, ConflictSet, HealthSnapshot） | 150-200 |
| `src/guidance/guidance-store.ts` | 读写 guidance JSON 文件，hot path 优化 | 200-300 |
| `src/guidance/guidance-router.ts` | 审校发现 -> 分类路由 -> 晋升/降级/归档 | 300-400 |
| `src/guidance/guidance-retriever.ts` | 打分 + 选择 + topic 聚类 + 渲染卡片 | 250-350 |
| `src/guidance/guidance-conflicts.ts` | 冲突检测 + 解决算法 | 150-200 |
| `src/guidance/guidance-health.ts` | 健康快照 + 螺旋检测 + 恢复触发 | 200-250 |
| `src/guidance/guidance-migrate.ts` | 旧 lessons -> 新系统迁移 | 150-200 |

### 11.2 修改文件

| 文件 | 变更内容 |
|------|---------|
| `src/context/context-builder.ts` | 删除 `buildLessonsContext()`；新增 `buildGuidanceContext()`；替换 `assembleWithBudget()` 为分区预算装配器 |
| `src/tools/novel-lesson.ts` | 改为兼容性包装器（learn -> 创建 finding，list -> 列出活跃引导，deactivate -> 归档） |
| `src/agents/dickens.md` | 重写 Jaggers 输出协议；添加路由/晋升/恢复规则 |
| `src/agents/jaggers.md` | 新审校报告格式（3发现上限 + 正向修复 + permanenceHint） |
| `src/agents/weller.md` | 适配引导卡片格式 |
| `src/agents/baoyu.md` | 适配引导卡片格式 |
| `src/agents/daiyu.md` | 适配引导卡片格式 |
| `src/agents/xifeng.md` | 适配引导卡片格式 |
| `src/agents/cratchit.md` | 章节通过时 resolve patches + 追加健康快照 |

### 11.3 实施顺序（依赖关系）

```
Phase 1: 基础层
  1. guidance-types.ts          <-- 类型定义，无依赖
  2. guidance-store.ts          <-- 存储层

Phase 2: 核心逻辑
  3. guidance-router.ts         <-- 路由 + 否定转正向
  4. guidance-conflicts.ts      <-- 冲突检测与解决

Phase 3: 上下文集成
  5. guidance-retriever.ts      <-- 检索 + 打分 + 渲染
  6. context-builder.ts 修改     <-- 分区预算装配

Phase 4: Agent 协议（必须与 Phase 2-3 同步发布）
  7. jaggers.md 改革             <-- 新审校报告格式
  8. dickens.md 重写             <-- 路由/恢复逻辑
  9. 写手 agent 适配             <-- 引导卡片格式

Phase 5: 监控与恢复
  10. guidance-health.ts        <-- 健康监控 + 恢复模式
  11. cratchit.md 更新          <-- 健康快照追加

Phase 6: 迁移与兼容
  12. guidance-migrate.ts       <-- 迁移工具
  13. novel-lesson.ts 兼容层     <-- 旧接口适配
```

### 11.4 总工作量

| 模块 | LOC |
|------|-----|
| 新 guidance 核心 | ~1200-1600 |
| context-builder 改造 | ~300-500 |
| Agent prompt 改写 | ~200-350 |
| 迁移 + 兼容层 | ~300-500 |
| **总计** | **~2000-3000 LOC** |


---

## 12. 迁移策略

### 12.1 对现有项目的处理

迁移算法：

```
1. 冻结自动学习
2. 导出旧 lessons.json
3. 对每条教训归一化 topic / directive / scope
4. 检测冲突对
5. 分类路由（见下表）
```

| 条件 | 去向 |
|------|------|
| 全项目通用 + 来自设定文档 + 可正向表述 | **宪法** |
| 跨多章重现 + 可泛化 + 有正向表述 | **模式候选** |
| 绑定当前未解决章节 + 局部即时 | **补丁** |
| 仅偏好 / 冲突方低优先 / 无正向表述 / 已过时 / 一次性已满足 | **归档证据** |

### 12.2 当前项目预期结果

当前25条教训迁移后预期：

| 去向 | 数量 | 说明 |
|------|------|------|
| 宪法原则 | 3-5条 | 如"让权力具象化"、"角色感官带入" |
| 活跃模式 | 3-5条 | 如"闪回三行"、"一场一异常" |
| 补丁 | 0-2条 | 针对当前第1章的局部修复 |
| 归档 | 15+条 | 含冲突对、偏好、已过时 |

### 12.3 正在重写困难中的章节

```
1. 找到最后一个健康版本
2. 清除旧教训对 prompt 的影响
3. 只从最近一次审校创建补丁队列
4. 以 R1 或 R2 恢复模式运行下一轮
5. 章节健康稳定后才允许新的模式晋升
```

### 12.4 向后兼容

过渡期保留 `novel-lesson.ts` 作为兼容外壳：

| 旧操作 | 新映射 |
|--------|--------|
| `learn` | 创建 ReviewFinding |
| `list` | 列出活跃引导 + 近期 findings |
| `read` | 读取 GuidanceNode 详情 |
| `deactivate` | 归档节点 |
| `resolve` | 解决冲突/归档 |
| `audit` | 运行冲突/压力报告 |
| `scan` / `scan_chapter` | 保留原逻辑 |

新管道稳定后移除兼容层。

---

## 13. 注意事项与升级路径

### 13.1 关键风险

1. **Jaggers prompt 改革和 router 必须同步发布**——否则旧格式输出会通过新管道继续制造过载
2. **迁移应保守**——不确定的一律归档，不要晋升
3. **检索质量依赖章节描述符**——先用大纲衍生的标签（场景类型、角色、场所），不要用自由文本语义匹配

### 13.2 升级路径

| 阶段 | 触发条件 | 升级内容 |
|------|---------|---------|
| V1（本次） | 立即 | 文件 JSON + 确定性排名 |
| V2 | 活跃模式经常撞12条上限 | 宪法/设定文档粒度太细，需要合并 |
| V3 | 确定性 scope 匹配不够精确 | 添加语义检索（embedding + SQLite） |

### 13.3 设计验证标准

本方案成功的标志：

- [ ] 写手上下文中引导部分 <= 900 tokens（write模式）
- [ ] 同一章节不超过3次重写即通过审校
- [ ] 迁移后活跃引导数 <= 10（宪法+模式+补丁）
- [ ] 无否定表述到达写手
- [ ] 螺旋检测在字数相对 bestHealthyWordCount 萎缩 30% 前触发（用户主动调整不计入）

---

> **文档结束**
>
> 本文档是 Dickens 约束管理系统从"教训列表"到"有限引导记忆"的完全重设计方案。
> 核心变化：**审校输出不再等于写手指令**。只有有限、衰减、无冲突、正向表述的引导工作集才能到达模型。

