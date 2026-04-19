import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { usageRecords } from "../db/schema/usage.js";
import type { ServiceResult } from "./types.js";
import { calculateCost } from "./cost.config.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RecordUsageInput {
  projectId: string;
  userId: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface UsageSummary {
  totalTokens: number;
  totalCostUsd: number;
  byAgent: Record<string, { tokens: number; cost: number }>;
  byModel: Record<string, { tokens: number; cost: number }>;
  dailyTrend: Array<{ date: string; tokens: number; cost: number }>;
}

export type UsageRecord = typeof usageRecords.$inferSelect;

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildConditions(projectId: string, from?: string, to?: string) {
  const conditions = [eq(usageRecords.projectId, projectId)];
  if (from) conditions.push(gte(usageRecords.createdAt, new Date(from)));
  if (to) conditions.push(lte(usageRecords.createdAt, new Date(to)));
  return conditions;
}

// ── Service Methods ────────────────────────────────────────────────────────────

/**
 * Record a single LLM usage event.
 * Calculates estimatedCostUsd from model pricing before inserting.
 */
export async function recordUsage(
  data: RecordUsageInput,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const totalTokens = data.promptTokens + data.completionTokens;
  const estimatedCostUsd = calculateCost(
    data.model,
    data.promptTokens,
    data.completionTokens,
  ).toFixed(8);

  const rows = await db
    .insert(usageRecords)
    .values({
      projectId: data.projectId,
      userId: data.userId,
      sessionId: data.sessionId,
      agentName: data.agentName,
      toolName: data.toolName,
      model: data.model,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens,
      estimatedCostUsd,
    })
    .returning({ id: usageRecords.id });

  const row = rows[0];
  if (!row) return { ok: false, error: { code: "INSERT_FAILED", message: "用量记录创建失败" } };
  return { ok: true, data: { id: row.id } };
}

/**
 * Get aggregated usage summary for a project, with optional date range.
 */
export async function getSummary(params: {
  projectId: string;
  from?: string;
  to?: string;
}): Promise<ServiceResult<UsageSummary>> {
  const db = getDb();
  const conditions = buildConditions(params.projectId, params.from, params.to);
  const whereClause = and(...conditions);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const [totalsRow] = await db
    .select({
      totalTokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}), 0)::int`,
      totalCostUsd: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::text`,
    })
    .from(usageRecords)
    .where(whereClause);

  // ── By Agent ───────────────────────────────────────────────────────────────
  const agentRows = await db
    .select({
      agentName: usageRecords.agentName,
      tokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}), 0)::int`,
      cost: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::text`,
    })
    .from(usageRecords)
    .where(whereClause)
    .groupBy(usageRecords.agentName);

  // ── By Model ───────────────────────────────────────────────────────────────
  const modelRows = await db
    .select({
      model: usageRecords.model,
      tokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}), 0)::int`,
      cost: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::text`,
    })
    .from(usageRecords)
    .where(whereClause)
    .groupBy(usageRecords.model);

  // ── Daily Trend ────────────────────────────────────────────────────────────
  const dailyRows = await db
    .select({
      date: sql<string>`date_trunc('day', ${usageRecords.createdAt})::date::text`,
      tokens: sql<number>`coalesce(sum(${usageRecords.totalTokens}), 0)::int`,
      cost: sql<string>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::text`,
    })
    .from(usageRecords)
    .where(whereClause)
    .groupBy(sql`date_trunc('day', ${usageRecords.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageRecords.createdAt})`);

  // ── Assemble Result ────────────────────────────────────────────────────────
  const byAgent: Record<string, { tokens: number; cost: number }> = {};
  for (const row of agentRows) {
    const key = row.agentName ?? "unknown";
    byAgent[key] = { tokens: row.tokens, cost: parseFloat(row.cost) };
  }

  const byModel: Record<string, { tokens: number; cost: number }> = {};
  for (const row of modelRows) {
    const key = row.model ?? "unknown";
    byModel[key] = { tokens: row.tokens, cost: parseFloat(row.cost) };
  }

  const dailyTrend = dailyRows.map((row) => ({
    date: row.date,
    tokens: row.tokens,
    cost: parseFloat(row.cost),
  }));

  return {
    ok: true,
    data: {
      totalTokens: totalsRow?.totalTokens ?? 0,
      totalCostUsd: parseFloat(totalsRow?.totalCostUsd ?? "0"),
      byAgent,
      byModel,
      dailyTrend,
    },
  };
}

/**
 * Get paginated usage detail records for a project.
 */
export async function getDetails(params: {
  projectId: string;
  limit?: number;
  offset?: number;
  agentName?: string;
  model?: string;
}): Promise<ServiceResult<{ records: UsageRecord[]; total: number }>> {
  const db = getDb();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const conditions = buildConditions(params.projectId);
  if (params.agentName) conditions.push(eq(usageRecords.agentName, params.agentName));
  if (params.model) conditions.push(eq(usageRecords.model, params.model));
  const whereClause = and(...conditions);

  // ── Count ──────────────────────────────────────────────────────────────────
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageRecords)
    .where(whereClause);

  const total = countRow?.count ?? 0;

  // ── Records ────────────────────────────────────────────────────────────────
  const records = await db
    .select()
    .from(usageRecords)
    .where(whereClause)
    .orderBy(desc(usageRecords.createdAt))
    .limit(limit)
    .offset(offset);

  return { ok: true, data: { records, total } };
}
