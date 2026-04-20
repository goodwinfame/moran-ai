# Phase 12 — MCP Gate Enforcement

> **Status**: Pending
> **Depends on**: Phase 11 (AI Services — ReviewService, AnalysisService, ConsistencyService, ContextService)
> **Authority**: `docs/v2-s6-mcp-gates.md` §2–3

---

## 1. Problem Statement

Phase 3 (MCP tools) implemented 54 tools with placeholder TODO comments for 6 gate checks that required services not yet available. Phase 11 completed ReviewService and other AI services. Now all dependencies are available — these gates must be enforced.

Additionally, cross-referencing tool code against `docs/v2-s6-mcp-gates.md` reveals 3 more missing gates (not marked TODO) that were never implemented.

---

## 2. Scope — 9 Gate Checks Across 7 Tool Files

### 2.1 Gates with TODO Comments (6)

| # | Tool | File | Level | Condition | Service |
|---|------|------|-------|-----------|---------|
| 1 | `timeline_create` | timeline.ts:27 | HARD | 该章节审校通过 | reviewService.isChapterPassed |
| 2 | `thread_create` | thread.ts:41 | HARD | plantedChapter 已存在内容 | checker.hasChapter (exists) |
| 3 | `summary_create` (chapter) | summary.ts:26 | HARD | 该章节审校通过（四轮完成） | reviewService.isChapterPassed |
| 4 | `summary_create` (arc) | summary.ts:26 | HARD | 该弧段内所有章节已归档 | outlineService.readArc + chapterService.list |
| 5 | `chapter_update` | chapter.ts:113 | HARD | 有对应的审校报告 | reviewService.readByChapter |
| 6 | `character_delete` | character.ts:100 | SOFT | 角色未在已归档章节中出场 | characterService.listStates + chapterService.list |
| 7 | `character_state_create` | character-state.ts:43 | HARD | 该章节内容已存在 | checker.hasChapter (exists) |

### 2.2 Gates Missing Without TODO (2)

| # | Tool | File | Level | Condition | Service |
|---|------|------|-------|-----------|---------|
| 8 | `thread_update` | thread.ts:105 | HARD | 该章节已审校通过 | reviewService.isChapterPassed |
| 9 | `chapter_archive` | chapter.ts:146 | HARD | 审校通过（四轮） | reviewService.isChapterPassed |

> Note: `chapter_archive` spec also requires 4 more HARD gates (摘要已生成, 伏笔已更新, 时间线已记录, 角色状态已快照). These are deferred — they require complex cross-table queries and the current `checkPrerequisites("archive")` action would need significant expansion. Tracked as future enhancement.

---

## 3. Technical Design

### 3.1 New Helper Functions in `checker.ts`

Add these reusable helpers alongside existing ones:

```typescript
// Uses reviewService.isChapterPassed() — returns true if all 4 rounds passed
async function hasReviewPassed(projectId: string, chapterNumber: number): Promise<boolean>

// Checks if a character appears in any archived chapter's state snapshots
async function isCharacterInArchivedChapters(projectId: string, characterId: string): Promise<boolean>

// Checks if all chapters in an arc range are archived
async function areArcChaptersArchived(projectId: string, arcIndex: number): Promise<boolean>
```

### 3.2 New Gate Actions in `checkPrerequisites()`

Extend the `GateAction` union and add cases:

```typescript
type GateAction = ... | "timeline_record" | "thread_plant" | "summary_chapter" | "summary_arc" | "chapter_revise" | "character_remove" | "character_state_record";
```

Each new action returns a `GateResult` with appropriate HARD/SOFT conditions.

### 3.3 Implementation Pattern

For each tool, replace `// TODO:` with actual gate check:

```typescript
// HARD gate pattern
const prereqs = await checkPrerequisites(projectId, "action_name", { chapterNumber });
if (!prereqs.passed) {
  return fail("GATE_FAILED", "前置条件未满足", toGateDetails(prereqs));
}

// SOFT gate pattern (for character_delete)
const prereqs = await checkPrerequisites(projectId, "character_remove", { characterId });
// SOFT gates don't block — just include warning in response
```

For SOFT gates (character_delete), the operation still proceeds but the response includes warnings.

---

## 4. Gate Logic Details

### Gate 1: `timeline_create` — 该章节审校通过
```
reviewService.isChapterPassed(projectId, chapterNumber)
→ passed === true → proceed
→ passed === false → GATE_FAILED "该章节审校尚未通过，请先完成四轮审校"
```

