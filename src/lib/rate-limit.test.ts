import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMITS,
  __resetRateLimits,
  rateLimit,
  rateLimitHeaders,
  subjectFromRequest,
} from "./rate-limit";

beforeEach(() => {
  __resetRateLimits();
});

describe("budgets", () => {
  it("allows exactly the configured number of requests", async () => {
    const limit = RATE_LIMITS["roster:import"].limit;

    for (let i = 0; i < limit; i++) {
      const r = await rateLimit("roster:import", "user-a");
      expect(r.ok, `request ${i + 1} of ${limit}`).toBe(true);
    }

    const overflow = await rateLimit("roster:import", "user-a");
    expect(overflow.ok).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it("counts each subject separately", async () => {
    const limit = RATE_LIMITS["roster:import"].limit;
    for (let i = 0; i < limit; i++) await rateLimit("roster:import", "user-a");

    // One student exhausting their budget must not lock out the next one.
    const other = await rateLimit("roster:import", "user-b");
    expect(other.ok).toBe(true);
  });

  it("counts each action separately", async () => {
    const limit = RATE_LIMITS["roster:import"].limit;
    for (let i = 0; i < limit; i++) await rateLimit("roster:import", "user-a");

    const different = await rateLimit("vote:toggle", "user-a");
    expect(different.ok).toBe(true);
  });

  it("falls back to the default rule for an unknown action", async () => {
    // @ts-expect-error deliberately passing an action with no configured rule
    const r = await rateLimit("does:not:exist", "user-a");
    expect(r.limit).toBe(RATE_LIMITS.default.limit);
  });

  it("reports a remaining count that falls to zero and stops there", async () => {
    const limit = RATE_LIMITS["roster:import"].limit;
    const seen: number[] = [];
    for (let i = 0; i < limit + 3; i++) {
      seen.push((await rateLimit("roster:import", "user-a")).remaining);
    }
    expect(seen[0]).toBe(limit - 1);
    expect(seen.at(-1)).toBe(0);
    expect(seen.every((n) => n >= 0)).toBe(true);
  });
});

describe("budget shape", () => {
  it("gives every action a positive limit and window", () => {
    for (const [action, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, action).toBeGreaterThan(0);
      expect(rule.windowSeconds, action).toBeGreaterThan(0);
    }
  });

  it("keeps registration tighter than ordinary writes", () => {
    // Unbounded registration is how an allowlisted domain gets enumerated, so
    // it must never drift up to the default budget.
    expect(RATE_LIMITS["auth:register"].limit).toBeLessThan(RATE_LIMITS.default.limit);
    expect(RATE_LIMITS["auth:request-access"].limit).toBeLessThan(RATE_LIMITS.default.limit);
  });

  it("keeps roster import the tightest write of all", () => {
    // Importing a roster creates accounts. It is the highest-leverage write in
    // the system and should never be looser than posting a bounty.
    expect(RATE_LIMITS["roster:import"].limit).toBeLessThanOrEqual(
      RATE_LIMITS["bounty:create"].limit
    );
  });

  it("gives reviewers enough budget to clear a real backlog", () => {
    // A faculty member working through a semester of evidence must never be
    // throttled for doing the thing the product needs most.
    expect(RATE_LIMITS["review:decide"].limit).toBeGreaterThanOrEqual(200);
  });

  it("keeps sign-in tight, since it is a credential-stuffing surface", () => {
    expect(RATE_LIMITS["auth:signin"].limit).toBeLessThan(RATE_LIMITS.default.limit);
  });

  it("does not throttle reading notifications into uselessness", () => {
    // A limit a normal session can hit is a bug report, not a guardrail.
    expect(RATE_LIMITS["notification:read"].limit).toBeGreaterThanOrEqual(100);
  });
});

describe("headers", () => {
  it("omits Retry-After while the caller still has budget", async () => {
    const r = await rateLimit("vote:toggle", "user-a");
    const headers = rateLimitHeaders(r);
    expect(headers["RateLimit-Limit"]).toBe(String(RATE_LIMITS["vote:toggle"].limit));
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("sets Retry-After once the budget is gone", async () => {
    const limit = RATE_LIMITS["roster:import"].limit;
    for (let i = 0; i < limit; i++) await rateLimit("roster:import", "user-a");
    const denied = await rateLimit("roster:import", "user-a");

    const headers = rateLimitHeaders(denied);
    expect(headers["Retry-After"]).toBeDefined();
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});

describe("anonymous subjects", () => {
  const withHeaders = (h: Record<string, string>) => new Request("http://x/y", { headers: h });

  it("takes the first hop of x-forwarded-for", () => {
    // The chain is client, then each proxy. The client-most entry is the one
    // that identifies the caller.
    expect(subjectFromRequest(withHeaders({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "ip:203.0.113.5"
    );
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(subjectFromRequest(withHeaders({ "x-real-ip": "198.51.100.7" }))).toBe("ip:198.51.100.7");
    expect(subjectFromRequest(withHeaders({}))).toBe("ip:unknown");
  });

  it("never collides with a user-id subject", () => {
    // User subjects are bare ids. The prefix is what stops a caller who can
    // choose their forwarded-for from spending another user's budget.
    expect(subjectFromRequest(withHeaders({ "x-forwarded-for": "abc123" }))).toBe("ip:abc123");
  });
});
