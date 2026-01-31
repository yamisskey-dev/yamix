import { afterEach, vi } from "vitest";

// @ts-expect-error -- NODE_ENV is readonly in @types/node but writable at runtime
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-for-vitest";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.WEB_URL = "http://localhost:3000";

afterEach(() => {
  vi.clearAllMocks();
});
