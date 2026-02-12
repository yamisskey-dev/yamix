import Redis from "ioredis";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  memoryCache: Map<string, { value: string; expiresAt: number }>;
  redisAvailable: boolean;
};

// In-memory cache fallback
if (!globalForRedis.memoryCache) {
  globalForRedis.memoryCache = new Map();
}

function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn("REDIS_URL not set, using in-memory cache");
    globalForRedis.redisAvailable = false;
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) {
          logger.warn("Redis connection failed, falling back to in-memory cache");
          globalForRedis.redisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 50, 1000);
      },
      lazyConnect: true,
    });

    client.on("error", (err) => {
      logger.warn("Redis error", { detail: err.message });
      globalForRedis.redisAvailable = false;
    });

    client.on("connect", () => {
      globalForRedis.redisAvailable = true;
    });

    return client;
  } catch {
    logger.warn("Failed to create Redis client, using in-memory cache");
    globalForRedis.redisAvailable = false;
    return null;
  }
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis;
}

// Clean up expired entries periodically
function cleanupMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of globalForRedis.memoryCache.entries()) {
    if (entry.expiresAt < now) {
      globalForRedis.memoryCache.delete(key);
    }
  }
}

// Run cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(cleanupMemoryCache, 60000);
}

export class RedisService {
  static getRedis(): Redis | null {
    return redis;
  }

  static isAvailable(): boolean {
    return globalForRedis.redisAvailable === true;
  }

  static async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    // Try Redis first
    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.setex(key, ttlSeconds, value);
        return;
      } catch (err) {
        logger.warn("Redis setex failed, using memory cache", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }

    // Fallback to memory cache
    globalForRedis.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  static async get(key: string): Promise<string | null> {
    // Try Redis first
    if (redis && globalForRedis.redisAvailable) {
      try {
        return await redis.get(key);
      } catch (err) {
        logger.warn("Redis get failed, using memory cache", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }

    // Fallback to memory cache
    const entry = globalForRedis.memoryCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        return entry.value;
      }
      globalForRedis.memoryCache.delete(key);
    }
    return null;
  }

  static async delete(key: string): Promise<void> {
    // Try Redis first
    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.del(key);
      } catch (err) {
        logger.warn("Redis del failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }

    // Also delete from memory cache
    globalForRedis.memoryCache.delete(key);
  }

  // Alias for compatibility
  static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      return this.setWithExpiry(key, value, ttlSeconds);
    }

    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.set(key, value);
        return;
      } catch (err) {
        logger.warn("Redis set failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }

    globalForRedis.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + 86400 * 1000, // Default 24h
    });
  }

  // Sorted set operations for rate limiting
  static async zadd(key: string, score: number, member: string): Promise<void> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.zadd(key, score, member);
        return;
      } catch (err) {
        logger.warn("Redis zadd failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
    // In-memory fallback: not ideal for rate limiting, but better than nothing
  }

  static async zcard(key: string): Promise<number> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        return await redis.zcard(key);
      } catch (err) {
        logger.warn("Redis zcard failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
    return 0;
  }

  static async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.zremrangebyscore(key, min, max);
        return;
      } catch (err) {
        logger.warn("Redis zremrangebyscore failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
  }

  static async zrange(key: string, start: number, stop: number): Promise<string[]> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        return await redis.zrange(key, start, stop);
      } catch (err) {
        logger.warn("Redis zrange failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
    return [];
  }

  static async expire(key: string, seconds: number): Promise<void> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        await redis.expire(key, seconds);
        return;
      } catch (err) {
        logger.warn("Redis expire failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
  }

  static async ttl(key: string): Promise<number> {
    if (redis && globalForRedis.redisAvailable) {
      try {
        return await redis.ttl(key);
      } catch (err) {
        logger.warn("Redis ttl failed", {}, err);
        globalForRedis.redisAvailable = false;
      }
    }
    return -1;
  }
}
