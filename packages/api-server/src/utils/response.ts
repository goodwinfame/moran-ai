/**
 * Unified response helpers for Hono routes.
 *
 * All API responses follow: { ok: boolean, data?: T, error?: { code, message } }
 */
import type { Context } from "hono";

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ ok: true as const, data }, status);
}

export function fail(c: Context, code: string, message: string, status: 400 | 401 | 403 | 404 | 500 = 400) {
  return c.json({ ok: false as const, error: { code, message } }, status);
}

export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { total: number; page: number; pageSize: number; hasMore: boolean },
) {
  return c.json({ ok: true as const, data, pagination });
}
