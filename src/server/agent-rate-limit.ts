/**
 * Rate limiter. Uses Redis (via REDIS_URL) when available for multi-instance
 * deployments. Falls back to an in-process fixed-window store for local/single
 * node use.
 */

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------
type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();
let pruneCounter = 0;

function pruneStale(now: number, maxAgeMs: number) {
  for (const [k, b] of buckets) {
    if (now - b.windowStart > maxAgeMs) buckets.delete(k);
  }
}

function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  if (++pruneCounter % 200 === 0) pruneStale(now, windowMs * 2);
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (b.count < limit) {
    b.count++;
    return { ok: true };
  }
  return { ok: false, retryAfterMs: windowMs - (now - b.windowStart) };
}

// ---------------------------------------------------------------------------
// Redis adapter (loaded lazily; no import at module level so the module stays
// usable in environments without ioredis installed)
// ---------------------------------------------------------------------------
async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  try {
    // Dynamic import so the module compiles without ioredis installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: Redis } = await import("ioredis" as any);
    const redis = new Redis(process.env.REDIS_URL!);
    const windowSec = Math.ceil(windowMs / 1000);
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSec);

    if (current <= limit) {
      await redis.quit();
      return { ok: true };
    }

    // Read TTL *before* closing the connection (fixes quit-before-read bug).
    const ttl = await redis.ttl(key);
    await redis.quit();
    return { ok: false, retryAfterMs: Math.max(1, ttl) * 1000 };
  } catch (err) {
    // RLY-04: If Redis is configured but unavailable, fail strictly closed
    // rather than bypassing multi-instance limits silently via in-memory array.
    console.error("[RateLimit] Redis unavailable:", err);
    throw new Error("Distributed rate limiter is unavailable. Safely failing closed.");
  }
}

/** Public client IP for rate limiting (best-effort behind proxies). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

/**
 * Check rate limit. Uses Redis when `REDIS_URL` is set, in-memory otherwise.
 * Returns a Promise so callers must await it even in the in-memory path.
 */
export function rateLimitAllow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  if (process.env.REDIS_URL?.trim()) {
    return rateLimitRedis(key, limit, windowMs);
  }
  return Promise.resolve(rateLimitInMemory(key, limit, windowMs));
}

