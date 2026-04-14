/**
 * Agent 模块 — 导出 Agent 类型定义、注册表和所有 Agent 配置
 */

// Types
export type { AgentDefinition, AgentPermissions, AgentId, AgentCategory, AgentFilter } from "./types.js";

// Registry
export { AgentRegistry, defaultRegistry } from "./registry.js";

// Individual configs
export { mohengConfig } from "./configs/moheng.js";
export { lingxiConfig } from "./configs/lingxi.js";
export { jiangxinConfig } from "./configs/jiangxin.js";
export { zhibiConfig } from "./configs/zhibi.js";
export { mingjingConfig } from "./configs/mingjing.js";
export { zaishiConfig } from "./configs/zaishi.js";
export { bowenConfig } from "./configs/bowen.js";
export { xidianConfig } from "./configs/xidian.js";
export { shuchongConfig } from "./configs/shuchong.js";
export { dianjingConfig } from "./configs/dianjing.js";
