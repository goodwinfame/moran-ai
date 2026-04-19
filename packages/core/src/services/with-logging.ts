import { writeLog } from "./log.service.js";

/**
 * Wraps an async function to automatically log tool call success/failure,
 * duration, and optional input identifier. Never records full input args.
 */
export function withLogging<TArgs extends unknown[], TResult>(
  toolName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: { extractId?: (args: TArgs) => string },
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const start = Date.now();
    const inputId = options?.extractId ? options.extractId(args) : "[no id extractor]";

    try {
      const result = await fn(...args);
      const durationMs = Date.now() - start;

      await writeLog({
        projectId: "system",
        level: "info",
        category: "tool",
        toolName,
        message: `Tool ${toolName} succeeded (id: ${inputId})`,
        durationMs,
      });

      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await writeLog({
        projectId: "system",
        level: "error",
        category: "tool",
        toolName,
        message: `Tool ${toolName} failed (id: ${inputId})`,
        durationMs,
        metadata: { error: errorMessage },
      });

      throw err;
    }
  };
}
