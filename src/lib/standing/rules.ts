import { ReputationEventType, StandingTier } from "@prisma/client";

/**
 * Standing rules.
 *
 * These are deliberately pure functions in their own module: the values here
 * decide who appears at the top of a leaderboard and, from phase 3, who gets a
 * seat. That has to be readable by a faculty member, quotable in an appeal, and
 * testable without a database.
 *
 * Design constraints, from docs/design/CAMPUS-ECOSYSTEM.md §5.2:
 *   - Outputs are rewarded, inputs are not. A commit is an input. Verified,
 *     reviewed, shipped work is an output. The GitHub contribution graph is the
 *     cautionary example: a frequency chart that became a hiring filter.
 *   - Every award is capped per season, so volume alone cannot win.
 *   - Every award is idempotent, keyed on what caused it.
 */

/** Points per event type. Verified outcomes dominate; participation does not. */
export const POINTS: Record<ReputationEventType, number> = {
  EVIDENCE_VERIFIED: 10,
  MILESTONE_COMPLETED: 15,
  PROJECT_SHIPPED: 120,
  BOUNTY_COMPLETED: 40,
  WORKSHOP_DELIVERED: 60,
  PEER_REVIEW_COMPLETED: 8,
  MENTORSHIP_DELIVERED: 25,
  PROJECT_REVIVED: 50,
  MANUAL_ADJUSTMENT: 0,
  ABUSE_REVERSAL: 0,
};

/**
 * Maximum points a single event type may contribute in one season.
 *
 * Without these, the cheapest action always wins: 200 verified screenshots beat
 * one shipped project, which is precisely the failure mode the leaderboard is
 * accused of. `null` means uncapped — reserved for reversals and for manual
 * adjustments, which already require a named human.
 */
export const SEASON_CAPS: Record<ReputationEventType, number | null> = {
  EVIDENCE_VERIFIED: 300,
  MILESTONE_COMPLETED: 240,
  PROJECT_SHIPPED: 360,
  BOUNTY_COMPLETED: 320,
  WORKSHOP_DELIVERED: 240,
  PEER_REVIEW_COMPLETED: 120,
  MENTORSHIP_DELIVERED: 200,
  PROJECT_REVIVED: 150,
  MANUAL_ADJUSTMENT: null,
  ABUSE_REVERSAL: null,
};

/**
 * Minimum gap between two awards of the same type to the same person.
 * Blunts scripted submission bursts without punishing a genuinely productive
 * afternoon, since evidence still has to pass review to score at all.
 */
export const COOLDOWN_MINUTES: Partial<Record<ReputationEventType, number>> = {
  EVIDENCE_VERIFIED: 10,
  PEER_REVIEW_COMPLETED: 5,
};

/** Tier thresholds, in season points. */
const TIERS: ReadonlyArray<readonly [StandingTier, number]> = [
  ["ELITE", 900],
  ["PLATINUM", 600],
  ["GOLD", 350],
  ["SILVER", 150],
  ["BRONZE", 0],
] as const;

export function tierFor(points: number): StandingTier {
  for (const [tier, floor] of TIERS) {
    if (points >= floor) return tier;
  }
  return "BRONZE";
}

/**
 * How far to the next tier.
 *
 * Derived from the same ladder the tier itself comes from, so a UI showing
 * "40 points to Silver" can never disagree with the tier it shows beside it.
 * Returns null at the top: inventing a further goal for someone who has
 * reached the last one is the kind of endless-treadmill design this product
 * has no use for.
 */
export function nextTier(
  points: number
): { tier: StandingTier; at: number; remaining: number } | null {
  // TIERS is ordered high to low, so the last entry above the current points
  // is the one immediately ahead.
  const ahead = [...TIERS].reverse().find(([, floor]) => floor > points);
  if (!ahead) return null;

  const [tier, at] = ahead;
  return { tier, at, remaining: at - points };
}

/**
 * Below this, a member counts as a newcomer and is eligible for the reserved
 * quota on events and starter bounties. See CAMPUS-ECOSYSTEM.md §5.1 — without
 * this, first-years are locked out of exactly the events that would earn them
 * standing.
 */
export const NEWCOMER_THRESHOLD_POINTS = 150;

export function isNewcomer(points: number): boolean {
  return points < NEWCOMER_THRESHOLD_POINTS;
}

/**
 * Idempotency key for an award.
 *
 * Keyed on the cause, never on the moment of awarding: replaying the same
 * verification must collide. This is the difference between "we award points
 * when evidence is verified" and "we award points every time that code path
 * happens to run".
 */
export function idempotencyKey(
  type: ReputationEventType,
  sourceType: string,
  sourceId: string,
  userId: string
): string {
  return `${type}:${sourceType}:${sourceId}:${userId}`;
}
