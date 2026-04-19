/**
 * Log cleanup job
 *
 * Periodically deletes expired agent_logs and usage_records.
 * - agent_logs: 90-day retention
 * - usage_records: 365-day retention
 *
 * Call startLogCleanup() at server startup and stopLogCleanup() on shutdown.
 */
import { lt, sql } from "drizzle-orm";
import { logService } from "@moran/core/services";
import { getDb } from "@moran/core/db";
import { usageRecords } from "@moran/core/db/schema";
import { createLogger } from "@moran/core/logger";

const log = createLogger("log-cleanup");

const AGENT_LOG_RETENTION_DAYS = 90;
const USAGE_RECORD_RETENTION_DAYS = 365;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runCleanup(): Promise<void> {
  // ── agent_logs cleanup ──────────────────────────────────────────────────────
  try {
    const logResult = await logService.cleanup(AGENT_LOG_RETENTION_DAYS);
    if (logResult.ok) {
      log.info({ deleted: logResult.data.deleted, table: "agent_logs" }, "Log cleanup completed");
    }
  } catch (err) {
    log.error({ err }, "agent_logs cleanup failed");
  }

  // ── usage_records cleanup ───────────────────────────────────────────────────
  try {
    const db = getDb();
    const cutoff = sql`now() - interval '1 day' * ${USAGE_RECORD_RETENTION_DAYS}`;
    const deleted = await db
      .delete(usageRecords)
      .where(lt(usageRecords.createdAt, cutoff))
      .returning({ id: usageRecords.id });
    log.info({ deleted: deleted.length, table: "usage_records" }, "Usage records cleanup completed");
  } catch (err) {
    log.error({ err }, "usage_records cleanup failed");
  }
}

export function startLogCleanup(): void {
  // Run once immediately (fire-and-forget, don't block startup)
  void runCleanup();
  intervalId = setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS);
  log.info("Log cleanup job registered (every 24h)");
}

export function stopLogCleanup(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
