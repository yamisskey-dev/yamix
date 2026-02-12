/**
 * Redis-based distributed rate limiter
 *
 * SECURITY: Production-grade rate limiting with Redis backend
 * - Works across multiple server instances
 * - Persists across server restarts
 * - Sliding window algorithm
 * - IP-based and user-based rate limiting
 */

import { RedisService } from "@/lib/redis";
import { logger } from "@/lib/logger";

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Block duration after exceeding limit (optional)
   */
  blockDurationMs?: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  blocked?: boolean;
}

/**
 * Check rate limit using Redis (sliding window algorithm)
 *
 * @param key - Unique identifier (e.g., "user:123", "ip:1.2.3.4")
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `ratelimit:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  try {
    // Check if IP/user is blocked
    if (config.blockDurationMs) {
      const blocked = await RedisService.get(blockKey);
      if (blocked) {
        const ttl = await RedisService.ttl(blockKey);
        return {
          success: false,
          limit: config.maxRequests,
          remaining: 0,
          reset: now + (ttl * 1000),
          blocked: true,
        };
      }
    }

    // Sliding window: remove old entries
    await RedisService.zremrangebyscore(redisKey, 0, windowStart);

    // Count requests in current window
    const count = await RedisService.zcard(redisKey);

    if (count >= config.maxRequests) {
      // Rate limit exceeded
      if (config.blockDurationMs) {
        // Block for specified duration
        await RedisService.set(
          blockKey,
          "blocked",
          Math.floor(config.blockDurationMs / 1000)
        );
      }

      // Get oldest entry to calculate reset time
      const oldest = await RedisService.zrange(redisKey, 0, 0);
      const resetTime = oldest.length > 0
        ? parseInt(oldest[0]) + config.windowMs
        : now + config.windowMs;

      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: resetTime,
      };
    }

    // Add current request
    await RedisService.zadd(redisKey, now, `${now}-${Math.random()}`);

    // Set expiration on the key
    await RedisService.expire(redisKey, Math.ceil(config.windowMs / 1000));

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - count - 1,
      reset: now + config.windowMs,
    };
  } catch (error) {
    logger.error("Redis rate limit error", { key }, error);
    // Fallback: allow request on Redis failure (fail-open)
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.windowMs,
    };
  }
}

/**
 * Get rate limit info without incrementing
 */
export async function getRateLimitInfo(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `ratelimit:${key}`;

  try {
    // Remove old entries
    await RedisService.zremrangebyscore(redisKey, 0, windowStart);

    // Count requests
    const count = await RedisService.zcard(redisKey);

    return {
      success: count < config.maxRequests,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      reset: now + config.windowMs,
    };
  } catch (error) {
    logger.error("Get rate limit info error", { key }, error);
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.windowMs,
    };
  }
}

/**
 * Reset rate limit for a key
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redisKey = `ratelimit:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  try {
    await Promise.all([
      RedisService.delete(redisKey),
      RedisService.delete(blockKey),
    ]);
  } catch (error) {
    logger.error("Reset rate limit error", { key }, error);
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  // Authentication endpoints: 5 requests per minute, block for 5 minutes after
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
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
  // Aggressive rate limit for suspicious activity
  SUSPICIOUS: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
} as const;

/**
 * Get client IP address from request
 */
export function getClientIP(req: Request): string {
  // Check common headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}

/**
 * Combined rate limiting: both IP and user-based
 */
export async function checkCombinedRateLimit(
  req: Request,
  userId: string | null,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ip = getClientIP(req);

  // Check IP-based rate limit
  const ipKey = `ip:${ip}`;
  const ipResult = await checkRateLimitRedis(ipKey, {
    ...config,
    maxRequests: config.maxRequests * 2, // More lenient for IP
  });

  if (!ipResult.success) {
    return ipResult;
  }

  // Check user-based rate limit (if authenticated)
  if (userId) {
    const userKey = `user:${userId}`;
    return checkRateLimitRedis(userKey, config);
  }

  return ipResult;
}
