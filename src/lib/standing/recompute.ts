import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { tierFor } from "./rules";

/**
 * Rebuild materialized standing from the ledger.
 *
 * `Standing` is a cache. `reputation_events` is the truth. This job recomputes
 * the cache from the events, which is what makes the cache safe to keep:
 * any drift — a failed transaction, a manual correction, a reversal — is
 * corrected on the next run rather than living forever.
 *
 * It also assigns rank. Rank was previously written only by the seed, so it
 * went stale the moment anyone earned a point; a leaderboard showing a stale
 * rank next to a fresh score is worse than showing no rank.
 *
 * Idempotent by construction: it derives everything from the ledger, so
 * running it twice produces the same result as running it once.
 */
export interface RecomputeResult {
  tenantId: string;
  seasonId: string;
  membershipsUpdated: number;
  ranksAssigned: number;
  drifted: Array<{ membershipId: string; from: number; to: number }>;
}

export async function recomputeStanding(tenantId: string): Promise<RecomputeResult | null> {
  const season = await prisma.season.findFirst({
    where: { tenantId, isCurrent: true },
    select: { id: true },
  });

  if (!season) {
    logger.warn("Standing recompute skipped: no current season", { tenantId });
    return null;
  }

  const memberships = await prisma.membership.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true, userId: true },
  });

  // One grouped query rather than one per member.
  const totals = await prisma.reputationEvent.groupBy({
    by: ["userId"],
    where: { tenantId, seasonId: season.id },
    _sum: { points: true },
  });
  const pointsByUser = new Map(totals.map((t) => [t.userId, t._sum.points ?? 0]));

  const verified = await prisma.evidence.groupBy({
    by: ["creatorId"],
    where: { state: "VERIFIED", project: { tenantId } },
    _count: true,
  });
  const verifiedByUser = new Map(verified.map((v) => [v.creatorId, v._count]));

  const shipped = await prisma.project.groupBy({
    by: ["ownerId"],
    where: { tenantId, status: "SHIPPED" },
    _count: true,
  });
  const shippedByUser = new Map(shipped.map((s) => [s.ownerId, s._count]));

  const bounties = await prisma.bountySubmission.groupBy({
    by: ["userId"],
    where: { status: "AWARDED", bounty: { tenantId } },
    _count: true,
  });
  const bountiesByUser = new Map(bounties.map((b) => [b.userId, b._count]));

  const existing = await prisma.standing.findMany({
    where: { seasonId: season.id, membership: { tenantId } },
    select: { membershipId: true, points: true },
  });
  const previous = new Map(existing.map((e) => [e.membershipId, e.points]));

  const drifted: RecomputeResult["drifted"] = [];

  const rows = memberships.map((m) => {
    const points = pointsByUser.get(m.userId) ?? 0;
    const before = previous.get(m.id);

    // Drift is worth reporting, not silently fixing: it means a write path
    // failed somewhere, and nobody would otherwise find out.
    if (before !== undefined && before !== points) {
      drifted.push({ membershipId: m.id, from: before, to: points });
    }

    return {
      membershipId: m.id,
      points,
      tier: tierFor(points),
      verifiedEvidenceCount: verifiedByUser.get(m.userId) ?? 0,
      projectsShipped: shippedByUser.get(m.userId) ?? 0,
      bountiesCompleted: bountiesByUser.get(m.userId) ?? 0,
    };
  });

  // Rank by points, and break ties deterministically so two people on the same
  // score do not swap places on every run.
  const ranked = [...rows].sort(
    (a, b) => b.points - a.points || a.membershipId.localeCompare(b.membershipId)
  );

  await prisma.$transaction(
    ranked.map((row, index) =>
      prisma.standing.upsert({
        where: { membershipId: row.membershipId },
        create: {
          membershipId: row.membershipId,
          seasonId: season.id,
          points: row.points,
          tier: row.tier,
          rank: index + 1,
          verifiedEvidenceCount: row.verifiedEvidenceCount,
          projectsShipped: row.projectsShipped,
          bountiesCompleted: row.bountiesCompleted,
        },
        update: {
          points: row.points,
          tier: row.tier,
          rank: index + 1,
          verifiedEvidenceCount: row.verifiedEvidenceCount,
          projectsShipped: row.projectsShipped,
          bountiesCompleted: row.bountiesCompleted,
          recomputedAt: new Date(),
        },
      })
    )
  );

  if (drifted.length > 0) {
    logger.warn("Standing drift corrected", { tenantId, count: drifted.length, drifted });
  }

  logger.info("Standing recomputed", {
    tenantId,
    seasonId: season.id,
    memberships: rows.length,
  });

  return {
    tenantId,
    seasonId: season.id,
    membershipsUpdated: rows.length,
    ranksAssigned: ranked.length,
    drifted,
  };
}

/** Recompute every active tenant. Used by the scheduled job. */
export async function recomputeAllTenants(): Promise<RecomputeResult[]> {
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["ACTIVE", "PILOT"] } },
    select: { id: true },
  });

  const results: RecomputeResult[] = [];
  for (const tenant of tenants) {
    const result = await recomputeStanding(tenant.id);
    if (result) results.push(result);
  }
  return results;
}
