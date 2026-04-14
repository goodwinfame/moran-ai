/**
 * KnowledgeService — 知识库 CRUD + 版本管理
 *
 * 管理 knowledge_entries 和 knowledge_versions 表。
 * 每次 update 自动归档旧版本，支持快速回滚。
 */

import { createLogger } from "../logger/index.js";
import type {
  KnowledgeEntry,
  KnowledgeFilter,
  KnowledgeVersion,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeScope,
  KnowledgeCategory,
} from "./types.js";

const logger = createLogger("knowledge-service");

/**
 * 抽象知识库存储接口
 * 由 DB 层实现（Drizzle），测试时可用 InMemory 实现
 */
export interface KnowledgeStore {
  findById(id: string): Promise<KnowledgeEntry | null>;
  findMany(filter: KnowledgeFilter): Promise<KnowledgeEntry[]>;
  findByScope(scope: KnowledgeScope): Promise<KnowledgeEntry[]>;
  findByScopeAndCategory(scope: KnowledgeScope, category: KnowledgeCategory): Promise<KnowledgeEntry[]>;
  findByConsumer(consumer: string, scopes: KnowledgeScope[]): Promise<KnowledgeEntry[]>;
  create(input: CreateKnowledgeInput): Promise<KnowledgeEntry>;
  update(id: string, input: UpdateKnowledgeInput, newVersion: number): Promise<KnowledgeEntry>;
  delete(id: string): Promise<void>;
  createVersion(entryId: string, version: number, content: string, updatedBy?: string): Promise<KnowledgeVersion>;
  getVersions(entryId: string): Promise<KnowledgeVersion[]>;
  getVersion(entryId: string, version: number): Promise<KnowledgeVersion | null>;
}

export class KnowledgeService {
  constructor(private readonly store: KnowledgeStore) {}

  /**
   * 创建知识库条目
   */
  async create(input: CreateKnowledgeInput): Promise<KnowledgeEntry> {
    const entry = await this.store.create(input);
    logger.info({ id: entry.id, scope: entry.scope, category: entry.category }, "Knowledge entry created");
    return entry;
  }

  /**
   * 获取单条知识库条目
   */
  async getById(id: string): Promise<KnowledgeEntry | null> {
    return this.store.findById(id);
  }

  /**
   * 查询知识库条目列表
   */
  async list(filter: KnowledgeFilter = {}): Promise<KnowledgeEntry[]> {
    return this.store.findMany(filter);
  }

  /**
   * 获取指定 scope 下所有条目
   */
  async listByScope(scope: KnowledgeScope): Promise<KnowledgeEntry[]> {
    return this.store.findByScope(scope);
  }

  /**
   * 获取某个 Agent 可消费的所有条目（按 consumers 标签匹配）
   * 自动合并全局 + 项目级知识
   */
  async listForConsumer(consumer: string, projectId: string): Promise<KnowledgeEntry[]> {
    const scopes: KnowledgeScope[] = ["global", `project:${projectId}`];
    return this.store.findByConsumer(consumer, scopes);
  }

  /**
   * 更新知识库条目（自动版本归档）
   *
   * 流程:
   *   1. 读取当前条目
   *   2. 将旧内容归档到 knowledge_versions
   *   3. 更新条目 (version + 1)
   */
  async update(id: string, input: UpdateKnowledgeInput): Promise<KnowledgeEntry> {
    const existing = await this.store.findById(id);
    if (!existing) {
      throw new Error(`Knowledge entry not found: ${id}`);
    }

    // 归档旧版本
    await this.store.createVersion(id, existing.version, existing.content, input.updatedBy ?? "system");

    const newVersion = existing.version + 1;
    const updated = await this.store.update(id, input, newVersion);
    logger.info({ id, version: newVersion }, "Knowledge entry updated");
    return updated;
  }

  /**
   * 删除知识库条目
   * 由于 onDelete: cascade，关联的 versions 自动清理
   */
  async delete(id: string): Promise<void> {
    await this.store.delete(id);
    logger.info({ id }, "Knowledge entry deleted");
  }

  /**
   * 获取条目的版本历史
   */
  async getVersionHistory(entryId: string): Promise<KnowledgeVersion[]> {
    return this.store.getVersions(entryId);
  }

  /**
   * 获取条目的指定版本
   */
  async getVersion(entryId: string, version: number): Promise<KnowledgeVersion | null> {
    return this.store.getVersion(entryId, version);
  }

  /**
   * 将项目级条目升级为全局
   * 仅更新 scope 字段，零断裂迁移
   */
  async promoteToGlobal(id: string): Promise<KnowledgeEntry> {
    const entry = await this.store.findById(id);
    if (!entry) {
      throw new Error(`Knowledge entry not found: ${id}`);
    }
    if (entry.scope === "global") {
      return entry; // already global
    }

    // 归档旧版本（scope change is a significant edit）
    await this.store.createVersion(id, entry.version, entry.content, "system:promote");

    const updated = await this.store.update(
      id,
      { updatedBy: "system:promote" },
      entry.version + 1,
    );
    logger.info({ id }, "Knowledge entry promoted to global");
    return updated;
  }
}
