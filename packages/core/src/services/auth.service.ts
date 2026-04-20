import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { users, sessions } from "../db/schema/auth.js";
import type { ServiceResult } from "./types.js";

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<ServiceResult<{ userId: string }>> {
  const db = getDb();
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, error: { code: "EMAIL_EXISTS", message: "邮箱已注册" } };
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const rows = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName,
    })
    .returning({ id: users.id });

  const user = rows[0];
  if (!user) {
    return { ok: false, error: { code: "INSERT_FAILED", message: "用户创建失败" } };
  }

  return { ok: true, data: { userId: user.id } };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<ServiceResult<{ userId: string }>> {
  const db = getDb();
  const normalizedEmail = input.email.toLowerCase().trim();

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    return { ok: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } };
  }

  return { ok: true, data: { userId: user.id } };
}

export async function createSession(userId: string): Promise<{ id: string }> {
  const db = getDb();
  const rows = await db
    .insert(sessions)
    .values({
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning({ id: sessions.id });

  const session = rows[0];
  if (!session) {
    throw new Error("Failed to create session");
  }

  return session;
}

export async function validateSession(
  sessionId: string,
): Promise<ServiceResult<{ userId: string }>> {
  const db = getDb();
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) {
    return { ok: false, error: { code: "SESSION_EXPIRED", message: "Session 已过期" } };
  }

  return { ok: true, data: { userId: session.userId } };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getUser(
  userId: string,
): Promise<ServiceResult<{ id: string; email: string; displayName: string | null; createdAt: Date }>> {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { ok: false, error: { code: "NOT_FOUND", message: "用户不存在" } };
  }
  return { ok: true, data: user };
}

export async function updateUser(
  userId: string,
  data: { displayName?: string },
): Promise<ServiceResult<{ id: string; email: string; displayName: string | null; updatedAt: Date }>> {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    return { ok: false, error: { code: "NOT_FOUND", message: "用户不存在" } };
  }
  return { ok: true, data: updated };
}
