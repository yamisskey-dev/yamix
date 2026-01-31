import { describe, it, expect, vi, beforeEach } from "vitest";

// rate-limit.ts has a setInterval side effect, so we need fake timers before import
vi.useFakeTimers();

// Dynamic import after fake timers are set
const { checkRateLimit, getRateLimitInfo, RateLimits } = await import("./rate-limit");

const config = { maxRequests: 3, windowMs: 60000 };

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  it("allows first request", () => {
    expect(checkRateLimit("test-a", config)).toBe(false);
  });

  it("allows requests up to max", () => {
    expect(checkRateLimit("test-b", config)).toBe(false);
    expect(checkRateLimit("test-b", config)).toBe(false);
    expect(checkRateLimit("test-b", config)).toBe(false);
  });

  it("blocks after max requests", () => {
    checkRateLimit("test-c", config);
    checkRateLimit("test-c", config);
    checkRateLimit("test-c", config);
    expect(checkRateLimit("test-c", config)).toBe(true);
  });

  it("resets after window expires", () => {
    checkRateLimit("test-d", config);
    checkRateLimit("test-d", config);
    checkRateLimit("test-d", config);
    expect(checkRateLimit("test-d", config)).toBe(true);

    vi.advanceTimersByTime(60001);
    expect(checkRateLimit("test-d", config)).toBe(false);
  });

  it("isolates different keys", () => {
    checkRateLimit("key-1", config);
    checkRateLimit("key-1", config);
    checkRateLimit("key-1", config);
    expect(checkRateLimit("key-1", config)).toBe(true);
    expect(checkRateLimit("key-2", config)).toBe(false);
  });
});

describe("getRateLimitInfo", () => {
  it("returns full remaining for new key", () => {
    const info = getRateLimitInfo("info-new", config);
    expect(info.remaining).toBe(3);
  });

  it("decrements remaining after requests", () => {
    checkRateLimit("info-used", config);
    checkRateLimit("info-used", config);
    const info = getRateLimitInfo("info-used", config);
    expect(info.remaining).toBe(1);
  });

  it("returns 0 remaining when exhausted", () => {
    checkRateLimit("info-full", config);
    checkRateLimit("info-full", config);
    checkRateLimit("info-full", config);
    const info = getRateLimitInfo("info-full", config);
    expect(info.remaining).toBe(0);
  });
});

describe("RateLimits presets", () => {
  it("has expected configs", () => {
    expect(RateLimits.AUTH.maxRequests).toBe(5);
    expect(RateLimits.MESSAGE_SEND.maxRequests).toBe(30);
    expect(RateLimits.GENERAL.maxRequests).toBe(100);
  });
});
