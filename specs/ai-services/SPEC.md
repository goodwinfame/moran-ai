# Phase 11 — AI Services Spec

> 4 个缺失服务：ContextService、ReviewService、AnalysisService、ConsistencyService

## 1. 总览

| 服务 | 文件 | 职责 | 新增 DB 表 | MCP 工具 | API 路由 |
|------|------|------|-----------|----------|----------|
| ContextService | context.service.ts | 组装写作上下文（只读复合） | 无 | context_assemble | 无 |
| ReviewService | review.service.ts | 审校结果存储 | 无（用 project_documents） | review_execute | GET /reviews, GET /reviews/:chapterNum |
| AnalysisService | analysis.service.ts | 分析结果存储 | 无（用 project_documents） | analysis_execute, analysis_read | GET /analysis, GET /analysis/trend, GET /analysis/:chapterNum |
| ConsistencyService | consistency.service.ts | 世界观一致性检查（规则式） | 无 | world_check | 无 |

**核心原则**：MCP 工具不调 LLM。Agent 自己做 AI 工作，然后调 MCP 工具存储结果。

---

## 2. ContextService

### 2.1 定位

只读复合服务。从 8 个已有服务聚合数据，组装为执笔的写作上下文。

### 2.2 接口

```typescript
export async function assemble(
  projectId: string,
  chapterNumber: number,
  mode?: "write" | "revise" | "rewrite"
): Promise<ServiceResult<ContextPayload>>
```

### 2.3 ContextPayload 结构

```typescript
interface ContextPayload {
  brief: string;               // 章节 Plantser Brief（从 outline）
  worldContext: string;         // 相关世界设定
  characterStates: string;     // 涉及角色最新状态
  previousSummary: string | null;  // 前文摘要
  styleConfig: string;         // 文风配置
  lessons: string[];           // 相关写作教训
  threads: string[];           // 活跃伏笔
  arcContext: string;          // 当前弧段上下文
  tokenBudget: Record<string, number>;  // 各部分 token 分配
}
```

### 2.4 三种模式

| 模式 | 用途 | 上下文量级 | 特殊处理 |
|------|------|-----------|---------|
| write | 首次创作 | 完整（~54K chars） | 包含所有 8 个部分 |
| revise | 定向修复 | 最小 | 只包含 brief + styleConfig + lessons，跳过 world/character/summary |
| rewrite | 全文重写 | 中等 | 包含 6 部分，排除旧章节正文防止锚定 |

### 2.5 数据来源

| 上下文部分 | 来源服务 | 调用方法 |
|-----------|---------|---------|
| brief | outlineService | readOutline → 找对应章节的 chapterBrief |
| worldContext | worldService | listSettings → 筛选相关设定 |
| characterStates | characterService | listStates → 按章节过滤 |
| previousSummary | summaryService | listChapterSummaries → 前 N 章 |
| styleConfig | styleService | list → 项目文风 |
| lessons | lessonService | list → 活跃教训 |
| threads | threadService | list → 活跃伏笔 |
| arcContext | outlineService | readOutline → 当前弧段信息 |

### 2.6 Token 预算分配（write 模式）

```
brief: 4000
previousSummary: 8000
worldContext: 6000
characterStates: 8000
threads: 4000
styleConfig: 3000
lessons: 2000
arcContext: 4000
reserved: 15000  // LLM 生成保留
```

总预算 ~54000 chars。revise 模式约 9000 chars，rewrite 模式约 35000 chars。

### 2.7 门禁（由 MCP 工具层检查）

- HARD: 大纲已存在
- HARD: 该章节的 Brief 已定义
- HARD: 文风配置已确定

### 2.8 验收标准

- [ ] AC-CTX-1: write 模式返回完整 8 个字段，非空
- [ ] AC-CTX-2: revise 模式只返回 brief + styleConfig + lessons，其余为空/null
- [ ] AC-CTX-3: rewrite 模式返回 6 个字段，不包含旧章节正文
- [ ] AC-CTX-4: 第一章 previousSummary 为 null
- [ ] AC-CTX-5: 不存在的项目/大纲/章节返回适当错误
- [ ] AC-CTX-6: tokenBudget 按模式有不同分配
- [ ] AC-CTX-7: 任一子服务查询失败时，该字段返回空值而非整体失败（容错）

---

## 3. ReviewService

### 3.1 定位

