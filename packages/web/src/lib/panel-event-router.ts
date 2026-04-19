/**
 * Panel Event Router — maps MCP tool results to info-panel tabs.
 * T7: packages/web/src/lib/panel-event-router.ts
 *
 * Pure functions — no store imports. Consumers decide what to do with the result.
 */

/** Valid info-panel tab identifiers */
export type TabId =
  | "brainstorm"
  | "settings"
  | "characters"
  | "outline"
  | "chapters"
  | "review"
  | "analysis"
  | "knowledge";

/**
 * Maps write-operation MCP tool names to their target panel tab.
 * Read-only tools are not included — they do not trigger tab switches.
 */
export const TOOL_TAB_MAP: Record<string, TabId> = {
  // ── Brainstorm tab ────────────────────────────────────────────────────
  brainstorm_create: "brainstorm",
  brainstorm_update: "brainstorm",
  brainstorm_patch: "brainstorm",

  // ── Settings tab (world domain) ───────────────────────────────────────
  world_create: "settings",
  world_update: "settings",
  world_delete: "settings",
  world_patch: "settings",

  // ── Characters tab ────────────────────────────────────────────────────
  character_create: "characters",
  character_update: "characters",
  character_delete: "characters",
  character_patch: "characters",
  character_state_create: "characters",
  relationship_create: "characters",
  relationship_update: "characters",

  // ── Outline tab ───────────────────────────────────────────────────────
  outline_create: "outline",
  outline_update: "outline",
  outline_patch: "outline",

  // ── Chapters tab ──────────────────────────────────────────────────────
  chapter_create: "chapters",
  chapter_update: "chapters",
  chapter_archive: "chapters",
  chapter_patch: "chapters",
  style_create: "chapters",
  style_update: "chapters",
  summary_create: "chapters",

  // ── Review tab ────────────────────────────────────────────────────────
  review_execute: "review",

  // ── Analysis tab ─────────────────────────────────────────────────────
  analysis_execute: "analysis",

  // ── Knowledge tab ────────────────────────────────────────────────────
  knowledge_create: "knowledge",
  knowledge_update: "knowledge",
  knowledge_delete: "knowledge",
  knowledge_patch: "knowledge",
  lesson_create: "knowledge",
  lesson_update: "knowledge",
  thread_create: "knowledge",
  thread_update: "knowledge",
  timeline_create: "knowledge",
};

/**
 * Resolve which tab a tool_result event should target.
 * Returns null for read-only or unknown tools.
 */
export function routeToolResultToTab(toolName: string): TabId | null {
  return TOOL_TAB_MAP[toolName] ?? null;
}

/**
 * Decide whether to auto-switch to the target tab or just show a badge.
 *
 * 10-second operation protection: if the user interacted with the panel
 * within the last 10 seconds, only add a badge instead of switching.
 *
 * @param targetTab         - Tab that wants to become active
 * @param lastUserActionTime - Unix timestamp (ms) of the last user interaction
 * @returns `{ action: 'switch' }` or `{ action: 'badge' }`
 */
export function handleAutoSwitch(
  targetTab: TabId,
  lastUserActionTime: number,
): { action: "switch" | "badge"; tab: TabId } {
  const elapsed = Date.now() - lastUserActionTime;
  const action = elapsed < 10_000 ? "badge" : "switch";
  return { action, tab: targetTab };
}
