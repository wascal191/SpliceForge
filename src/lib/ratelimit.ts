/**
 * Minimal in-memory token-bucket rate limiter.
 *
 * For production, replace the in-memory map with a shared store (Upstash
 * Redis, Vercel KV, etc.) so limits hold across serverless instances.
 * This implementation still provides per-instance protection against
 * brute-force / scrape patterns at zero infra cost.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;

export function rateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const refillRate = limit / windowMs;
  const b = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  // Refill tokens proportional to elapsed time, capped at `limit`.
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

export function rateLimitOrThrow(key: string, limit?: number, windowMs?: number): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new Error("Too many requests. Please try again shortly.");
}
