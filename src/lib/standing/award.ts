import { Prisma, ReputationEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COOLDOWN_MINUTES,
  POINTS,
  SEASON_CAPS,
  idempotencyKey,
  tierFor,
} from "./rules";

export interface AwardInput {
  tenantId: string;
  userId: string;
  type: ReputationEventType;
  /** What caused this — "evidence", "bounty_submission", "milestone", … */
  sourceType: string;
  sourceId: string;
  /** Only for MANUAL_ADJUSTMENT and ABUSE_REVERSAL, which carry no tariff. */
  points?: number;
  note?: string;
}

export type AwardResult =
  | { status: "awarded"; eventId: string; points: number }
  | { status: "duplicate"; reason: string }
  | { status: "capped"; reason: string }
  | { status: "cooldown"; reason: string }
  | { status: "no_season"; reason: string };

/**
 * Award standing.
 *
 * The whole point of this function is that calling it twice for the same cause
 * is safe. Callers are route handlers and webhooks; both retry.
 *
 * Everything happens in one transaction: the append-only ledger row and the
 * materialized balance must not be able to disagree. If they ever do, the
 * ledger is the truth and the balance is recomputed from it.
 */
export async function awardStanding(input: AwardInput): Promise<AwardResult> {
  const { tenantId, userId, type, sourceType, sourceId, note } = input;

  const isManual = type === "MANUAL_ADJUSTMENT" || type === "ABUSE_REVERSAL";
  const points = isManual ? (input.points ?? 0) : POINTS[type];
  const key = idempotencyKey(type, sourceType, sourceId, userId);

  const season = await prisma.season.findFirst({
    where: { tenantId, isCurrent: true },
    select: { id: true },
  });
  if (!season) {
    return { status: "no_season", reason: "No current season for this tenant." };
  }

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true },
  });
  if (!membership) {
    return { status: "no_season", reason: "User is not a member of this tenant." };
  }

  // Cooldown. Checked before the write so the caller gets a reason rather than
  // a silent no-op, and so a burst does not consume the season cap.
  const cooldown = COOLDOWN_MINUTES[type];
  if (cooldown && !isManual) {
    const since = new Date(Date.now() - cooldown * 60_000);
    const recent = await prisma.reputationEvent.findFirst({
      where: { tenantId, userId, type, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) {
      return {
        status: "cooldown",
        reason: `${type} is limited to one award every ${cooldown} minutes.`,
      };
    }
  }

  // Season cap. Positive rows only: a reversal must never free up headroom
  // that then lets the same abuse be re-awarded.
  const cap = SEASON_CAPS[type];
  if (cap !== null && points > 0) {
    const earned = await prisma.reputationEvent.aggregate({
      where: { tenantId, userId, type, seasonId: season.id, points: { gt: 0 } },
      _sum: { points: true },
    });
    const already = earned._sum.points ?? 0;
    if (already + points > cap) {
      return {
        status: "capped",
        reason: `Season cap reached for ${type} (${already}/${cap}).`,
      };
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const event = await tx.reputationEvent.create({
        data: {
          tenantId,
          userId,
          seasonId: season.id,
          type,
          points,
          sourceType,
          sourceId,
          idempotencyKey: key,
          note,
        },
        select: { id: true },
      });

      // Recompute the balance from the ledger rather than incrementing it.
      // Incrementing is how a materialized total drifts away from its source.
      const total = await tx.reputationEvent.aggregate({
        where: { tenantId, userId, seasonId: season.id },
        _sum: { points: true },
      });
      const balance = total._sum.points ?? 0;

      await tx.standing.upsert({
        where: { membershipId: membership.id },
        create: {
          membershipId: membership.id,
          seasonId: season.id,
          points: balance,
          tier: tierFor(balance),
        },
        update: {
          points: balance,
          tier: tierFor(balance),
          seasonId: season.id,
          recomputedAt: new Date(),
        },
      });

      return { status: "awarded" as const, eventId: event.id, points };
    });
  } catch (error) {
    // P2002 on (tenantId, idempotencyKey): this cause was already awarded.
    // That is the success path for a retry, not an error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "duplicate", reason: "This award already exists." };
    }
    throw error;
  }
}

/**
 * Reverse an award — abuse finding, or an appeal upheld.
 *
 * Writes a compensating negative row and links the two. Nothing is deleted,
 * because the Provenance Drawer has to be able to show that a reversal
 * happened, who did it and why.
 */
export async function reverseAward(
  reputationEventId: string,
  actorNote: string
): Promise<AwardResult> {
  const original = await prisma.reputationEvent.findUnique({
    where: { id: reputationEventId },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      points: true,
      sourceType: true,
      sourceId: true,
      reversedById: true,
    },
  });

  if (!original) return { status: "duplicate", reason: "No such event." };
  if (original.reversedById) {
    return { status: "duplicate", reason: "Already reversed." };
  }

  const result = await awardStanding({
    tenantId: original.tenantId,
    userId: original.userId,
    type: "ABUSE_REVERSAL",
    sourceType: "reputation_event",
    sourceId: original.id,
    points: -original.points,
    note: actorNote,
  });

  if (result.status === "awarded") {
    await prisma.reputationEvent.update({
      where: { id: original.id },
      data: { reversedById: result.eventId },
    });
  }

  return result;
}

/**
 * Every ledger row behind a person's standing, newest first.
 *
 * This is what the Provenance Drawer renders. Principle 1 of the art
 * direction: a number that cannot open its own receipts may not be displayed.
 */
export async function standingProvenance(
  tenantId: string,
  userId: string,
  seasonId?: string
) {
  return prisma.reputationEvent.findMany({
    where: { tenantId, userId, ...(seasonId ? { seasonId } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      points: true,
      sourceType: true,
      sourceId: true,
      note: true,
      createdAt: true,
      reversedById: true,
    },
  });
}