审校结果 CRUD 服务。明镜 agent 完成四轮审校后，调用 MCP 工具存储每轮结果。

### 3.2 存储

使用已有 `project_documents` 表：
- `category` = `"review"`
- `title` = `"Review Ch.{N} Round {R}"` 格式
- `content` = JSON 字符串（审校结果）
- `metadata` = `{ chapterNumber, round, passed, score?, metrics? }`

### 3.3 接口

```typescript
// 保存审校轮次结果
export async function saveRound(
  projectId: string,
  chapterNumber: number,
  round: 1 | 2 | 3 | 4,
  result: ReviewRoundResult
): Promise<ServiceResult<{ id: string }>>

// 读取特定章节特定轮次
export async function readRound(
  projectId: string,
  chapterNumber: number,
  round: 1 | 2 | 3 | 4,
): Promise<ServiceResult<ReviewDocument>>

// 读取特定章节全部审校结果
export async function readByChapter(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<ReviewDocument[]>>

// 列出项目所有审校报告（摘要模式，不含 issues 详情）
export async function list(
  projectId: string,
): Promise<ServiceResult<ReviewSummary[]>>

// 检查章节是否全部四轮通过
export async function isChapterPassed(
  projectId: string,
  chapterNumber: number,
): Promise<ServiceResult<{ passed: boolean; completedRounds: number }>>
```

### 3.4 ReviewRoundResult 结构

```typescript
interface ReviewRoundResult {
  passed: boolean;
  score?: number;              // Round 3/4 有评分 (1-100)
  metrics?: Record<string, number>;
  issues: Array<{
    issue: string;
    severity: "critical" | "major" | "minor" | "suggestion";
    evidence: string;
    suggestion: string;
    expectedEffect: string;
  }>;
}
```

### 3.5 门禁（MCP 工具层检查）

- HARD: 章节内容已存在
- HARD (round 2): Round 1 已完成
- HARD (round 3): Round 2 已完成
- HARD (round 4): Round 3 已完成

### 3.6 验收标准

- [ ] AC-REV-1: saveRound 正确保存到 project_documents，category="review"
- [ ] AC-REV-2: 同一章节同一轮次重复保存，version 递增
- [ ] AC-REV-3: readRound 按 chapterNumber + round 精确查询
- [ ] AC-REV-4: readByChapter 返回该章节所有轮次，按 round 排序
- [ ] AC-REV-5: list 返回项目所有审校摘要，按 createdAt desc
- [ ] AC-REV-6: isChapterPassed 返回四轮全通过则 passed=true
- [ ] AC-REV-7: isChapterPassed 对无审校记录的章节返回 passed=false, completedRounds=0

---

## 4. AnalysisService

### 4.1 定位

九维分析结果 CRUD 服务。析典 agent 完成分析后，调用 MCP 工具存储结果。

### 4.2 存储

使用已有 `project_documents` 表：
- `category` = `"analysis"`
- `title` = `"Analysis {scope} {range}"` 格式
- `content` = JSON 字符串（分析结果）
- `metadata` = `{ scope, range?, overall, topIssues }`

### 4.3 接口

```typescript
// 保存分析结果
export async function save(
  projectId: string,
  data: AnalysisResult
): Promise<ServiceResult<{ id: string }>>

// 读取特定分析报告
export async function read(
  projectId: string,
  analysisId: string,
): Promise<ServiceResult<AnalysisDocument>>

// 列出项目分析报告
export async function list(
  projectId: string,
  filters?: { scope?: string; latest?: boolean }
): Promise<ServiceResult<AnalysisDocument[]>>

// 获取趋势数据（多次分析的 overall 变化）
export async function trend(
  projectId: string,
): Promise<ServiceResult<TrendPoint[]>>
```

### 4.4 AnalysisResult 结构

```typescript
interface AnalysisResult {
  scope: "chapter" | "arc" | "full";
  range?: { start: number; end: number };
  dimensions: Record<string, {
    score: number;         // 1-100
    analysis: string;
    trend?: "improving" | "stable" | "declining";
    suggestions: string[];
  }>;
  overall: number;
  topIssues: string[];
}

interface TrendPoint {
  id: string;
  scope: string;
  overall: number;
  createdAt: Date;
}
```

### 4.5 门禁（MCP 工具层检查）

- HARD (analysis_execute): 指定范围内至少有 1 章已归档
- analysis_read: 无门禁

