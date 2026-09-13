/**
 * Bounty claim rules.
 *
 * Deliberately free of imports. This module decides whether a person may claim
 * a bounty, which is a rule a student can challenge, so it must be readable on
 * its own and testable without a database, an auth session or a running app.
 *
 * It previously lived beside the Prisma selection helpers, which meant it
 * transitively imported the auth stack and could not be unit tested at all.
 */

export type ClaimBlockReason =
  | "closed"
  | "full"
  | "newcomers_only"
  | "already_submitted"
  | "own_bounty"
  | "deadline_passed";

export interface ClaimEligibility {
  canClaim: boolean;
  reason: ClaimBlockReason | null;
  /** Plain-language explanation. Shown verbatim; never "not eligible". */
  message: string;
}

/** Only what the decision needs — not the whole bounty row. */
export interface ClaimContext {
  status: string;
  closesAt: Date | null;
  maxClaims: number;
  reservedForNewcomers: boolean;
  posterId: string;
  submissionCount: number;
  viewerId: string;
  viewerIsNewcomer: boolean;
  viewerHasSubmitted: boolean;
}

/**
 * Why a person can or cannot claim this bounty.
 *
 * Decided on the server rather than inferred in the client, because the client
 * does not know the newcomer threshold or how many claims remain — and a
 * disabled button with no reason is the worst possible answer.
 *
 * Order matters: the viewer's own state is reported before any property of the
 * bounty, so someone who already submitted is never told the bounty is full.
 */
export function claimEligibility(ctx: ClaimContext): ClaimEligibility {
  if (ctx.viewerHasSubmitted) {
    return {
      canClaim: false,
      reason: "already_submitted",
      message: "You have already submitted to this bounty.",
    };
  }

  if (ctx.posterId === ctx.viewerId) {
    return {
      canClaim: false,
      reason: "own_bounty",
      message: "You posted this bounty, so you cannot also claim it.",
    };
  }

  if (ctx.status !== "OPEN") {
    return {
      canClaim: false,
      reason: "closed",
      message: `This bounty is ${ctx.status.toLowerCase().replace("_", " ")}.`,
    };
  }

  if (ctx.closesAt && ctx.closesAt < new Date()) {
    return {
      canClaim: false,
      reason: "deadline_passed",
      message: "The deadline for this bounty has passed.",
    };
  }

  if (ctx.submissionCount >= ctx.maxClaims) {
    return {
      canClaim: false,
      reason: "full",
      message: `All ${ctx.maxClaims} places on this bounty are taken.`,
    };
  }

  // A reservation is not an override of capacity, so it is checked last.
  if (ctx.reservedForNewcomers && !ctx.viewerIsNewcomer) {
    return {
      canClaim: false,
      reason: "newcomers_only",
      message:
        "This one is held for students with no verified work yet. It stays open for them even when everything else is taken.",
    };
  }

  return { canClaim: true, reason: null, message: "" };
}
