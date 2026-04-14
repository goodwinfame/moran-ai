/**
 * AgentRegistry — Agent 注册表
 *
 * 管理所有 Agent 定义的注册、查找、过滤。
 * 提供预注册的 defaultRegistry 单例，包含全部 10 个 Agent 配置。
 */

import type { AgentDefinition, AgentFilter, AgentId } from "./types.js";
import { mohengConfig } from "./configs/moheng.js";
import { lingxiConfig } from "./configs/lingxi.js";
import { jiangxinConfig } from "./configs/jiangxin.js";
import { zhibiConfig } from "./configs/zhibi.js";
import { mingjingConfig } from "./configs/mingjing.js";
import { zaishiConfig } from "./configs/zaishi.js";
import { bowenConfig } from "./configs/bowen.js";
import { xidianConfig } from "./configs/xidian.js";
import { shuchongConfig } from "./configs/shuchong.js";
import { dianjingConfig } from "./configs/dianjing.js";

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  /** 注册一个 Agent 定义 */
  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  /** 获取 Agent 定义，不存在返回 undefined */
  get(id: AgentId): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /** 获取 Agent 定义，不存在抛出异常 */
  getRequired(id: AgentId): AgentDefinition {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found in registry`);
    }
    return agent;
  }

  /** 列出 Agent，支持按条件过滤 */
  list(filter?: AgentFilter): AgentDefinition[] {
    const all = Array.from(this.agents.values());
    if (!filter) return all;

    return all.filter((a) => {
      if (filter.category && a.category !== filter.category) return false;
      if (filter.model && a.model !== filter.model) return false;
      return true;
    });
  }

  /** 检查 Agent 是否已注册 */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /** 已注册 Agent 数量 */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * 预注册全部 10 个 Agent 的默认注册表
 */
function createDefaultRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(mohengConfig);
  registry.register(lingxiConfig);
  registry.register(jiangxinConfig);
  registry.register(zhibiConfig);
  registry.register(mingjingConfig);
  registry.register(zaishiConfig);
  registry.register(bowenConfig);
  registry.register(xidianConfig);
  registry.register(shuchongConfig);
  registry.register(dianjingConfig);
  return registry;
}

export const defaultRegistry = createDefaultRegistry();
