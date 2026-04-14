/**
 * 测试全局 setup
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://moran:test_password@localhost:5433/moran_test";
