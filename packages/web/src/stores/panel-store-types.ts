/**
 * Panel Store Types — Data interface definitions for all info-panel tabs.
 * Kept separate to stay under the 500-line file limit.
 */

export type { TabId } from "@/lib/panel-event-router";

// ── [脑暴] Tab ─────────────────────────────────────────────────────────────────

export interface BrainstormDirection {
  id: string;
  title: string;
  starred: boolean;
}

export interface BrainstormConverge {
  selectedDirections: string[];
  genre: string;
  coreConflict: string;
  targetAudience: string;
}

export interface BrainstormCrystal {
  title: string;
  type: string;
  concept: string;
  sellingPoints: string;
  wordTarget: string;
  oneLiner: string;
}

export interface BrainstormData {
  diverge: BrainstormDirection[];
  converge: BrainstormConverge | null;
  crystal: BrainstormCrystal | null;
}

// ── [设定] Tab ─────────────────────────────────────────────────────────────────

export interface WorldSubsystem {
  id: string;
  name: string;
  icon: string;
  category: string;
  summary: string;
  entryCount: number;
  lastUpdatedChapter: number | null;
  hasNewContent: boolean;
}

export interface WorldData {
  categories: string[];
  subsystems: WorldSubsystem[];
  activeSubsystemId: string | null;
}

// ── [角色] Tab ─────────────────────────────────────────────────────────────────

export interface CharacterCurrentState {
  location: string;
  mood: string;
  newKnowledge: string;
  lieProgress: string;
  relationshipChanges: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  designTier: "核心层" | "重要层" | "支撑层" | "点缀层";
  oneLiner?: string;
  biography?: string;
  personality?: string;
  abilities?: string;
  goals?: string;
  relationships?: string;
  arc?: string;
  /** GHOST/WOUND/LIE/WANT/NEED — 五维心理模型 */
  ghost?: string;
  wound?: string;
  lie?: string;
  want?: string;
  need?: string;
  currentState?: CharacterCurrentState;
}

export interface CharacterData {
  characters: Character[];
  filterRole: string | null;
}

// ── [大纲] Tab ─────────────────────────────────────────────────────────────────

export interface ChapterBrief {
  summary: string;
  coreEvents: string[];
  foreshadowing: string[];
  characters: string[];
  wordTarget: number;
}

export type ChapterStatus = "completed" | "writing" | "reviewing" | "pending" | "unplanned";

export interface OutlineChapter {
  number: number;
  title: string;
  status: ChapterStatus;
  brief: ChapterBrief | null;
}

export interface OutlineArc {
  id: string;
  title: string;
  chapterRange: string;
  chapters: OutlineChapter[];
}

export interface OutlineData {
  arcs: OutlineArc[];
}

// ── 伏笔追踪 (part of outline tab) ────────────────────────────────────────────

export interface ForeshadowEntry {
  id: string;
  description: string;
  plantedChapter: number;
  characters: string[];
  plannedArc?: string;
  resolvedChapter?: number;
}

export interface ForeshadowData {
  unresolved: ForeshadowEntry[];
  resolved: ForeshadowEntry[];
  overdue: ForeshadowEntry[];
}

// ── 时间线 (part of outline tab) ──────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  storyTime: string;
  description: string;
  characters: string[];
  chapterNumber: number;
}

export interface TimelineData {
  events: TimelineEvent[];
}

// ── [章节] Tab ─────────────────────────────────────────────────────────────────

export interface ChapterListItem {
  number: number;
  title: string;
  status: string;
  wordCount: number;
}

export interface WritingProgress {
  current: number;
  target: number;
}

export interface ChapterData {
  mode: "reading" | "writing";
  chapterList: ChapterListItem[];
  selectedChapter: number | null;
  writingProgress: WritingProgress | null;
  streamingContent: string;
  isAutoFollow: boolean;
}

// ── [审校] Tab ─────────────────────────────────────────────────────────────────

export interface ReviewIssue {
  location: string;
  description: string;
  suggestion: string;
  severity: "critical" | "warning";
}

export interface ReviewRound {
  round: 1 | 2 | 3 | 4;
  dimension: string;
  score: number;
  issues: ReviewIssue[];
}

export interface ChapterReview {
  id: string;
  conclusion: "pass" | "revise" | "rewrite";
  totalScore: number;
  rounds: ReviewRound[];
}

export interface ReviewChapterEntry {
  chapterNumber: number;
  title: string;
  reviews: ChapterReview[];
}

export interface ReviewData {
  chapters: ReviewChapterEntry[];
  selectedChapter: number | null;
}

// ── [分析] Tab ─────────────────────────────────────────────────────────────────

export interface RadarDataPoint {
  dimension: string;
  score: number;
}

export interface TrendDataPoint {
  chapter: number;
  [dimension: string]: number;
}

export interface AnalysisData {
  radarData: RadarDataPoint[];
  trendData: TrendDataPoint[];
  commentary: string;
  overallScore: number;
}

export interface ExternalReport {
  id: string;
  workTitle: string;
  topic: string;
  date: string;
  content: string;
}

export interface ExternalAnalysisData {
  reports: ExternalReport[];
}

// ── [知识库] Tab ───────────────────────────────────────────────────────────────

export type KnowledgeScope = "project" | "global";

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  summary: string;
  source: string;
  scope: KnowledgeScope;
  content?: string;
  maintainer?: string;
  updatedAt?: string;
}

export interface KnowledgeData {
  entries: KnowledgeEntry[];
  totalCount: number;
  loadedCount: number;
}

// ── Patch types ────────────────────────────────────────────────────────────────

export type WorldPatch =
  | { type: "set"; data: WorldData }
  | { type: "addSubsystem"; subsystem: WorldSubsystem }
  | { type: "patchSubsystem"; id: string; update: Partial<WorldSubsystem> }
  | { type: "setActiveSubsystem"; id: string | null };

export type CharacterPatch =
  | { type: "set"; data: CharacterData }
  | { type: "add"; character: Character }
  | { type: "patch"; id: string; update: Partial<Character> };

export type OutlinePatch =
  | { type: "set"; data: OutlineData }
  | { type: "addArc"; arc: OutlineArc }
  | { type: "addBrief"; arcId: string; chapterNumber: number; brief: ChapterBrief }
  | { type: "updateStatus"; chapterNumber: number; status: ChapterStatus };

export type ForeshadowPatch =
  | { type: "set"; data: ForeshadowData }
  | { type: "add"; entry: ForeshadowEntry }
  | { type: "resolve"; id: string; resolvedChapter: number };

export type TimelinePatch =
  | { type: "set"; events: TimelineEvent[] }
  | { type: "addEvent"; event: TimelineEvent };

/** appendContent is a special field: appends to streamingContent instead of replacing it */
export type ChapterPatch = Partial<ChapterData> & { appendContent?: string };

export type ReviewPatch =
  | { type: "set"; data: ReviewData }
  | { type: "addReview"; chapterNumber: number; title: string; review: ChapterReview };

export type ExternalAnalysisPatch =
  | { type: "set"; data: ExternalAnalysisData }
  | { type: "add"; report: ExternalReport };

export type KnowledgePatch =
  | { type: "set"; data: KnowledgeData }
  | { type: "add"; entry: KnowledgeEntry }
  | { type: "patch"; id: string; update: Partial<KnowledgeEntry> }
  | { type: "promote"; id: string };
