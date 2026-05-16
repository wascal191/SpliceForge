import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Ensure Upstash isn't picked up so we test the in-memory path.
beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit (in-memory)", () => {
  it("allows the first N requests and rejects beyond", async () => {
    const mod = await import("@/lib/ratelimit");
    mod.__resetInMemoryBuckets();

    const key = "test-A";
    for (let i = 0; i < 3; i++) {
      const r = await mod.rateLimit(key, 3, 60_000);
      expect(r.ok).toBe(true);
    }
    const overflow = await mod.rateLimit(key, 3, 60_000);
    expect(overflow.ok).toBe(false);
    expect(overflow.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens over time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const mod = await import("@/lib/ratelimit");
    mod.__resetInMemoryBuckets();
    const key = "test-B";

    // Exhaust.
    for (let i = 0; i < 2; i++) await mod.rateLimit(key, 2, 1_000);
    expect((await mod.rateLimit(key, 2, 1_000)).ok).toBe(false);

    // Advance past the window.
    vi.advanceTimersByTime(1_500);
    expect((await mod.rateLimit(key, 2, 1_000)).ok).toBe(true);
  });

  it("rateLimitOrThrow throws on exhaustion", async () => {
    const mod = await import("@/lib/ratelimit");
    mod.__resetInMemoryBuckets();
    const key = "test-C";

    await mod.rateLimitOrThrow(key, 1, 60_000);
    await expect(mod.rateLimitOrThrow(key, 1, 60_000)).rejects.toThrow(
      /Too many/
    );
  });
});
