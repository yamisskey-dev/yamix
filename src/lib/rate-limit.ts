/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based solution like @upstash/ratelimit
 */

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

// In-memory store: key -> RequestRecord
const store = new Map<string, RequestRecord>();

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}, 60000);

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier (e.g., userId, IP address)
 * @param config - Rate limit configuration
 * @returns true if rate limit exceeded, false otherwise
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return false;
  }

  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return true;
  }

  // Increment count
  record.count++;
  store.set(key, record);
  return false;
}

/**
 * Get remaining requests and reset time
 */
export function getRateLimitInfo(key: string, config: RateLimitConfig): {
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    return {
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  // Authentication endpoints: 5 requests per minute
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  // Chat creation: 10 sessions per hour
  CHAT_CREATE: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
  },
  // Message sending: 30 messages per minute
  MESSAGE_SEND: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  // Gas tipping: 20 tips per hour
  GAS_TIP: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  },
  // Token purchase: 5 per hour
  TOKEN_PURCHASE: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  },
  // General API: 100 requests per minute
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
} as const;
