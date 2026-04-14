/**
 * @moran/core — 墨染核心引擎
 *
 * 导出：Agent 框架、事件总线、UNM 记忆引擎、数据库层、编排控制器、日志系统、风格引擎、写作引擎
 */

// Re-export DB layer
export * from "./db/index.js";

// Re-export types
export type * from "./types/index.js";

// Re-export logger
export { logger, createLogger, type Logger } from "./logger/index.js";

// Re-export agents
export * from "./agents/index.js";

// Re-export events
export * from "./events/index.js";

// Re-export store
export * from "./store/index.js";

// Re-export orchestrator
export * from "./orchestrator/index.js";

// Re-export bridge
export * from "./bridge/index.js";

// Re-export style engine
export * from "./style/index.js";

// Re-export writer engine
export * from "./writer/index.js";

// Re-export review engine (明镜审校系统)
export * from "./review/index.js";

// Re-export lingxi engine (灵犀创意脑暴)
export * from "./lingxi/index.js";

// Re-export jiangxin engine (匠心设计引擎)
export * from "./jiangxin/index.js";

// Re-export zaishi engine (载史归档引擎)
export * from "./zaishi/index.js";

// Re-export xidian engine (析典参考作品分析)
export * from "./xidian/index.js";

// Re-export plantser pipeline (三层Brief + 情感地雷 + Scene-Sequel)
export * from "./plantser/index.js";

// Re-export knowledge subsystem (知识库 + 教训自学习)
export * from "./knowledge/index.js";

// Re-export write-session (多章连续写作: write-next / write-loop)
export * from "./write-session/index.js";
