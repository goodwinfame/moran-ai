/**
 * 全局错误处理中间件
 */
import type { ErrorHandler } from "hono";
import { createLogger } from "@moran/core/logger";

const log = createLogger("error-handler");

export const errorHandler: ErrorHandler = (err, c) => {
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;

  log.error({ err, path: c.req.path, method: c.req.method }, "请求处理失败");

  return c.json(
    {
      error: status >= 500 ? "Internal Server Error" : err.message,
      ...(process.env.NODE_ENV !== "production" && { detail: err.message, stack: err.stack }),
    },
    status as 500,
  );
};
