/**
 * Token-bucket rate limiter with two backends:
 *  - Upstash Redis (production, distributed) when UPSTASH_REDIS_REST_URL and
 *    UPSTASH_REDIS_REST_TOKEN are set.
 *  - In-memory fallback (dev / preview / when Upstash isn't configured).
 *
 * The in-memory path is intentionally kept simple: it provides per-instance
 * protection only, which is fine for dev but useless across the multi-instance
 * serverless edge in production. Set the Upstash vars to get cross-instance
 * limits.
 *
 * Public API (`rateLimit`, `rateLimitOrThrow`) is unchanged; callers don't
 * need to know which backend is active.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateResult = { ok: boolean; retryAfterMs: number };

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;

// ─── Upstash backend ───────────────────────────────────────────────────────
type LimiterCacheKey = string; // `${limit}:${windowMs}`
const upstashLimiterCache = new Map<LimiterCacheKey, Ratelimit>();

function getUpstashClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashClient();
  if (!redis) return null;
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = upstashLimiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix: "spliceforge",
    });
    upstashLimiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

// ─── In-memory backend ─────────────────────────────────────────────────────
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();
  const refillRate = limit / windowMs;
  const b = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  const elapsed = Math.max(0, now - b.updatedAt);
  b.tokens = Math.min(limit, b.tokens + elapsed * refillRate);
  b.updatedAt = now;

  if (b.tokens < 1) {
    buckets.set(key, b);
    const retryAfterMs = Math.ceil((1 - b.tokens) / refillRate);
    return { ok: false, retryAfterMs };
  }

  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, retryAfterMs: 0 };
}

// Exported for tests only.
export function __resetInMemoryBuckets(): void {
  buckets.clear();
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<RateResult> {
  const upstash = getUpstashLimiter(limit, windowMs);
  if (upstash) {
    const r = await upstash.limit(key);
    return {
      ok: r.success,
      retryAfterMs: Math.max(0, r.reset - Date.now()),
    };
  }
  return inMemoryRateLimit(key, limit, windowMs);
}

export async function rateLimitOrThrow(
  key: string,
  limit?: number,
  windowMs?: number
): Promise<void> {
  const r = await rateLimit(key, limit, windowMs);
  if (!r.ok) throw new Error("Too many requests. Please try again shortly.");
}
