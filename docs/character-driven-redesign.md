# 角色驱动涌现叙事：完整重设计方案

> **opencode-dickens 写作系统从「剧情驱动」到「角色驱动涌现叙事」的架构级重设计**

---

## 目录

1. [设计背景与动机](#1-设计背景与动机)
2. [核心设计哲学：三层架构](#2-核心设计哲学三层架构)
3. [六大设计原语](#3-六大设计原语)
4. [新增数据结构](#4-新增数据结构)
5. [六阶段工作流重设计](#5-六阶段工作流重设计)
6. [导演决策树](#6-导演决策树dickens-level-2-行为)
7. [各 Agent 变更明细](#7-各-agent-变更明细)
8. [新旧对比](#8-新旧对比)
9. [实施优先级](#9-实施优先级)
10. [不变的部分](#10-不变的部分)

---

## 1. 设计背景与动机

### 1.1 现有系统的问题

当前系统是**剧情驱动**的：

```
Phase 3 (Wemmick) 设计详细的弧段规划，每章包含：
  → 场景概要、核心事件、情感走向、伏笔触发、章末钩子

Phase 4 (Weller) 按章节详案执行：
  → 核心事件是「唯一的硬约束」，必须完成
```

这种模式的本质问题：**角色是剧情的工具，而非剧情的来源。**

写手 Agent 收到的指令是「在这个场景完成这个事件」，而非「这个角色带着这样的心理状态进入这个情境，他会怎么做？」

经审计，当前系统共有 **16 个剧情约束点**分布在 14 个文件中，其中 10 个是「硬约束」——必须改变才能实现角色驱动叙事。

### 1.2 目标愿景

> 每个角色都是鲜活的，都有各自的人生，他们在设定好的世界中探索、生活，世界也会有各种各样的随机事件发生。所谓剧情其实就像一只无形的手，会推动角色朝命运指引的方向发展。基于这个思路，我们不应该设定很强的剧情细节，而应该让故事自然生长，但故事人物的发展走向偏离设定时，我们可以通过触发突发事件、引入新的概念、设定等，推着人物朝既定方向走。

### 1.3 学术与业界支撑

| 来源 | 核心贡献 |
|------|----------|
| **StoryVerse** (Autodesk, 2024) | 「抽象行为」(Abstract Acts) — 高层叙事目标 + 前置条件 + 占位符 |
| **DiriGent** (ETH Zurich, AAAI 2025) | 信念-张力操控 — 调整世界状态来放大角色内心冲突，而非编排角色动作 |
| **StoryBox** (2024) | 模拟优先 + 自底向上故事生成 + `abnormal_factor` 戏剧刻度盘 |
| **Stanford Generative Agents** (2023) | 三层记忆 + 反思触发 + 重要性累积阈值机制 |
| **RimWorld** Cassandra Classic | 威胁池 + 戏剧曲线 + 冷却机制 = 叙事节奏算法 |
| **Dwarf Fortress** | 模拟深度产生叙事涌现 — 角色心理档案 + 因果链保证连贯性 |
| **K.M. Weiland / John Truby** | Ghost → Wound → Lie → Want vs Need = 角色弧引擎 |
| **Donald Maass** | 非剧情小说四问检查 — 场景级角色驱动验证协议 |

---

## 2. 核心设计哲学：三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Level 3 — 创作层 (AUTHORIAL)  ← 无形的手                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • 抽象行为 (Abstract Acts): 4-6个结构门 (全书级)        ││
│  │ • 张力累积器 (Tension Accumulator): 节奏控制算法        ││
│  │ • 谎言对质追踪器 (Lie-Confrontation Tracker): 弧线保证  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Level 2 — 导演层 (DIRECTORIAL)  ← 航向修正                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Dickens 监控张力分数 + 谎言压力状态                   ││
│  │ • 触发「世界事件」来扩大角色信念差距                     ││
│  │ • 绝不编排角色动作 — 只制造外部压力                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Level 1 — 模拟层 (SIMULATION)  ← 80%的故事在此诞生        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Weller/Baoyu 接收角色DNA + 近期上下文                 ││
│  │ • 从角色内心出发自由写作（不接收剧情指令）               ││
│  │ • 自然涌现新角色、新地点、新情节线                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：

| 原则 | 说明 |
|------|------|
| Level 3 一次性建立 | 设计阶段（Phase 3）设定，写作阶段不再修改结构门 |
| Level 2 按需触发 | 每章归档后 Dickens 检查，但**大多数章节不需要干预** |
| Level 1 每章运行 | 写手从角色心理出发自由创作——这是故事生长的主引擎 |
| 80/20 原则 | 80%章节是纯 Level 1（自由生长），20%有 Level 2 导演介入 |

---

## 3. 六大设计原语

以下六个原语是整个重设计的基石，所有工作流变更都建立在它们之上。

### 原语 1：角色DNA文档 (Character DNA)

**来源**：K.M. Weiland 的 Ghost/Wound/Lie 体系 + StoryBox 的 abnormal_factor

**核心思想**：每个角色内置一个「弧线引擎」——Ghost 产生 Wound，Wound 催生 Lie，Lie 驱动 Want，而 Need 与 Want 的冲突就是故事的燃料。

```
Ghost (幽灵)    → 过去发生的定义性创伤事件
  ↓ 产生
Wound (创伤)    → 此刻仍在运作的心理伤痕
  ↓ 催生
Lie (谎言)      → 角色为了存活而形成的错误信念
  ↓ 驱动
Want (表面欲望)  → 角色以为自己需要什么（外在目标）
  ↕ 冲突
Need (真实需要)  → 角色真正需要什么才能成长（往往与 Want 矛盾）
```

**关键**：写手不需要知道「角色要做什么」，只需要知道角色的 DNA——角色的行为会从 DNA 中自然涌现。

**额外参数**：
- `behavioral_signature`：角色在不同压力下的行为模式（默认模式 / 压力反应 / 谎言防御 / 下意识小动作）
- `abnormal_factor` (0-1)：戏剧制造倾向（0=稳定器，1=炸药桶）
- `lie_pressure_sensitivity` (0-1)：谎言被触发的容易程度（0=厚甲，1=裸露神经）
- `b_story_character`：谁是挑战此角色谎言的镜像人物

### 原语 2：抽象行为 (Abstract Acts)

**来源**：StoryVerse 的 Abstract Acts 机制

**核心思想**：取代逐章详案。全书仅设定 **4-6 个结构门**，每个门定义的是**戏剧形状**（dramatic shape），而非具体场景。

与旧系统的对比：

| 旧系统（弧段规划） | 新系统（抽象行为） |
|-------------------|-------------------|
| 每章都有详细场景描述 | 只定义4-6个戏剧阶段 |
| 「第3章：酒馆，发现信件」 | 「谎言首次被挑战，角色加倍坚持」 |
| 核心事件 = 硬约束 | 出口标记 = 弹性条件 |
| 章节数固定 | 仅估算章节范围（如12-18章） |

每个抽象行为包含：
- **narrative_goal**：戏剧目标（形状描述，非场景）
- **entry_conditions**：进入条件（弧线进度 + 世界状态）
- **placeholders**：占位符（由模拟层填充，非预先指定）
- **exit_markers**：退出标记（需要达成的弧线节拍才能进入下一幕）

**关键**：抽象行为不规定章节内容。一个横跨15章的行为，不指定第5章或第12章发生什么。写手自由填充。

### 原语 3：张力累积器 (Tension Accumulator)

**来源**：RimWorld Cassandra Classic 的威胁池机制

**核心思想**：维护一个 0-10 的全局张力分数，每章后更新。当分数过高或过低时触发干预。

```
每章张力变化量(delta)计算规则：

+1.5  角色谎言被直接挑战
+1.0  核心欲望遭到阻碍
+1.2  揭示重新解读过往事件的真相
+0.8  两个目标冲突的角色在同一场景
+0.6  过去行动的后果到来
+0.3  谎言防御成功（虚假希望）
+2.0  抽象行为的退出标记达成（随后进入冷却）

-0.5  无风险的纯铺垫/旅行章节
-1.0  喜剧缓冲/喘息章节
```

**触发机制**：
- 张力 > **高危阈值**（默认8.5）且不在冷却期 → 触发**重大危机事件**
- 张力 < **漂移阈值**（默认2.0）连续2章 → 触发**复杂化注入**
- 危机后自动进入**冷却期**（默认3章不触发新危机）

**类比**：这就是故事的「心跳」——确保起伏有致，既不会一路高潮（读者疲劳），也不会长期平淡（读者流失）。

### 原语 4：谎言对质追踪器 (Lie-Confrontation Tracker)

**来源**：K.M. Weiland 的角色弧理论 + 自主设计

**核心思想**：防止涌现叙事最常见的失败——角色弧线停滞。追踪每个角色的谎言被挑战的频率。

```
per character:
  chapters_since_pressured: 0  ← 每次谎言被挑战时归零
  pressure_threshold: 5-7     ← 超过此值 Dickens 必须介入
  arc_beats_hit:
    ☐ lie_established         ← 谎言在故事中展示
    ☐ lie_first_challenged    ← 首次被质疑
    ☐ lie_doubled_down        ← 面对挑战加倍坚持
    ☐ lie_cracking            ← 开始动摇
    ☐ lie_shattered_or_embraced ← 弧线终点
```

**关键**：如果一个角色连续5-7章谎言没有被施压，系统会自动在下一章注入一个「谎言压力事件」。这是防止角色弧线在涌现叙事中「遗忘」的安全网。

### 原语 5：事件日志 (Event Log)

**来源**：StoryBox 的自底向上叙事构建模式

**核心思想**：每章产出的不仅仅是文字，还有**结构化事件记录**。事件被标记为：涉及角色、谎言是否被施压、张力变化量、弧线节拍是否达成。

```
event = {
  chapter: 23,
  characters: ["lin-yuanzhou", "wei-qing"],
  description: "林远舟发现魏晴隐瞒了师门真相",
  lie_pressured: "lin-yuanzhou",
  tension_delta: +1.2,
  arc_beat_hit: "lie_first_challenged",
  type: "revelation"
}
```

**用途**：Cratchit 基于事件日志（而非章节全文）追踪叙事状态。这是百章以上连贯性的基础。

### 原语 6：世界状态放大 (World-State Amplification)

**来源**：DiriGent 的信念-张力操控机制

**核心思想**：航向修正时，**不注入预写的剧情事件，而是调整世界状态，让角色的内心张力变得无法忽视**——角色出于自身动机行动，行动本身就是航向修正。

```
修正流程：
1. 识别目标角色 — 谁的 ideal_state 与 actual_state 差距最小（最安逸）
2. 调整世界状态 — 制造外部变化，扩大此差距
3. 角色反应 — 写手基于角色DNA写出角色的反应
4. 航向修正完成 — 角色的行动本身推动了故事方向

示例（好的导演笔记）：
  "林远舟最后一次见到魏晴的边境检查站已被密院封锁——
   林远舟现在只有两天时间，在魏晴的押送队到达京城之前做出选择。"
  → 世界变了，角色必须反应。如何反应取决于角色的DNA。

示例（坏的导演笔记）：
  "林远舟应该在本章直接对质魏晴。"
  → 这是在编排角色动作，违反角色自主性原则。
```

---

## 4. 新增数据结构

### 4.1 角色DNA文档 (Character DNA)

扩展现有 `characters/profiles/{id}.md` + `characters/index.json`，新增以下字段：

```jsonc
{
  "id": "lin-yuanzhou",
  "name": "林远舟",
  "layer": "core",  // core | important | supporting

  // ══════ 弧线引擎 (新增) ══════
  "ghost": "七岁那年在雪地里发现父亲的练功日记被扔进火堆，一句话都没解释",
  "wound": "被最信任的人无声抛弃的恐惧，形成了对一切亲密关系的防御性疏离",
  "lie": "因为父亲不告而别，我相信依靠任何人都意味着他们最终会抛弃你，所以我必须独自悟出所有东西",
  "want": "在修行界独立证明自己的价值，不需要任何人的指导",
  "need": "学会接受来自他人的知识和关怀，才能突破当前的瓶颈",
  "arc_type": "positive",  // positive | negative | flat | corruption

  // ══════ 行为签名 (新增) ══════
  "behavioral_signature": {
    "default_mode": "沉稳内敛，习惯性地先观察后行动，用客观分析掩盖情感反应",
    "stress_response": "表面更加平静，开始用技术细节淹没自己，拒绝一切情感连接",
    "lie_defense": "当有人试图帮助时，会下意识地证明自己已经想到了解法，或找理由拒绝",
    "tell": "压力下右手无意识地摩挲左腕——父亲留下的唯一印记所在"
  },

  // ══════ B故事锚点 (新增) ══════
  "b_story_character": "chen-shiyu",
  "b_story_function": "陈师雨的无条件信任不断冲击林远舟'依靠他人=被抛弃'的谎言",

  // ══════ 张力参数 (新增) ══════
  "abnormal_factor": 0.3,           // 低=稳定器型角色
  "lie_pressure_sensitivity": 0.7,  // 较高=谎言容易被触发

  // ══════ 动态状态 (Cratchit每章更新) ══════
  "arc_progress": 0.15,              // 0=完全处于谎言中, 1.0=弧线完成
  "lie_confrontation_count": 2,      // 谎言被直接挑战的次数
  "last_lie_pressure_chapter": 8,    // 上一次谎言受压的章节号

  // ══════ 保留字段（现有系统） ══════
  "biography": "...",
  "psychological_profile": "...",
  "dialogue_voice": "...",
  "relationships": { ... }
}
```

> **设计要点**：`ghost/wound/lie/want/need` 构成弧线引擎的核心。Weller 收到这些字段后，角色的行为会从 DNA 中自然涌现——不需要被告知「做什么」。

---

### 4.2 抽象行为 (Abstract Acts)

存储位置：`metadata/abstract-acts.json`

```jsonc
{
  "abstract_acts": [
    {
      "act_id": "act-01",
      "act_name": "谎言扎根",

      // 戏剧目标：描述形状，而非场景
      "narrative_goal": "主角带着Ghost形成的Lie进入故事世界。世界起初奖励谎言——它似乎是有效的。到本幕结束时，第一笔代价已被支付，但主角把它归咎于别处。",

      // 主题论证
      "thematic_argument": "才华不以真诚为根基，就是在积累债务，而非接受馈赠",

      // ══════ 进入条件 ══════
      "entry_conditions": {
        "arc_progress_min": 0.0,
        "required_events": [],
        "tension_state": "low"
      },

      // ══════ 占位符（由模拟层填充） ══════
      "placeholders": {
        "catalyst_character": "emergent",
        "setting_type": "主角的Want可以被立即检验的环境",
        "complication_type": "虚假成功——Want达成但伴随主角尚未察觉的隐性代价"
      },

      // ══════ 退出标记 ══════
      "exit_markers": {
        "required_arc_beats": ["lie_established", "lie_first_challenged"],
        "tension_direction": "must_peak",
        "protagonist_state_change": "主角在被挑战后至少一次加倍坚持了谎言"
      },

      // ══════ 状态追踪 ══════
      "status": "active",          // pending | active | complete
      "entered_chapter": 1,
      "completed_chapter": null,
      "estimated_chapters": "12-18"  // 仅为参考，非硬约束
    }
    // ... 后续 act-02 到 act-05
  ]
}
```

---

### 4.3 张力累积器 (Tension Accumulator)

存储位置：`metadata/tension-accumulator.json`

```jsonc
{
  "tension_accumulator": {
    // ══════ 全局张力分数 ══════
    "current_score": 4.2,        // 范围 0.0 ~ 10.0
    "peak_this_arc": 6.8,
    "last_updated_chapter": 15,

    // ══════ 阈值（Phase 3 由 Wemmick 根据类型设定） ══════
    "thresholds": {
      "high_crisis": 8.5,       // 超过 → 触发重大危机
      "low_drift": 2.0,         // 低于 → 触发复杂化注入
      "cooldown_chapters": 3    // 危机后冷却章数
    },

    // ══════ 冷却状态 ══════
    "in_cooldown": false,
    "cooldown_remaining": 0,

    // ══════ 逐章记录 ══════
    "chapter_log": [
      {
        "chapter": 15,
        "delta": +1.2,
        "reason": "林远舟发现魏晴隐瞒师门真相——谎言首次被挑战",
        "score_after": 4.2
      }
    ],

    // ══════ 待执行事件（Dickens 入队，Weller 消费） ══════
    "pending_events": [
      {
        "event_type": "complication",  // complication | crisis | relief | revelation
        "target_character": "lin-yuanzhou",
        "direction": "制造无法独自解决的困境，迫使依赖他人",
        "urgency": "next_2_chapters",  // immediate | next_2_chapters | next_arc
        "injected_chapter": null
      }
    ],

    // ══════ 戏剧曲线追踪 ══════
    "arc_curve": {
      "chapters_since_last_peak": 3,
      "chapters_since_last_valley": 7,
      "current_phase": "rising"  // rising | peak | falling | valley
    }
  }
}
```

**类型推荐阈值**：

| 类型 | high_crisis | low_drift | cooldown |
|------|-------------|-----------|----------|
| 文学小说 | 9.0 | 1.5 | 4 |
| 悬疑/惊悚 | 7.5 | 3.0 | 2 |
| 言情 | 8.0 | 2.5 | 3 |
| 玄幻/网文 | 7.0 | 3.5 | 1 |
| 角色剧情 | 8.5 | 1.5 | 5 |

---

### 4.4 谎言对质追踪器 (Lie-Confrontation Tracker)

存储位置：`metadata/lie-confrontation-tracker.json`

```jsonc
{
  "lie_confrontation_tracker": {
    "characters": [
      {
        "character_id": "lin-yuanzhou",
        "lie_summary": "依靠任何人都意味着被抛弃",
        "chapters_since_pressured": 3,  // 归零当谎言被挑战
        "pressure_threshold": 5,        // 超过此值 → Dickens 必须介入
        "pressure_events_fired": 1,
        "arc_beats_hit": {
          "lie_established": true,
          "lie_first_challenged": true,
          "lie_doubled_down": false,
          "lie_cracking": false,
          "lie_shattered_or_embraced": false
        },
        "last_pressure_chapter": 12,
        "notes": "弧线进展健康，下一个节拍应该是 doubled_down"
      }
    ],

    // ══════ 全局规则 ══════
    "max_chapters_without_arc_pressure": 7,   // 绝对上限
    "minimum_arc_beats_per_act": 1            // 每幕至少达成1个弧线节拍
  }
}
```

**pressure_threshold 计算公式**：

```
base = 5
adjustment = round((1.0 - lie_pressure_sensitivity) × 3)
final = base + adjustment

示例：
  sensitivity = 0.9 → threshold = 5  (裸露神经，频繁被施压)
  sensitivity = 0.5 → threshold = 7  (中等防御)
  sensitivity = 0.1 → threshold = 8  (重甲，不易被触动)
```

---

### 4.5 结构锚点 (Structural Anchors)

存储位置：通过 `dickens_consistency (add_thread)` 存储，`id` 前缀为 `anchor-`

```jsonc
{
  "id": "anchor-03",
  "name": "师门真相",
  "description": "主角发现导师一直在隐瞒的关于其家族的真相——这直接动摇了主角谎言的根基",
  "must_occur_in_act": "act-02",
  "characters_involved": ["lin-yuanzhou", "master-gu"],
  "lie_impact": "直接冲击'我必须独自悟出所有东西'的谎言——因为最关键的知识一直被主动藏匿",
  "cannot_occur_before_chapter": 15,
  "status": "pending"  // pending | fired | skipped
}
```

**全书设定 5-8 个结构锚点**，分布在各抽象行为中。这些是故事的「骨骼」——必须发生，但具体如何发生由写手决定。

---

### 4.6 新增文件汇总

| 文件路径 | 类型 | 创建时机 | 维护者 |
|----------|------|----------|--------|
| `metadata/abstract-acts.json` | 新增 | Phase 3 | Wemmick 创建，Cratchit 更新状态 |
| `metadata/tension-accumulator.json` | 新增 | Phase 3 | Wemmick 初始化阈值，Cratchit 每章更新 |
| `metadata/lie-confrontation-tracker.json` | 新增 | Phase 3 | Wemmick 初始化，Cratchit 每章更新 |
| `metadata/character-dna-summary.md` | 新增 | Phase 2B | Wemmick 创建 |
| 角色DNA字段 | 扩展 | Phase 2B | Wemmick 创建，Cratchit 更新动态状态 |

---

## 5. 六阶段工作流重设计

以下逐阶段说明变更。**仅列出有变化的部分**，未提及的子阶段保持不变。

### 5.1 Phase 1：灵感碰撞 (Micawber) — 微调

**变更**：Micawber 产出的「创意简报」新增一个字段：

```
主题论证 (Thematic Argument)：
  "这个故事论证的是 [X]。"
  主角的谎言将是这个论证的反面。
```

此字段直接注入 Phase 3 的抽象行为设计。其余脑暴流程不变。

---

### 5.2 Phase 2B：角色设计 (Wemmick) — 新增 Step 8

现有的 Step 1-7（传记→心理画像→对话声音→关系网→非功能性特征→冲突引擎→整体审查）保持不变。

**新增 Step 8：角色DNA结晶**

在全部现有步骤完成后，Wemmick 为每个 Core 和 Important 角色执行：

```
Step 8: 角色DNA结晶

1. GHOST 提取
   从传记（Step 1）中识别定义性的过往记忆。
   问：「这个人过去发生的什么事，至今仍在支配他的决定？」
   写成一个具体的场景片段，而非抽象概括。

2. LIE 公式化
   从心理画像（Step 2）+ 核心恐惧中提炼错误信念。必须满足：
   - 是为了生存而形成的信念（不仅仅是性格缺陷）
   - 与 Need 冲突
   - 可证伪（故事事件可以证明它是错的）
   格式："因为[Ghost发生了]，我相信[Lie]，所以我[行为后果]"

3. WANT vs NEED 映射
   - Want：角色意识层面追求的目标（「你想要什么？」的回答）
   - Need：角色真正需要的（往往与 Want 矛盾或对立）
   - 故事在 Want 与 Need 的交叉点制造压力

4. 弧线类型选择
   - positive（正向）：Lie → 被挑战 → 被粉碎 → 接受Truth（成长）
   - negative（负向）：Lie → 被挑战 → 加倍坚持 → 悲剧（堕落）
   - flat（平坦）：Lie → 被挑战 → 主角抵抗变化，但周围世界改变了
   - corruption（腐化）：从Truth出发 → 诱惑 → 采纳Lie → 承受后果

5. B故事角色指定
   谁是挑战此角色谎言的镜像人物？
   （不一定是恋爱对象——可以是导师、对手、孩子、反派）

6. 张力参数设定
   - abnormal_factor：戏剧制造倾向（0=稳定器，1=炸药桶）
   - lie_pressure_sensitivity：谎言被触发的容易程度（0=厚甲，1=裸露神经）
```

**Wemmick 同时产出**：角色DNA速查表（保存到 `metadata/character-dna-summary.md`）

```markdown
| 角色 | Ghost (一句话) | Lie | Want | Need | 弧线类型 | 异常因子 |
|------|---------------|-----|------|------|---------|---------|
| 林远舟 | 父亲不告而别 | 依靠他人=被抛弃 | 独立证道 | 接受帮助 | positive | 0.3 |
| 魏晴   | 师门覆灭时的无力 | 力量是唯一的安全 | 掌控绝对力量 | 接受脆弱 | negative | 0.7 |
```

---

### 5.3 Phase 3：结构设计 (Wemmick) — 重大变更

**旧流程**：弧段规划 → 每章详细的场景/核心事件/情感走向/伏笔/钩子

**新流程**：抽象行为设计 + 结构锚点 + 张力校准 + 追踪器初始化

#### 3A：结构选型 — 不变

Wemmick 选择叙事结构（三幕式/英雄旅程/多线交织等）。

#### 3B：抽象行为设计（取代逐章详案）

Wemmick 为全书设计 **4-6 个抽象行为**。每个行为：

1. **命名戏剧形状** — 不是「第1-15章」，而是「谎言扎根」「代价显现」「至暗时刻」
2. **设置进入条件** — 弧线进度 + 世界状态的组合条件
3. **使用占位符** — 角色功能被指定（主角、对手功能、B故事伙伴），但具体事件**不预设**
4. **设置退出标记** — 必须达成哪些弧线节拍才能进入下一幕

**行为不被分割为章节。** Wemmick 估计每幕章节数（如「约12-18章」），但这是参考，不是契约。

#### 3C：结构锚点设计（取代旧的爆点路线图）

Wemmick 设计 **5-8 个结构锚点** — 全书中**必须发生**的高冲击力事件，分布在各行为中：

- 每个锚点描述**必须发生什么**（情感/剧情节拍），而非**如何发生**
- 每个锚点标注其对至少一个角色谎言的冲击方式
- 锚点是故事的「骨骼」——写手决定「肌肉和皮肤」

#### 3D：张力累积器校准（新增）

Wemmick 根据小说类型和调性设定三个阈值：
- `high_crisis`：张力达到多少触发重大危机（7.0-9.5）
- `low_drift`：张力低于多少注入复杂化（1.0-3.5）
- `cooldown_chapters`：危机后多少章不触发新危机（1-5）

#### 3E：谎言对质追踪器初始化（新增）

Wemmick 根据每个角色的 `lie_pressure_sensitivity` 计算 `pressure_threshold`，初始化追踪器。

#### 3F：伏笔链与情节线 — 保留

伏笔链、情节线索、秘密系统等**保持不变**——它们是补充性结构，与新系统兼容。

---

### 5.4 Phase 4：章节创作 — 根本性变更

**旧流程**：
```
Dickens 从弧段规划中提取本章详案
  → 传递给 Weller：场景、核心事件、情感走向、伏笔、钩子
  → Weller 按详案执行
```

**新流程**：
```
Dickens 构建角色主导的上下文包
  → 传递给 Weller：角色DNA + 近期状态 + 结构约束 + 导演笔记(如有)
  → Weller 从角色内心出发自由写作
```

#### 新的章节上下文包格式

```
第 [N] 章 写作上下文

━━━ 本章出场角色 ━━━
[角色名] — DNA:
  Ghost: [一句话]
  Lie: [一句话]
  当前Want: [本章级别的即时欲望，Cratchit 从上章更新]
  Need (角色不自知): [一句话]
  压力下行为: [一句话]
  弧线进度: [float]
  上次谎言受压: 第[N]章

[对每个出场角色重复]

━━━ 角色携带进入本章的状态 ━━━
[最近2-3章摘要]
[与这些角色相关的活跃情节线]
[张力累积器中的待执行事件（如有）]

━━━ 结构约束 ━━━
当前抽象行为: [行为名 + 叙事目标]
行为退出条件: [需要什么条件才能结束本幕]
[如果本幕有结构锚点即将到期: 锚点描述]

━━━ 导演笔记（仅当 Level 2 激活时出现） ━━━
"以下世界状况已发生变化/事件已发生——
 请写出角色对此的反应:
 [世界事件描述]"

━━━ 硬约束 ━━━
[如果某结构锚点必须在本章触发: 需要达成的节拍]
[Cratchit 的一致性约束]
[POV 与文风指南]
```

**关键规则**：如果张力累积器**未触发**且谎言对质追踪器**未告警**，「导演笔记」部分**不出现**。Weller 从纯角色上下文出发自由写作，无剧情指令。

#### 新的 Dickens 写前检查（取代旧的章节详案完整性检查）

| 检查项 | 问题 | 不通过时的动作 |
|--------|------|---------------|
| DNA 完整 | 本章所有角色都有 Ghost/Lie/Want/Need？ | 请求 Wemmick 补充 DNA 结晶 |
| 张力状态已知 | 当前张力分数是最新的？ | 请求 Cratchit 从上章更新 |
| 谎言压力状态 | 有角色超期未受压？ | 在导演笔记中添加压力事件 |
| 结构锚点检查 | 有锚点应在本章窗口内触发？ | 添加到硬约束 |
| 行为转换检查 | 当前行为的退出标记已全部达成？ | 信号行为转换给 Wemmick |

---

### 5.5 Phase 5：三轮审校 (Jaggers) — 微调

三轮审校框架不变。仅在**第二轮逻辑一致性检查**中：

**移除**：
- ~~"本章执行了弧段计划核心事件"~~

**替换为**：
- "角色行为与其DNA（Ghost/Lie/Want）一致"
- "角色决策可追溯到其谎言驱动的动机"

**新增两个第三轮子指标**：

| 子指标 | 3分（差） | 6分（中） | 9分（优） |
|--------|----------|----------|----------|
| 谎言真实性 | 角色似乎知道自己错了，或谎言完全不可见 | 谎言影响了部分选择但不一致 | 每个重大决定都可追溯到谎言；角色从未突破进入不该有的自我认知 |
| 角色驱动因果 | 事件发生在角色身上；角色的选择不产生后果 | 有一些因果链 | 本章事件可追溯到角色1-3章前做出的谎言驱动的选择 |

---

### 5.6 Phase 6：记录归档 (Cratchit) — 扩展

现有的章节摘要、12维一致性追踪、涌现实体归档**全部保留**。新增两项任务：

#### 新任务 A：张力累积器更新

```
1. 读取 tension-accumulator.json
2. 分析本章的张力变化量（使用 delta 规则表）
3. 求和 → 更新 current_score
4. 更新冷却状态
5. 如果 current_score > high_crisis 且不在冷却期:
   → 标记给 Dickens："张力已达危机阈值，建议触发重大危机事件"
6. 如果 current_score < low_drift 连续2章以上:
   → 标记给 Dickens："张力过低已持续X章，建议注入复杂化"
7. 保存更新后的 tension-accumulator.json
```

#### 新任务 B：谎言对质追踪器更新

```
1. 读取 lie-confrontation-tracker.json
2. 对每个被追踪角色:
   a. 本章谎言被挑战了？→ chapters_since_pressured 归零，更新 arc_beats_hit
   b. 没有？→ chapters_since_pressured + 1
   c. 如果 chapters_since_pressured >= pressure_threshold:
      → 标记给 Dickens："[角色]的谎言已 [N] 章未受压，建议触发压力事件"
3. 保存更新后的 lie-confrontation-tracker.json
```

#### 新增：叙事健康报告

Cratchit 在每章归档末尾附加：

```
【叙事健康】
张力分数: X.X / 10.0 (本章 ↑/↓ Y.Y) | 阶段: 上升/下降/峰值/谷底
谎言压力:
  林远舟: 3章未受压 ✅
  魏晴:   6章未受压 ⚠️ (超阈值)
当前行为: Act-02「代价显现」| 剩余退出标记: 2
结构锚点: 3个待触发, 2个已触发
```

---

## 6. 导演决策树（Dickens Level 2 行为）

Dickens 本身充当 Level 2 导演。不需要新 Agent——Dickens 读取 Cratchit 的叙事健康报告并决定是否介入。

### 决策树（每章 Phase 6 归档后执行）

```
收到 Cratchit 的叙事健康报告后:

IF tension_score > high_crisis AND NOT in_cooldown:
  → 【危机事件】
    构建一个世界事件，最大限度地扩大某角色 ideal_state 与 actual_state 的差距
    添加到 tension_accumulator.pending_events，urgency = "immediate"
    在下一章的导演笔记中传递给 Weller

ELSE IF tension_score < low_drift AND chapters_since_valley > 2:
  → 【复杂化注入】
    识别 abnormal_factor 最高的角色
    构建一个激活其行为签名的世界事件
    添加到 pending_events，urgency = "next_2_chapters"

ELSE IF any character.chapters_since_pressured >= pressure_threshold:
  → 【谎言压力事件】
    找到最具叙事张力的方式迫使该角色面对谎言
    作为导演笔记注入下一章

ELSE IF 当前行为的退出标记应该已触发（基于估计章节数）:
  → 【行为压力】
    添加柔性引导："本幕需要收束——以下弧线节拍需在接下来3章内触发: [退出标记]"

ELSE:
  → 【不干预】
    发送纯角色上下文给 Weller。故事自由生长。
```

### 世界事件构建规则

当 Dickens 需要构建导演笔记中的世界事件时：

| 规则 | 说明 |
|------|------|
| **识别目标角色** | 选择 ideal_state 与 actual_state 差距最小（最安逸）的角色 |
| **使用世界状态，非角色动作** | "边境检查站被封锁了" ✅ / "角色X应该做Y" ❌ |
| **连接已有线索** | 事件必须可追溯到已建立的要素（势力、秘密、承诺） |
| **谎言相关** | 事件应让角色无法继续回避谎言 |

**好的导演笔记**：
> "林远舟最后一次见到魏晴的边境检查站已被密院封锁——林远舟现在只有两天时间，在魏晴的押送队到达京城之前做出选择。"
> → 世界变了。如何反应取决于角色DNA。

**坏的导演笔记**：
> "林远舟应该在本章直接对质魏晴。"
> → 这是在编排角色动作，违反角色自主性原则。

### 干预频率预期

| 干预类型 | 预期频率 | 说明 |
|----------|---------|------|
| 不干预 | ~70-80% 章节 | 故事自由生长 |
| 谎言压力事件 | ~10-15% 章节 | 防止弧线停滞 |
| 复杂化注入 | ~5-10% 章节 | 防止张力漂移 |
| 危机事件 | ~3-5% 章节 | 重大戏剧转折 |
| 行为压力 | 极少 | 仅当某幕明显拖延时 |

---

## 7. 各 Agent 变更明细

### 7.1 Micawber（创意脑暴）— 微调

| 变更 | 说明 |
|------|------|
| 新增「主题论证」字段 | 创意简报末尾增加一句话：「这个故事论证的是 [X]」 |

其余脑暴流程不变。

---

### 7.2 Wemmick（世界/角色/结构设计）— 重大变更

| 变更 | 阶段 | 说明 |
|------|------|------|
| **新增 Step 8** | Phase 2B | 角色DNA结晶（Ghost/Wound/Lie/Want/Need + 行为签名 + 张力参数） |
| **产出 DNA 速查表** | Phase 2B | `metadata/character-dna-summary.md` |
| **取代逐章详案** | Phase 3B | 设计4-6个抽象行为（Abstract Acts） |
| **新增结构锚点** | Phase 3C | 5-8个全书级必发事件 |
| **新增张力校准** | Phase 3D | 根据类型设定 Tension Accumulator 阈值 |
| **新增追踪器初始化** | Phase 3E | 初始化 Lie-Confrontation Tracker |
| **移除** | Phase 3 | 每章的场景概要、核心事件、情感走向、章末钩子（这些现在是涌现的） |

**保留不变**：弧段级主题、势力状态、关系张力、伏笔链设计。

---

### 7.3 Dickens（总指挥）— 中等变更

| 变更 | 阶段 | 说明 |
|------|------|------|
| **新的写前检查** | Phase 4 | DNA完整性 / 张力状态 / 谎言压力 / 锚点检查（取代6字段详案完整性检查） |
| **新的上下文组装** | Phase 4 | 角色主导上下文包（取代剧情节拍包） |
| **导演决策树** | Phase 6后 | 每章归档后运行 Level 2 判断是否需要干预 |
| **「绝不预思」扩展** | 全局 | 禁令从「不产生创意内容」扩展到「不产生剧情节拍 AND 不产生角色动机」 |

---

### 7.4 Weller / Baoyu（写作匠人）— 中等变更

**新增写作协议**：

```
角色主导写作协议 (CHARACTER-LED WRITING PROTOCOL)

你收到的是每个出场角色的 Character DNA。
从角色谎言的内部视角写作：
  - 角色不知道自己的谎言存在
  - 他们追求自己的 Want，如同那是正确的
  - 展示的是 behavioral_signature，而非 arc_type
  - 谎言塑造了角色注意到什么、忽略什么、如何解读事件

如果存在导演笔记：
  - 世界中发生了一个事件——写角色对此的反应
  - 你决定角色如何反应（基于其行为签名和谎言）
  - 导演指定了世界中发生了什么，而非角色做什么

弧线节拍可以自然涌现：
  - 你不需要按时间表达成弧线节拍
  - 如果场景自然地到达了谎言对质时刻，充分写出来
  - 报告你认为触发了哪些弧线节拍（Cratchit 将验证）
```

**移除**：
- ~~"核心事件必须完成"~~
- ~~"伏笔触发必须执行"~~

**替换为**：
- "角色决策必须基于其DNA真实可信"
- "弧线节拍的涌现优先于预设计划"

---

### 7.5 Jaggers（质量守门人）— 微调

| 变更 | 说明 |
|------|------|
| 第二轮移除 | ~~"本章执行了弧段计划核心事件"~~ |
| 第二轮新增 | "角色行为与其DNA一致" + "角色决策可追溯到谎言动机" |
| 第三轮新增2个子指标 | 「谎言真实性」「角色驱动因果」 |

---

### 7.6 Cratchit（编年史官）— 中等变更

| 变更 | 说明 |
|------|------|
| **新任务 A** | 张力累积器更新（每章，含 delta 计算和阈值检查） |
| **新任务 B** | 谎言对质追踪器更新（每章，含超阈值告警） |
| **新产出** | 叙事健康报告（每章归档末尾） |
| **新增状态文件维护** | `tension-accumulator.json` + `lie-confrontation-tracker.json` |
| **动态状态更新** | 角色DNA中的 `arc_progress`, `lie_confrontation_count`, `last_lie_pressure_chapter` |

现有的章节摘要、12维一致性追踪、涌现实体归档**全部保留不变**。

---

### 7.7 Buzfuz / Tulkinghorn（读者/评论家）— 不变

读者体验评分和文学评论流程与叙事驱动方式无关，无需调整。

---

## 8. 新旧对比

### 8.1 Phase 3 产出对比

**旧系统（弧段规划）**：

```markdown
## 弧段一：第1-15章

### 第1章：开局
- 场景概要：场景1：学院新生入学（学院广场）场景2：与导师初次相遇（教授办公室）
- 核心事件：主角展示异常天赋，引起导师注意。导师提出特殊培养计划。
- 情感走向：好奇→兴奋→警惕（感受到异常关注）
- 伏笔触发：铺设-天赋秘密（伏笔线F1）
- 章末钩子：导师的书架上发现一本主角家族的记载...

### 第2章：...
（每章重复以上6字段结构）
```

**新系统（抽象行为）**：

```json
{
  "act_id": "act-01",
  "act_name": "谎言扎根",
  "narrative_goal": "主角带着Ghost形成的Lie进入故事世界。世界起初奖励谎言——它似乎是有效的。到本幕结束时，第一笔代价已被支付，但主角把它归咎于别处。",
  "thematic_argument": "才华不以真诚为根基，就是在积累债务，而非接受馈赠",
  "entry_conditions": { "arc_progress_min": 0.0, "required_events": [], "tension_state": "low" },
  "placeholders": {
    "catalyst_character": "emergent",
    "setting_type": "主角的Want可以被立即检验的环境",
    "complication_type": "虚假成功——Want达成但伴随隐性代价"
  },
  "exit_markers": {
    "required_arc_beats": ["lie_established", "lie_first_challenged"],
    "tension_direction": "must_peak",
    "protagonist_state_change": "主角在被挑战后至少一次加倍坚持了谎言"
  },
  "estimated_chapters": "12-18"
}
```

**差异**：旧系统为15章中的每一章预设了具体场景和事件。新系统只定义了12-18章范围内的**戏剧形状和退出条件**，具体发生什么由写手从角色DNA出发涌现。

---

### 8.2 写手接收的上下文对比

**旧系统（Weller 收到的）**：

```
本章核心事件：
  场景1：学院广场，主角展示异常天赋，引起导师注意。
  场景2：导师办公室，导师提出特殊培养计划。
  主角感受到好奇→兴奋→警惕。
伏笔：铺设天赋秘密（伏笔线F1）。
章末钩子：导师书架上发现家族记载。
```
→ 写手知道**做什么**，但不知道**为什么**。

**新系统（Weller 收到的）**：

```
━━━ 本章出场角色 ━━━
林远舟 — DNA:
  Ghost: 七岁那年在雪地里发现父亲的练功日记被扔进火堆
  Lie: "依靠任何人都意味着他们最终会抛弃你"
  当前Want: 在新学院里尽快证明自己不需要任何人的指导
  Need (他不知道): 学会接受来自他人的知识和关怀
  压力下行为: 表面平静，用技术细节淹没自己，拒绝情感连接
  弧线进度: 0.05

━━━ 结构约束 ━━━
当前抽象行为: Act-01「谎言扎根」
叙事目标: 世界起初奖励谎言，到本幕结束时第一笔代价被支付...
退出条件: lie_established + lie_first_challenged

━━━ 硬约束 ━━━
[一致性约束]
[文风指南]
```
→ 写手知道**角色是谁**以及**为什么这样行动**。具体场景、对话、情节节拍从角色行为中自然涌现。

---

### 8.3 航向修正对比

**旧系统**：不需要航向修正——因为每章都有详细计划，写手照做就行。

**新系统**：

```
场景：连续4章张力持续下降（Cratchit 报告 tension = 1.8 < low_drift 2.0）

旧系统反应：N/A（按照预设章节详案继续写）

新系统反应：
  1. Cratchit 在叙事健康报告中标记"张力过低"
  2. Dickens 导演决策树命中 "low_drift" 分支
  3. Dickens 识别 abnormal_factor 最高的角色（魏晴 = 0.7）
  4. Dickens 构建世界事件："密院第三势力公开了一份魏晴师门覆灭的新证据"
  5. 作为导演笔记注入下一章
  6. Weller 基于魏晴的DNA写出反应——她的 stress_response 被激活
  7. 张力自然上升
```

---

## 9. 实施优先级

变更可分三层实施，每层交付后即可投入使用。

### Tier 1：高影响、纯提示词修改（无需新工具/新文件）

| 序号 | 变更 | 文件 | 工作量 |
|------|------|------|--------|
| 1 | Wemmick Phase 2B 新增 Step 8 角色DNA结晶 | `wemmick.md` | 中 |
| 2 | Wemmick 设计模板新增 DNA 结晶指导 | `wemmick-design-templates.md` | 中 |
| 3 | Dickens Phase 4 新的角色主导上下文包格式 | `dickens.md` | 中 |
| 4 | Weller 新增角色主导写作协议 | `weller.md` | 小 |
| 5 | Baoyu 新增角色主导写作协议 | `baoyu.md` | 小 |
| 6 | Jaggers 新增2个子指标 + 移除核心事件检查 | `jaggers.md` | 小 |

**Tier 1 交付后**：写手已经可以从角色DNA出发写作，审校已经检查角色驱动性。但张力和弧线追踪尚需手动。

---

### Tier 2：结构层（新状态文件 + Cratchit 扩展）

| 序号 | 变更 | 文件 | 工作量 |
|------|------|------|--------|
| 7 | Wemmick Phase 3 取代详案为抽象行为 | `wemmick.md` | 大 |
| 8 | 新增抽象行为模板 | `wemmick-design-templates.md` | 中 |
| 9 | 新增结构锚点模板 | `wemmick-design-templates.md` | 小 |
| 10 | 创建 `tension-accumulator.json` 初始化 | `novel-init.ts` | 小 |
| 11 | 创建 `lie-confrontation-tracker.json` 初始化 | `novel-init.ts` | 小 |
| 12 | 创建 `abstract-acts.json` 初始化 | `novel-init.ts` | 小 |
| 13 | Cratchit 新增张力更新 + 谎言追踪 + 健康报告 | `cratchit.md` | 中 |
| 14 | Cratchit 格式模板新增相关 JSON 格式 | `cratchit-formats.md` | 中 |

**Tier 2 交付后**：完整的张力追踪和弧线监控系统上线。Cratchit 每章产出叙事健康报告。

---

### Tier 3：完整导演循环（Dickens 编排变更）

| 序号 | 变更 | 文件 | 工作量 |
|------|------|------|--------|
| 15 | Dickens Phase 6 后导演决策树 | `dickens.md` | 大 |
| 16 | Phase 3D 张力校准指导 | `dickens.md` + `wemmick.md` | 小 |
| 17 | Phase 3E 追踪器初始化指导 | `dickens.md` + `wemmick.md` | 小 |
| 18 | 写前检查从6字段改为 DNA/张力/谎言检查 | `dickens.md` | 中 |
| 19 | `context-builder.ts` 适配新上下文格式 | `context-builder.ts` | 大 |
| 20 | `diagnose-outline.md` 适配新检查项 | `diagnose-outline.md` | 小 |
| 21 | `write-next.md` 命令流程适配 | `write-next.md` | 小 |

**Tier 3 交付后**：完整的角色驱动涌现叙事系统上线。Dickens 自动监控叙事健康、按需触发航向修正。

---

### 总工作量估计

| Tier | 文件数 | 工作量 | 描述 |
|------|--------|--------|------|
| Tier 1 | 6 个 .md | 中 | 纯提示词编辑，立即可用 |
| Tier 2 | 5 个 .md + 3 个 .ts | 中-大 | 新增状态文件和归档流程 |
| Tier 3 | 4 个 .md + 2 个 .ts | 大 | 完整导演循环和代码适配 |

---

## 10. 不变的部分

明确列出不受本次重设计影响的部分，控制变更范围。

| 组件 | 状态 | 原因 |
|------|------|------|
| Phase 1 (Micawber 脑暴) | **基本不变** | 仅新增「主题论证」一个字段 |
| Phase 2A (世界观设计) | **不变** | 世界设定与叙事驱动方式无关 |
| Phase 2C (关系网络设计) | **不变** | 关系系统已经是角色驱动的 |
| Phase 2D (风格校准) | **不变** | 文风系统独立于叙事结构 |
| Phase 2E (Jaggers 设计审查门) | **不变** | 审查门的存在意义不变 |
| Phase 5.5 (读者评审团) | **不变** | Buzfuz/Tulkinghorn 的评分维度与叙事驱动方式无关 |
| Anti-AI 去味系统 | **不变** | 独立的质量层 |
| 分层摘要系统 | **不变** | Level 0-3 摘要架构不变 |
| 会话恢复 (`/resume`) | **不变** | 检查点机制与叙事方式无关 |
| 错误恢复协议 | **不变** | 三级恢复架构不变 |
| 实体管理系统 | **不变** | 15类实体的CRUD保持不变，涌现归档机制保留 |
| 位置系统 (`locations.json`) | **不变** | 新增的位置CRUD + 树形结构保留 |
| 伏笔链系统 | **不变** | 伏笔的铺设/推进/引爆机制与新系统兼容 |
| 时间线追踪 | **不变** | 时间一致性验证保留 |
| 导出功能 | **不变** | TXT/Markdown 导出不受影响 |
| `dickens_context` 工具 | **需适配** | 但在 Tier 3 中处理 |

---

## 附录 A：参考文献

| 论文/来源 | 链接 |
|-----------|------|
| StoryVerse (Autodesk, 2024) | https://arxiv.org/abs/2405.13042 |
| StoryBox (2024) | https://arxiv.org/html/2510.11618v1 |
| DiriGent (ETH Zurich, AAAI 2025) | https://ojs.aaai.org/index.php/AIIDE/article/view/36841 |
| Generative Agents (Stanford, 2023) | arXiv:2304.03442 |
| SCORE (2025) | https://arxiv.org/html/2503.23512v1 |
| K.M. Weiland Ghost/Wound/Lie | https://www.helpingwritersbecomeauthors.com/character-arcs-4/ |
| K.M. Weiland Want vs Need | https://www.helpingwritersbecomeauthors.com/whats-the-difference-your-characters-ghost-vs-wound-vs-lie-vs-weakness/ |
| Donald Maass 非剧情小说框架 | https://www.edelmanedits.com/post/how-to-write-a-character-driven-story |
| Dwarf Fortress 涌现叙事 | DOI:10.1201/9780429488337-15 |

## 附录 B：现有系统剧情约束点审计

以下是对现有系统的完整审计——标注了每个剧情约束点的位置、类型和重设计影响。

| # | 文件 | 约束机制 | 类型 | 重设计影响 |
|---|------|----------|------|-----------|
| 1 | `dickens.md` (Phase 3→4 交接) | Wemmick 产出弧段规划 → Dickens 传递给写手 | **硬** | 交接物从「章节详案」变为「角色DNA + 抽象行为」 |
| 2 | `wemmick.md` (弧段规划模板) | 定义每章结构：场景概要/核心事件/情感走向/伏笔/钩子 | **硬** | 取消逐章详案，改为抽象行为 |
| 3 | `wemmick-design-templates.md` (弧段规划模板) | 6字段章节详案，核心事件是「唯一硬约束」 | **硬** | 移除6字段模板，替换为抽象行为模板 |
| 4 | `context-builder.ts` — `readScenePlan()` | 读取 arc-{NN}.md 提取当前章节计划 | **硬** | 改为读取角色DNA + 抽象行为状态 |
| 5 | `context-builder.ts` — `extractChapterPlan()` | 正则提取章节详案字段，注入为「本章写作计划」(P0优先级) | **硬** | P0优先级改为角色DNA注入 |
| 6 | `context-builder.ts` — `buildWritingContext()` | 组装上下文，章节计划 = P0 必注入 | **硬** | 重构为角色主导上下文组装 |
| 7 | `weller.md` — 硬约束部分 | "核心事件必须完成"、"伏笔触发必须执行" | **硬** | 替换为"角色决策必须基于DNA真实可信" |
| 8 | `weller.md` — 创作涌现部分 | 允许角色/场景/对话涌现，但**不允许剧情涌现** | **软** | 扩展为允许剧情从角色行为中涌现 |
| 9 | `baoyu.md` — 硬约束部分 | 同 Weller | **硬** | 同 Weller |
| 10 | `baoyu.md` — 创作涌现部分 | 同 Weller | **软** | 同 Weller |
| 11 | `jaggers.md` — 第二轮检查 | "本章执行了弧段计划核心事件" | **硬** | 替换为"角色行为与DNA一致" |
| 12 | `jaggers.md` — 退回指令 | 退回时指向"剧情违规" | **硬** | 重定义为"角色动机不清晰" |
| 13 | `write-next.md` — 命令流程 | Step 4: "读取弧段计划和角色档案" | **硬** | 改为"读取角色DNA和抽象行为状态" |
| 14 | `diagnose-outline.md` — 6字段检查 | 验证每章：标题/场景/核心事件/情感/伏笔/钩子 | **硬** | 改为验证抽象行为完整性 |
| 15 | `outline.ts` — StoryArc 接口 | `keyEvents`, `climax`, `resolution` | **硬** | 新增角色弧状态字段 |
| 16 | `chapter.ts` — Chapter 接口 | `scenePlan`, `plotThreads` | **硬** | 新增 `characterStateAtStart`, `characterStateAtEnd` |

**统计**：16个约束点中，13个是硬约束（必须改），3个是软约束（可扩展）。
