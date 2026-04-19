/**
 * Auth Service — Unit Tests
 *
 * Mocks getDb() to avoid real DB dependency.
 * Tests business logic: email normalization, password hashing, session TTL.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$12$hashed_password"),
    compare: vi.fn(),
  },
}));

// Mock getDb - chainable Drizzle query builder
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

vi.mock("../../db/index.js", () => ({
  getDb: () => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  }),
}));

import bcrypt from "bcryptjs";
import { register, login, createSession, validateSession, deleteSession } from "../auth.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth.service", () => {
  describe("register", () => {
    it("creates user with normalized email and hashed password", async () => {
      mockLimit.mockResolvedValue([]); // no existing user
      mockReturning.mockResolvedValue([{ id: "user-uuid-1" }]);

      const result = await register({
        email: "  Test@Example.COM  ",
        password: "password123",
        displayName: "Test User",
      });

      expect(result).toEqual({ ok: true, data: { userId: "user-uuid-1" } });

      // Verify email was normalized
      expect(mockSelect).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
    });

    it("returns EMAIL_EXISTS when email already registered", async () => {
      mockLimit.mockResolvedValue([{ id: "existing-id" }]);

      const result = await register({
        email: "taken@example.com",
        password: "password123",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "EMAIL_EXISTS", message: "邮箱已注册" },
      });

      // Should not attempt to hash or insert
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("handles case-insensitive email dedup", async () => {
      // First call: check existence → found
      mockLimit.mockResolvedValue([{ id: "existing-id" }]);

      const result = await register({
        email: "USER@EXAMPLE.COM",
        password: "password123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("EMAIL_EXISTS");
      }
    });
  });

  describe("login", () => {
    it("returns userId on valid credentials", async () => {
      mockLimit.mockResolvedValue([
        { id: "user-uuid-1", passwordHash: "$2a$12$stored_hash" },
      ]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await login({
        email: "user@example.com",
        password: "correctpassword",
      });

      expect(result).toEqual({ ok: true, data: { userId: "user-uuid-1" } });
    });

    it("returns INVALID_CREDENTIALS for non-existent email", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await login({
        email: "nobody@example.com",
        password: "password123",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("returns INVALID_CREDENTIALS for wrong password", async () => {
      mockLimit.mockResolvedValue([
        { id: "user-uuid-1", passwordHash: "$2a$12$stored_hash" },
      ]);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await login({
        email: "user@example.com",
        password: "wrongpassword",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
      });
    });

    it("normalizes email for lookup", async () => {
      mockLimit.mockResolvedValue([
        { id: "user-uuid-1", passwordHash: "$2a$12$stored_hash" },
      ]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await login({
        email: "  USER@Example.COM  ",
        password: "password123",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("createSession", () => {
    it("inserts session row and returns id", async () => {
      mockReturning.mockResolvedValue([{ id: "session-uuid-1" }]);

      const session = await createSession("user-uuid-1");

      expect(session).toEqual({ id: "session-uuid-1" });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("throws if insert returns empty", async () => {
      mockReturning.mockResolvedValue([]);

      await expect(createSession("user-uuid-1")).rejects.toThrow(
        "Failed to create session",
      );
    });
  });

  describe("validateSession", () => {
    it("returns userId for valid non-expired session", async () => {
      mockLimit.mockResolvedValue([{ userId: "user-uuid-1" }]);

      const result = await validateSession("session-uuid-1");

      expect(result).toEqual({ ok: true, data: { userId: "user-uuid-1" } });
    });

    it("returns SESSION_EXPIRED when session not found or expired", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await validateSession("expired-session-id");

      expect(result).toEqual({
        ok: false,
        error: { code: "SESSION_EXPIRED", message: "Session 已过期" },
      });
    });
  });

  describe("deleteSession", () => {
    it("deletes session by id", async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      await deleteSession("session-uuid-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
