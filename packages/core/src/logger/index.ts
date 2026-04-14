/**
 * Logger — 基于 pino 的结构化日志系统
 *
 * 支持 JSON 结构化输出（生产）和人类可读格式（开发）。
 * 所有 Agent 和系统组件共用同一日志接口。
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * 创建带有固定上下文的子 logger
 * @example
 * const log = createLogger("墨衡"); // Agent name
 * log.info({ chapter: 5 }, "开始编排写作流程");
 */
export function createLogger(component: string) {
  return logger.child({ component });
}

export type Logger = ReturnType<typeof createLogger>;
