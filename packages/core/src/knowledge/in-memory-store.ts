/**
 * InMemory implementations of KnowledgeStore and LessonStore
 * for unit testing
 */

import { randomUUID } from "node:crypto";
import type { KnowledgeStore } from "./knowledge-service.js";
import type { LessonStore } from "./lessons-service.js";
import type {
  KnowledgeEntry,
  KnowledgeFilter,
  KnowledgeVersion,
  KnowledgeScope,
  KnowledgeCategory,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  Lesson,
  LessonFilter,
  LessonStatus,
  CreateLessonInput,
} from "./types.js";
import { DEFAULT_LESSON_EXPIRY_THRESHOLD } from "./types.js";

// ── InMemoryKnowledgeStore ──────────────────────────────

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private versions: KnowledgeVersion[] = [];

  async findById(id: string): Promise<KnowledgeEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async findMany(filter: KnowledgeFilter): Promise<KnowledgeEntry[]> {
    let results = Array.from(this.entries.values());
    if (filter.scope) {
      results = results.filter((e) => e.scope === filter.scope);
    }
    if (filter.category) {
      results = results.filter((e) => e.category === filter.category);
    }
    if (filter.tags && filter.tags.length > 0) {
      const tagSet = new Set(filter.tags.map((t) => t.toLowerCase()));
      results = results.filter((e) =>
        e.tags.some((tag) => tagSet.has(tag.toLowerCase())),
      );
    }
    if (filter.consumers && filter.consumers.length > 0) {
      const consumerSet = new Set(filter.consumers.map((c) => c.toLowerCase()));
      results = results.filter((e) =>
        e.consumers.some((c) => consumerSet.has(c.toLowerCase())),
      );
    }
    return results;
  }

  async findByScope(scope: KnowledgeScope): Promise<KnowledgeEntry[]> {
    return Array.from(this.entries.values()).filter((e) => e.scope === scope);
  }

  async findByScopeAndCategory(scope: KnowledgeScope, category: KnowledgeCategory): Promise<KnowledgeEntry[]> {
    return Array.from(this.entries.values()).filter(
      (e) => e.scope === scope && e.category === category,
    );
  }

  async findByConsumer(consumer: string, scopes: KnowledgeScope[]): Promise<KnowledgeEntry[]> {
    const scopeSet = new Set<string>(scopes);
    const consumerLower = consumer.toLowerCase();
    return Array.from(this.entries.values()).filter(
      (e) =>
        scopeSet.has(e.scope) &&
        e.consumers.some((c) => c.toLowerCase() === consumerLower),
    );
  }

  async create(input: CreateKnowledgeInput): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      id: randomUUID(),
      scope: input.scope,
      category: input.category,
      title: input.title ?? null,
      content: input.content,
      tags: input.tags ?? [],
      consumers: input.consumers ?? [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  async update(id: string, input: UpdateKnowledgeInput, newVersion: number): Promise<KnowledgeEntry> {
    const existing = this.entries.get(id);
    if (!existing) throw new Error(`Not found: ${id}`);
    const updated: KnowledgeEntry = {
      ...existing,
      title: input.title !== undefined ? input.title ?? null : existing.title,
      content: input.content ?? existing.content,
      tags: input.tags ?? existing.tags,
      consumers: input.consumers ?? existing.consumers,
      version: newVersion,
      updatedAt: new Date(),
    };
    this.entries.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
    this.versions = this.versions.filter((v) => v.knowledgeEntryId !== id);
  }

  async createVersion(entryId: string, version: number, content: string, updatedBy?: string): Promise<KnowledgeVersion> {
    const v: KnowledgeVersion = {
      id: randomUUID(),
      knowledgeEntryId: entryId,
      version,
      content,
      updatedBy: updatedBy ?? null,
      createdAt: new Date(),
    };
    this.versions.push(v);
    return v;
  }

  async getVersions(entryId: string): Promise<KnowledgeVersion[]> {
    return this.versions
      .filter((v) => v.knowledgeEntryId === entryId)
      .sort((a, b) => b.version - a.version);
  }

  async getVersion(entryId: string, version: number): Promise<KnowledgeVersion | null> {
    return this.versions.find((v) => v.knowledgeEntryId === entryId && v.version === version) ?? null;
  }
}

