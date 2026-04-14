/**
 * Agent 类型定义 — 定义 Agent 的配置接口和相关类型
 */

/** Agent 唯一标识 (拼音) */
export type AgentId =
  | "moheng"
  | "lingxi"
  | "jiangxin"
  | "zhibi"
  | "mingjing"
  | "zaishi"
  | "bowen"
  | "xidian"
  | "shuchong"
  | "dianjing";

/** Agent 分类 */
export type AgentCategory = "core" | "support" | "optional";

/** Agent 权限配置 */
export interface AgentPermissions {
  /** 可读取的数据类别 */
  read: string[];
  /** 可写入的数据类别 */
  write: string[];
  /** 可调用的工具列表 */
  tools: string[];
  /** 可调度的其他 Agent ID */
  dispatch?: AgentId[];
}

/** Agent 定义 — 描述一个 Agent 的完整配置 */
export interface AgentDefinition {
  /** Agent 唯一标识 (拼音) */
  id: AgentId;
  /** Agent 中文名 */
  name: string;
  /** Agent 显示名 (如 "执笔·剑心") */
  displayName: string;
  /** Agent 角色描述 */
  role: string;
  /** 模型标识 (如 "claude-opus-4.6", "claude-sonnet-4.6") */
  model: string;
  /** 温度 (0-1)，null 表示动态由编排器决定 */
  temperature: number | null;
  /** Agent 类别 */
  category: AgentCategory;
  /** 权限配置 */
  permissions: AgentPermissions;
  /** 系统提示词模板 */
  systemPrompt: string;
  /** Agent 特有配置 */
  config?: Record<string, unknown>;
}

/** Agent 过滤条件 */
export interface AgentFilter {
  category?: AgentCategory;
  model?: string;
}
