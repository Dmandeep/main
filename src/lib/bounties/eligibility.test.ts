import { describe, expect, it } from "vitest";
import { claimEligibility, type ClaimContext } from "./eligibility";

/**
 * Claim eligibility is the rule a student meets when they tap a bounty and
 * nothing happens. Every refusal must carry a reason a person can read, so
 * these tests assert the message as well as the boolean.
 */

const POSTER_ID = "user_poster";
const VIEWER_ID = "user_viewer";

type BountyShape = Pick<
  ClaimContext,
  "status" | "closesAt" | "maxClaims" | "reservedForNewcomers" | "posterId"
>;

function bounty(overrides: Partial<BountyShape> = {}): BountyShape {
  return {
    status: "OPEN",
    closesAt: null,
    maxClaims: 3,
    reservedForNewcomers: false,
    posterId: POSTER_ID,
    ...overrides,
  };
}

function check(b: BountyShape, opts: Partial<ClaimContext> = {}) {
  return claimEligibility({
    ...b,
    submissionCount: 0,
    viewerId: VIEWER_ID,
    viewerIsNewcomer: false,
    viewerHasSubmitted: false,
    ...opts,
  });
}

describe("claimEligibility", () => {
  it("lets an ordinary student claim an open bounty", () => {
    const r = check(bounty());
    expect(r.canClaim).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("refuses the poster their own bounty", () => {
    // Self-dealing is the cheapest route into the ledger once a bounty pays.
    const r = check(bounty(), { viewerId: POSTER_ID });
    expect(r.canClaim).toBe(false);
    expect(r.reason).toBe("own_bounty");
  });

  it("refuses a second submission from the same person", () => {
    const r = check(bounty(), { viewerHasSubmitted: true });
    expect(r.canClaim).toBe(false);
    expect(r.reason).toBe("already_submitted");
  });

  it("refuses when every place is taken", () => {
    const r = check(bounty({ maxClaims: 2 }), { submissionCount: 2 });
    expect(r.canClaim).toBe(false);
    expect(r.reason).toBe("full");
    expect(r.message).toContain("2");
  });

  it("refuses a closed bounty and names the state", () => {
    const r = check(bounty({ status: "CLOSED" }));
    expect(r.canClaim).toBe(false);
    expect(r.reason).toBe("closed");
    expect(r.message.toLowerCase()).toContain("closed");
  });

  it("refuses once the deadline has passed", () => {
    const r = check(bounty({ closesAt: new Date(Date.now() - 60_000) }));
    expect(r.canClaim).toBe(false);
    expect(r.reason).toBe("deadline_passed");
  });

  it("allows a claim right up to the deadline", () => {
    const r = check(bounty({ closesAt: new Date(Date.now() + 60_000) }));
    expect(r.canClaim).toBe(true);
  });

  describe("reserved bounties", () => {
    const reserved = bounty({ reservedForNewcomers: true });

    it("lets a newcomer claim", () => {
      expect(check(reserved, { viewerIsNewcomer: true }).canClaim).toBe(true);
    });

    it("refuses a ranked student, and explains why rather than just disabling", () => {
      const r = check(reserved, { viewerIsNewcomer: false });
      expect(r.canClaim).toBe(false);
      expect(r.reason).toBe("newcomers_only");
      // The message has to justify the refusal to the person it refuses.
      expect(r.message).toMatch(/held for students with no verified work/i);
    });

    it("still refuses a newcomer when the places are gone", () => {
      // A reservation is not an override of capacity.
      const r = check(bounty({ reservedForNewcomers: true, maxClaims: 1 }), {
        viewerIsNewcomer: true,
        submissionCount: 1,
      });
      expect(r.canClaim).toBe(false);
      expect(r.reason).toBe("full");
    });
  });

  describe("precedence", () => {
    it("reports an existing submission ahead of every other reason", () => {
      // Telling someone a bounty is full when they already submitted is
      // confusing; their own state comes first.
      const r = check(bounty({ status: "CLOSED", maxClaims: 1 }), {
        viewerHasSubmitted: true,
        submissionCount: 1,
      });
      expect(r.reason).toBe("already_submitted");
    });

    it("always carries a message when it refuses", () => {
      const refusals = [
        check(bounty(), { viewerId: POSTER_ID }),
        check(bounty(), { viewerHasSubmitted: true }),
        check(bounty({ maxClaims: 1 }), { submissionCount: 1 }),
        check(bounty({ status: "CLOSED" })),
        check(bounty({ closesAt: new Date(Date.now() - 1000) })),
        check(bounty({ reservedForNewcomers: true })),
      ];

      for (const r of refusals) {
        expect(r.canClaim).toBe(false);
        expect(r.message.length).toBeGreaterThan(10);
      }
    });
  });
});
