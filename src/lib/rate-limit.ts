import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Rate limiting for mutation routes.
 *
 * Every authenticated user could previously hammer any mutation endpoint as
 * fast as they could issue requests. On a system that awards points and
 * allocates seats that is not merely a load concern — it is the cheapest way
 * to probe for a race in the allocation or ledger paths.
 *
 * Two backends behind one interface:
 *   - Redis, when REDIS_URL is set. Correct across multiple instances, which
 *     is the only thing that actually counts in production.
 *   - An in-process fixed window otherwise, so local development and the
 *     single-instance pilot are still protected.
 *
 * The in-memory store is honest about its limitation: it is per-process, so
 * two instances behind a load balancer each allow the full budget. That is
 * stated here rather than discovered later.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  resetSeconds: number;
  limit: number;
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Per-action budgets.
 *
 * Writes that move the ledger or consume a scarce seat are tightest. Reads are
 * not limited here at all: throttling a student refreshing a feed buys nothing
 * and breaks the product on a flaky campus connection.
 */
export const RATE_LIMITS = {
  "auth:register": { limit: 5, windowSeconds: 3600 },
  "auth:signin": { limit: 10, windowSeconds: 900 },
  "evidence:submit": { limit: 30, windowSeconds: 3600 },
  "review:decide": { limit: 200, windowSeconds: 3600 },
  "bounty:create": { limit: 20, windowSeconds: 3600 },
  "bounty:submit": { limit: 20, windowSeconds: 3600 },
  "project:create": { limit: 15, windowSeconds: 3600 },
  "event:register": { limit: 40, windowSeconds: 3600 },
  "event:vote": { limit: 60, windowSeconds: 3600 },
  "message:send": { limit: 120, windowSeconds: 300 },
  "vote:toggle": { limit: 100, windowSeconds: 3600 },
  "roster:import": { limit: 5, windowSeconds: 3600 },
  "auth:request-access": { limit: 5, windowSeconds: 3600 },
  "project:update": { limit: 60, windowSeconds: 3600 },
  "project:join": { limit: 30, windowSeconds: 3600 },
  "bounty:update": { limit: 60, windowSeconds: 3600 },
  "event:create": { limit: 20, windowSeconds: 3600 },
  "event:allocate": { limit: 200, windowSeconds: 3600 },
  "membership:decide": { limit: 200, windowSeconds: 3600 },
  "community:join": { limit: 40, windowSeconds: 3600 },
  "notification:read": { limit: 300, windowSeconds: 3600 },
  "user:onboard": { limit: 10, windowSeconds: 3600 },
  "post:create": { limit: 30, windowSeconds: 3600 },
  default: { limit: 60, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

interface Bucket {
  count: number;
  resetAt: number;
}

const memory = new Map<string, Bucket>();

/** Keeps the in-process map from growing without bound on a long-lived server. */
function sweep(now: number) {
  if (memory.size < 5000) return;
  for (const [key, bucket] of memory) {
    if (bucket.resetAt <= now) memory.delete(key);
  }
}

function memoryLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = memory.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000;
    memory.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: rule.limit - 1,
      resetSeconds: rule.windowSeconds,
      limit: rule.limit,
    };
  }

  existing.count += 1;
  const resetSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);

  return {
    ok: existing.count <= rule.limit,
    remaining: Math.max(rule.limit - existing.count, 0),
    resetSeconds,
    limit: rule.limit,
  };
}

/**
 * Redis backend, loaded lazily so the dependency is optional and the module
 * stays importable on the edge runtime.
 */
type RedisLike = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

let redisPromise: Promise<RedisLike | null> | null = null;

async function getRedis(): Promise<RedisLike | null> {
  if (!process.env.REDIS_URL) return null;

  redisPromise ??= (async () => {
    try {
      const { default: Redis } = await import("ioredis");
      return new Redis(process.env.REDIS_URL!) as unknown as RedisLike;
    } catch (error) {
      // A missing or unreachable Redis must not take the app down; it falls
      // back to the in-process limiter and says so once.
      logger.warn("Redis unavailable, rate limiting falls back to in-process", {
        error: String(error),
      });
      return null;
    }
  })();

  return redisPromise;
}

async function redisLimit(
  redis: RedisLike,
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, rule.windowSeconds);

  const ttl = await redis.ttl(key);
  return {
    ok: count <= rule.limit,
    remaining: Math.max(rule.limit - count, 0),
    resetSeconds: ttl > 0 ? ttl : rule.windowSeconds,
    limit: rule.limit,
  };
}

/**
 * Consume one unit of budget.
 *
 * `subject` should be a user id where the caller is authenticated, and an IP
 * only for anonymous routes — limiting authenticated traffic by IP would
 * throttle an entire computer lab sharing one address.
 */
export async function rateLimit(
  action: RateLimitAction,
  subject: string
): Promise<RateLimitResult> {
  const rule: RateLimitRule = RATE_LIMITS[action] ?? RATE_LIMITS.default;
  const key = `rl:${action}:${subject}`;

  const redis = await getRedis();
  if (!redis) return memoryLimit(key, rule);

  try {
    return await redisLimit(redis, key, rule);
  } catch (error) {
    logger.warn("Rate limit check failed, allowing request", { error: String(error) });
    // Fail open rather than locking every student out of a working app when
    // the limiter itself breaks. The limiter is a guardrail, not the auth gate.
    return { ok: true, remaining: rule.limit, resetSeconds: rule.windowSeconds, limit: rule.limit };
  }
}

/**
 * A rate-limit subject for routes with no authenticated user.
 *
 * Only for genuinely anonymous endpoints — registration and access requests.
 * Using an IP for authenticated traffic would throttle a whole computer lab
 * behind one address, which on a campus is the normal case rather than an
 * edge case.
 *
 * `x-forwarded-for` is client-controlled unless a trusted proxy overwrites it.
 * That is acceptable for a guardrail whose worst failure is an attacker
 * getting a fresh budget; it would not be acceptable for authorization.
 */
export function subjectFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/** Standard headers so a client can back off rather than retry blindly. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetSeconds),
    ...(result.ok ? {} : { "Retry-After": String(result.resetSeconds) }),
  };
}

/**
 * Consume budget and, when exhausted, produce the 429 for the caller to
 * return directly.
 *
 * Returning a response rather than throwing keeps the guard visible at the top
 * of each handler: a reader sees the budget being spent in the same place they
 * see the auth check, which is the point at which it is easy to notice one is
 * missing.
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  subject: string,
  message: string
): Promise<NextResponse | null> {
  const result = await rateLimit(action, subject);
  if (result.ok) return null;

  return NextResponse.json(
    { error: message },
    { status: 429, headers: rateLimitHeaders(result) }
  );
}

/** For tests: clears the in-process buckets. */
export function __resetRateLimits() {
  memory.clear();
}