### 4.6 验收标准

- [ ] AC-ANA-1: save 正确保存到 project_documents，category="analysis"
- [ ] AC-ANA-2: list 支持按 scope 过滤
- [ ] AC-ANA-3: list 支持 latest=true 只返回最新一份
- [ ] AC-ANA-4: trend 返回所有分析的 (id, scope, overall, createdAt) 按时间排序
- [ ] AC-ANA-5: read 按 ID 精确查询
- [ ] AC-ANA-6: 不存在的项目/分析 ID 返回 NOT_FOUND

---

## 5. ConsistencyService

### 5.1 定位

规则式世界观一致性检查。读取项目世界设定，执行预定义规则检查。

### 5.2 接口

```typescript
export async function check(
  projectId: string,
): Promise<ServiceResult<ConsistencyReport>>
```

### 5.3 ConsistencyReport 结构

```typescript
interface ConsistencyReport {
  passed: boolean;
  issues: Array<{
    type: "contradiction" | "missing_reference" | "orphan" | "circular";
    severity: "critical" | "major" | "minor";
    description: string;
    sources: string[];        // 涉及的设定 ID 或标题
    suggestion: string;
  }>;
  summary: {
    totalSettings: number;
    checkedRules: number;
    issueCount: number;
  };
}
```

### 5.4 检查规则

1. **术语引用检查**：设定内容中引用的术语名是否在其他设定中有定义
2. **孤立条目检查**：是否有设定从未被任何其他设定引用
3. **空内容检查**：是否有设定内容为空或过短（< 20 字）
4. **重复标题检查**：是否有同类型设定标题重复

### 5.5 门禁

无（world_check 本身就是检查工具）。但至少需要 1 条世界设定存在。

### 5.6 验收标准

- [ ] AC-CON-1: 无设定时返回 passed=true, issues=[]
- [ ] AC-CON-2: 检测到空内容设定时报告 type="missing_reference"
- [ ] AC-CON-3: 检测到重复标题时报告 type="contradiction"
- [ ] AC-CON-4: summary 正确统计 totalSettings / checkedRules / issueCount
- [ ] AC-CON-5: 不存在的项目返回错误

---

## 6. MCP 工具更新

### 6.1 context_assemble

替换 NOT_IMPLEMENTED stub，调用 contextService.assemble()。门禁在工具层实现。

### 6.2 review_execute

替换 NOT_IMPLEMENTED stub。门禁：章节存在 + 轮次顺序。调用 reviewService.saveRound()。

注意：明镜 agent 在调用此工具时传入的是它已完成的审校结果。工具只负责存储和门禁验证。

### 6.3 analysis_execute / analysis_read

替换 NOT_IMPLEMENTED stubs。analysis_execute 门禁：范围内有归档章节。调用 analysisService 对应方法。

### 6.4 world_check

替换 NOT_IMPLEMENTED stub。调用 consistencyService.check()。

---

## 7. API 路由更新

### 7.1 reviews.ts

```
GET /api/projects/:id/reviews         → reviewService.list(projectId)
GET /api/projects/:id/reviews/:chapterNum → reviewService.readByChapter(projectId, chapterNum)
```

### 7.2 analysis.ts

```
GET /api/projects/:id/analysis         → analysisService.list(projectId)
GET /api/projects/:id/analysis/trend   → analysisService.trend(projectId)
GET /api/projects/:id/analysis/:chapterNum → analysisService.list(projectId, { scope: "chapter" }) filtered
```

---

## 8. 测试要求

每个服务需要完整的单元测试：

| 服务 | 测试文件 | 最低测试数 |
|------|---------|-----------|
| ContextService | context.service.test.ts | 8 |
| ReviewService | review.service.test.ts | 10 |
| AnalysisService | analysis.service.test.ts | 8 |
| ConsistencyService | consistency.service.test.ts | 6 |

MCP 工具和 API 路由的已有测试需要更新，确保不再返回 NOT_IMPLEMENTED。

---

## 9. 实现顺序

1. **ReviewService** — 最简单（纯 CRUD on project_documents）
2. **AnalysisService** — 类似 ReviewService
3. **ConsistencyService** — 规则引擎，无外部依赖
4. **ContextService** — 最复杂，依赖多个服务

每个服务完成后立即接通 MCP 工具和 API 路由。
