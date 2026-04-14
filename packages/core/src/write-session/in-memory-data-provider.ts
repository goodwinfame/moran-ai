/**
 * InMemoryDataProvider — 内存数据提供者（测试用）
 *
 * 实现 ProjectDataProvider 接口的内存版本，
 * 用于单元测试和开发中无需连接 PostgreSQL。
 */

import type { ProjectDataProvider, WriteSessionState } from "./types.js";

/** 弧段数据 */
export interface MockArcData {
  arcNumber: number;
  arcName?: string;
  startChapter: number;
  endChapter: number;
  totalChapters: number;
}

/**
 * 内存数据提供者
 */
export class InMemoryDataProvider implements ProjectDataProvider {
  private lastCompletedChapter: Map<string, number> = new Map();
  private arcs: Map<string, MockArcData[]> = new Map();
  private briefs: Map<string, Map<number, string>> = new Map();
  private chapterContents: Map<string, Map<number, string>> = new Map();
  private projectProgress: Map<string, { chapter: number; arc: number }> = new Map();
  private sessionStates: Map<string, WriteSessionState> = new Map();

  // ── Setup methods (for test configuration) ─────

  /** 设置项目的最后完成章节号 */
  setLastCompletedChapter(projectId: string, chapter: number): void {
    this.lastCompletedChapter.set(projectId, chapter);
  }

  /** 添加弧段数据 */
  addArc(projectId: string, arc: MockArcData): void {
    const existing = this.arcs.get(projectId) ?? [];
    existing.push(arc);
    this.arcs.set(projectId, existing);
  }

  /** 设置章节 Brief */
  setBrief(projectId: string, chapterNumber: number, brief: string): void {
    const map = this.briefs.get(projectId) ?? new Map<number, string>();
    map.set(chapterNumber, brief);
    this.briefs.set(projectId, map);
  }

  /** 设置章节内容 */
  setChapterContent(projectId: string, chapterNumber: number, content: string): void {
    const map = this.chapterContents.get(projectId) ?? new Map<number, string>();
    map.set(chapterNumber, content);
    this.chapterContents.set(projectId, map);
  }

  // ── ProjectDataProvider interface ─────────────────

  async getLastCompletedChapter(projectId: string): Promise<number> {
    return this.lastCompletedChapter.get(projectId) ?? 0;
  }

  async getCurrentArc(projectId: string): Promise<{
    arcNumber: number;
    arcName?: string;
    startChapter: number;
    endChapter: number;
    totalChapters: number;
  } | null> {
    const arcsForProject = this.arcs.get(projectId);
    if (!arcsForProject || arcsForProject.length === 0) return null;

    const progress = this.projectProgress.get(projectId);
    const currentArcNum = progress?.arc ?? 1;

    const arc = arcsForProject.find((a) => a.arcNumber === currentArcNum);
    if (!arc) {
      // 如果没找到当前弧段，返回第一个
      const first = arcsForProject[0];
      if (!first) return null;
      return first;
    }

    return arc;
  }

  async getNextArc(projectId: string, currentArcNumber: number): Promise<{
    arcNumber: number;
    arcName?: string;
    startChapter: number;
    endChapter: number;
    totalChapters: number;
  } | null> {
    const arcsForProject = this.arcs.get(projectId);
    if (!arcsForProject) return null;

    const next = arcsForProject.find((a) => a.arcNumber === currentArcNumber + 1);
    return next ?? null;
  }

  async getChapterBrief(projectId: string, chapterNumber: number): Promise<string | null> {
    const map = this.briefs.get(projectId);
    if (!map) return null;
    return map.get(chapterNumber) ?? null;
  }

  async getChapterContent(projectId: string, chapterNumber: number): Promise<string | null> {
    const map = this.chapterContents.get(projectId);
    if (!map) return null;
    return map.get(chapterNumber) ?? null;
  }

  async updateProjectProgress(projectId: string, currentChapter: number, currentArc: number): Promise<void> {
    this.projectProgress.set(projectId, { chapter: currentChapter, arc: currentArc });
    // Also update last completed
    const prev = this.lastCompletedChapter.get(projectId) ?? 0;
    if (currentChapter > prev) {
      this.lastCompletedChapter.set(projectId, currentChapter);
    }
  }

  async saveSessionState(state: WriteSessionState): Promise<void> {
    this.sessionStates.set(state.projectId, { ...state });
  }

  async loadSessionState(projectId: string): Promise<WriteSessionState | null> {
    return this.sessionStates.get(projectId) ?? null;
  }

  // ── Test inspection ─────────────────────────────

  /** 获取项目进度（测试检查用） */
  getProjectProgress(projectId: string): { chapter: number; arc: number } | undefined {
    return this.projectProgress.get(projectId);
  }

  /** 获取保存的会话状态（测试检查用） */
  getSavedSessionState(projectId: string): WriteSessionState | undefined {
    return this.sessionStates.get(projectId);
  }
}
