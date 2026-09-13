import { describe, expect, it } from "vitest";
import {
  COOLDOWN_MINUTES,
  NEWCOMER_THRESHOLD_POINTS,
  POINTS,
  SEASON_CAPS,
  idempotencyKey,
  isNewcomer,
  nextTier,
  tierFor,
} from "./rules";

/**
 * These rules decide who appears at the top of a leaderboard and, from phase 3,
 * who gets a seat. They are the rules a student is most likely to challenge, so
 * each test states the promise the product makes rather than just pinning a
 * number.
 */

describe("points", () => {
  it("rewards outcomes far above participation", () => {
    // The GitHub-graph failure is rewarding volume of activity. Shipping a
    // project must be worth more than any amount of individual evidence.
    expect(POINTS.PROJECT_SHIPPED).toBeGreaterThan(POINTS.EVIDENCE_VERIFIED * 10);
    expect(POINTS.PROJECT_SHIPPED).toBeGreaterThan(POINTS.PEER_REVIEW_COMPLETED * 10);
  });

  it("never awards points for a reversal or a bare manual adjustment", () => {
    // Both carry their own explicit amount at the call site and must not have
    // a default value that could be awarded by accident.
    expect(POINTS.ABUSE_REVERSAL).toBe(0);
    expect(POINTS.MANUAL_ADJUSTMENT).toBe(0);
  });
});

describe("season caps", () => {
  it("caps every automatic award type", () => {
    const uncapped = Object.entries(SEASON_CAPS)
      .filter(([, cap]) => cap === null)
      .map(([type]) => type);

    // Only the two that require a named human may be uncapped.
    expect(uncapped.sort()).toEqual(["ABUSE_REVERSAL", "MANUAL_ADJUSTMENT"]);
  });

  it("stops volume alone from winning a season", () => {
    // Grinding the cheapest action to its cap must not beat shipping twice.
    const maxFromEvidence = SEASON_CAPS.EVIDENCE_VERIFIED!;
    expect(maxFromEvidence).toBeLessThan(POINTS.PROJECT_SHIPPED * 3);
  });

  it("allows a cap to be reached in a whole number of awards", () => {
    for (const [type, cap] of Object.entries(SEASON_CAPS)) {
      if (cap === null) continue;
      const per = POINTS[type as keyof typeof POINTS];
      if (per <= 0) continue;
      expect(cap % per, `${type} cap should be divisible by its award`).toBe(0);
    }
  });
});

describe("tierFor", () => {
  it("places points in the expected band", () => {
    expect(tierFor(0)).toBe("BRONZE");
    expect(tierFor(149)).toBe("BRONZE");
    expect(tierFor(150)).toBe("SILVER");
    expect(tierFor(350)).toBe("GOLD");
    expect(tierFor(600)).toBe("PLATINUM");
    expect(tierFor(900)).toBe("ELITE");
  });

  it("never returns undefined, including for negative balances", () => {
    // A balance can go negative after a reversal, and a profile must still render.
    expect(tierFor(-500)).toBe("BRONZE");
    expect(tierFor(Number.MAX_SAFE_INTEGER)).toBe("ELITE");
  });

  it("is monotonic — more points never means a lower tier", () => {
    const order = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "ELITE"];
    let last = 0;
    for (let p = 0; p <= 1000; p += 10) {
      const rank = order.indexOf(tierFor(p));
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });
});

describe("newcomer threshold", () => {
  it("treats a student with no verified work as a newcomer", () => {
    expect(isNewcomer(0)).toBe(true);
  });

  it("stops being true exactly at the threshold, not one either side", () => {
    expect(isNewcomer(NEWCOMER_THRESHOLD_POINTS - 1)).toBe(true);
    expect(isNewcomer(NEWCOMER_THRESHOLD_POINTS)).toBe(false);
  });

  it("aligns with the bottom tier boundary", () => {
    // A newcomer should be exactly the population still in BRONZE, otherwise
    // the reserved quota and the visible tier tell a student different stories.
    expect(tierFor(NEWCOMER_THRESHOLD_POINTS - 1)).toBe("BRONZE");
    expect(tierFor(NEWCOMER_THRESHOLD_POINTS)).not.toBe("BRONZE");
  });
});

describe("cooldowns", () => {
  it("only throttles the award types that can be produced in bursts", () => {
    expect(COOLDOWN_MINUTES.EVIDENCE_VERIFIED).toBeGreaterThan(0);
    // Shipping a project cannot be rushed, so throttling it would only punish.
    expect(COOLDOWN_MINUTES.PROJECT_SHIPPED).toBeUndefined();
  });
});

describe("idempotencyKey", () => {
  it("is stable for the same cause", () => {
    const a = idempotencyKey("EVIDENCE_VERIFIED", "evidence", "ev_1", "user_1");
    const b = idempotencyKey("EVIDENCE_VERIFIED", "evidence", "ev_1", "user_1");
    expect(a).toBe(b);
  });

  it("separates different users, causes and types", () => {
    const base = idempotencyKey("EVIDENCE_VERIFIED", "evidence", "ev_1", "user_1");
    expect(base).not.toBe(idempotencyKey("EVIDENCE_VERIFIED", "evidence", "ev_1", "user_2"));
    expect(base).not.toBe(idempotencyKey("EVIDENCE_VERIFIED", "evidence", "ev_2", "user_1"));
    expect(base).not.toBe(idempotencyKey("BOUNTY_COMPLETED", "evidence", "ev_1", "user_1"));
  });

  it("carries no timestamp, so replaying the same verification collides", () => {
    // This is the property that makes a double-click safe. If the key embedded
    // the moment of awarding, every retry would pay again.
    const key = idempotencyKey("BOUNTY_COMPLETED", "bounty_submission", "sub_1", "user_1");
    expect(key).toBe("BOUNTY_COMPLETED:bounty_submission:sub_1:user_1");
    expect(key).not.toMatch(/\d{10,}/);
  });
});

describe("nextTier", () => {
  it("names the tier immediately ahead and the gap to it", () => {
    expect(nextTier(0)).toEqual({ tier: "SILVER", at: 150, remaining: 150 });
    expect(nextTier(149)).toEqual({ tier: "SILVER", at: 150, remaining: 1 });
    expect(nextTier(150)).toEqual({ tier: "GOLD", at: 350, remaining: 200 });
  });

  it("agrees with tierFor at every boundary", () => {
    // A UI showing "40 points to Silver" beside a tier badge must never be
    // able to contradict the badge.
    for (const points of [0, 149, 150, 349, 350, 599, 600, 899, 900, 2000]) {
      const next = nextTier(points);
      if (next) expect(tierFor(next.at), `at ${next.at}`).toBe(next.tier);
      expect(next === null, `points ${points}`).toBe(tierFor(points) === "ELITE");
    }
  });

  it("returns null at the top rather than inventing a further goal", () => {
    expect(nextTier(900)).toBeNull();
    expect(nextTier(10_000)).toBeNull();
  });
});
