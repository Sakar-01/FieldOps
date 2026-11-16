import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isProduction } from "@/lib/env";
import { AppError } from "./errors";
import { logger } from "./logger";

const LIMITS = {
  login: [5, "1 m"],
  uploadSign: [30, "1 m"],
  write: [120, "1 m"],
} as const;

const WINDOW_MS = 60_000; // every limit above is per minute

export type RateLimitKind = keyof typeof LIMITS;

const limiters = new Map<RateLimitKind, Ratelimit>();

function getLimiter(kind: RateLimitKind): Ratelimit | null {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  // Without Upstash: no-op in dev and tests, an in-memory limiter in production.
  if (!url || !token) return null;

  let limiter = limiters.get(kind);
  if (!limiter) {
    const [count, window] = LIMITS[kind];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(count, window),
      prefix: `fieldops:rl:${kind}`,
    });
    limiters.set(kind, limiter);
  }
  return limiter;
}

/**
 * Fallback when Upstash isn't configured in production. Fixed one-minute windows per server
 * instance: fine for a single Render instance, weaker on Vercel where instances don't share it.
 */
const memoryHits = new Map<string, { count: number; resetAt: number }>();

export function memoryLimit(kind: RateLimitKind, key: string, now = Date.now()): boolean {
  if (memoryHits.size > 10_000) {
    for (const [k, v] of memoryHits) if (v.resetAt <= now) memoryHits.delete(k);
  }
  const id = `${kind}:${key}`;
  const entry = memoryHits.get(id);
  if (!entry || entry.resetAt <= now) {
    memoryHits.set(id, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMITS[kind][0];
}

const tooMany = () =>
  new AppError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");

export async function enforceRateLimit(kind: RateLimitKind, key: string): Promise<void> {
  const limiter = getLimiter(kind);
  if (!limiter) {
    if (isProduction() && !memoryLimit(kind, key)) throw tooMany();
    return;
  }

  let success: boolean;
  try {
    ({ success } = await limiter.limit(key));
  } catch (error) {
    // A Redis outage should not lock everyone out of the app: fail open and log it.
    logger.error("rate_limit_unavailable", { kind, error: String(error) });
    return;
  }
  if (!success) throw tooMany();
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