// ── InMemoryLessonStore ─────────────────────────────────

export class InMemoryLessonStore implements LessonStore {
  private lessons: Map<string, Lesson> = new Map();

  async findById(id: string): Promise<Lesson | null> {
    return this.lessons.get(id) ?? null;
  }

  async findMany(filter: LessonFilter): Promise<Lesson[]> {
    let results = Array.from(this.lessons.values()).filter(
      (l) => l.projectId === filter.projectId,
    );
    if (filter.status) {
      results = results.filter((l) => l.status === filter.status);
    }
    if (filter.severity) {
      results = results.filter((l) => l.severity === filter.severity);
    }
    if (filter.issueType) {
      results = results.filter((l) => l.issueType === filter.issueType);
    }
    if (filter.tags && filter.tags.length > 0) {
      const tagSet = new Set(filter.tags.map((t) => t.toLowerCase()));
      results = results.filter((l) =>
        l.tags.some((tag) => tagSet.has(tag.toLowerCase())),
      );
    }
    return results;
  }

  async findActive(projectId: string): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).filter(
      (l) => l.projectId === projectId && l.status === "active",
    );
  }

  async findPending(projectId: string): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).filter(
      (l) => l.projectId === projectId && l.status === "pending",
    );
  }

  async create(input: CreateLessonInput): Promise<Lesson> {
    const lesson: Lesson = {
      id: randomUUID(),
      projectId: input.projectId,
      status: "pending",
      severity: input.severity,
      title: input.title,
      description: input.description,
      sourceChapter: input.sourceChapter ?? null,
      sourceAgent: input.sourceAgent ?? null,
      issueType: input.issueType ?? null,
      tags: input.tags ?? [],
      lastTriggeredChapter: null,
      triggerCount: 0,
      inactiveChapters: 0,
      expiryThreshold: DEFAULT_LESSON_EXPIRY_THRESHOLD,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }

  async updateStatus(id: string, status: LessonStatus): Promise<Lesson> {
    const lesson = this.lessons.get(id);
    if (!lesson) throw new Error(`Not found: ${id}`);
    const updated = { ...lesson, status, updatedAt: new Date() };
    this.lessons.set(id, updated);
    return updated;
  }

  async updateTrigger(id: string, chapterNumber: number, triggerCount: number): Promise<Lesson> {
    const lesson = this.lessons.get(id);
    if (!lesson) throw new Error(`Not found: ${id}`);
    const updated = {
      ...lesson,
      lastTriggeredChapter: chapterNumber,
      triggerCount,
      inactiveChapters: 0,
      updatedAt: new Date(),
    };
    this.lessons.set(id, updated);
    return updated;
  }

  async incrementInactive(ids: string[]): Promise<void> {
    for (const id of ids) {
      const lesson = this.lessons.get(id);
      if (lesson) {
        this.lessons.set(id, {
          ...lesson,
          inactiveChapters: lesson.inactiveChapters + 1,
          updatedAt: new Date(),
        });
      }
    }
  }

  async resetInactive(ids: string[]): Promise<void> {
    for (const id of ids) {
      const lesson = this.lessons.get(id);
      if (lesson) {
        this.lessons.set(id, {
          ...lesson,
          inactiveChapters: 0,
          updatedAt: new Date(),
        });
      }
    }
  }

  async archiveExpired(projectId: string, threshold: number): Promise<number> {
    let count = 0;
    for (const lesson of this.lessons.values()) {
      if (
        lesson.projectId === projectId &&
        lesson.status === "active" &&
        lesson.inactiveChapters >= threshold
      ) {
        this.lessons.set(lesson.id, {
          ...lesson,
          status: "archived",
          updatedAt: new Date(),
        });
        count++;
      }
    }
    return count;
  }

  async delete(id: string): Promise<void> {
    this.lessons.delete(id);
  }
}