### Gate 2: `thread_create` — plantedChapter 已存在内容
```
hasChapter(projectId, plantedChapter) // already exists in checker.ts
→ true → proceed
→ false → GATE_FAILED "第N章内容不存在，伏笔必须在已有内容的章节中埋设"
```

### Gate 3: `summary_create` (chapter) — 该章节审校通过
```
reviewService.isChapterPassed(projectId, chapterNumber)
→ passed === true → proceed
→ passed === false → GATE_FAILED "该章节审校尚未通过，请先完成四轮审校后再创建摘要"
```

### Gate 4: `summary_create` (arc) — 弧段内所有章节已归档
```
outlineService.readArc(projectId, arcIndex) → get startChapter, endChapter
chapterService.list(projectId) → filter by range → check all status === "archived"
→ all archived → proceed
→ any not archived → GATE_FAILED "弧段内尚有未归档章节"
```

### Gate 5: `chapter_update` — 有对应的审校报告
```
reviewService.readByChapter(projectId, chapterNumber)
→ data.length > 0 → proceed
→ data.length === 0 → GATE_FAILED "该章节没有审校报告，请先执行审校"
```

### Gate 6: `character_delete` — SOFT: 角色未在已归档章节中出场
```
characterService.listStates(characterId) → get all states
chapterService.list(projectId) → get archived chapters
→ no overlap → proceed normally
→ overlap exists → SOFT warning "该角色在已归档章节中出场（第X,Y章），删除可能影响一致性" + still execute
```

### Gate 7: `character_state_create` — 该章节内容已存在
```
hasChapter(projectId, chapterNumber) // already exists in checker.ts
→ true → proceed
→ false → GATE_FAILED "第N章内容不存在，请先写作该章节"
```

### Gate 8: `thread_update` — 该章节已审校通过
```
reviewService.isChapterPassed(projectId, chapterNumber)
→ passed === true → proceed
→ passed === false → GATE_FAILED "该章节审校尚未通过"
```

### Gate 9: `chapter_archive` — 审校通过
```
reviewService.isChapterPassed(projectId, chapterNumber)
→ passed === true → proceed (in addition to existing "archive" prerequisites)
→ passed === false → GATE_FAILED "该章节审校尚未通过（需四轮全部通过）"
```

---

## 5. Acceptance Criteria

### AC-1: All 9 gates enforced
- Each gate check queries real service data (not stubs)
- HARD gates return `GATE_FAILED` error code with descriptive message
- SOFT gates include warning but still execute

### AC-2: Existing tests updated
- Each gate has at least 2 test cases: pass + block (or warn for SOFT)
- Existing happy-path tests updated to mock gate dependencies

### AC-3: No regressions
- `pnpm typecheck` passes all 4 packages
- `pnpm test` passes all existing tests + new gate tests

### AC-4: TODO comments removed
- All 6 `// TODO:` comments replaced with actual implementations

---

## 6. Files Modified

### Checker (1 file)
- `packages/mcp-server/src/gates/checker.ts` — add 3 helpers + 7 new gate actions

### Tools (6 files)
- `packages/mcp-server/src/tools/timeline.ts` — gate check + import
- `packages/mcp-server/src/tools/thread.ts` — gate check on create + update
- `packages/mcp-server/src/tools/summary.ts` — gate check (chapter + arc paths)
- `packages/mcp-server/src/tools/chapter.ts` — gate check on update + archive
- `packages/mcp-server/src/tools/character.ts` — soft gate on delete
- `packages/mcp-server/src/tools/character-state.ts` — gate check + import

### Tests (6 files)
- `packages/mcp-server/src/__tests__/tools/timeline.test.ts`
- `packages/mcp-server/src/__tests__/tools/thread.test.ts`
- `packages/mcp-server/src/__tests__/tools/summary.test.ts`
- `packages/mcp-server/src/__tests__/tools/chapter.test.ts`
- `packages/mcp-server/src/__tests__/tools/character.test.ts`
- `packages/mcp-server/src/__tests__/tools/character-state.test.ts`

---

## 7. Out of Scope

- `chapter_archive` extended gates (摘要已生成, 伏笔已更新, 时间线已记录, 角色状态已快照) — tracked as future enhancement
- Phase-level gates (already implemented in checker.ts)
- Read tool gates (spec says reads are gate-free)
