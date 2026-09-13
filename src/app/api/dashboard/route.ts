import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { projectCardSelect, toProjectCard } from "@/lib/projects/select";
import { nextTier } from "@/lib/standing/rules";

/**
 * Everything that is yours.
 *
 * This backs The Forge — the one screen that answers "what am I actually in
 * the middle of". It deliberately reads across four tables rather than making
 * the page call four endpoints and stitch them, because the answer is a single
 * thought: your projects, your claims, your seats, and what is waiting on
 * someone else.
 */

export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      myProjects,
      totalProjects,
      verifiedEvidence,
      awaitingReview,
      standing,
      mySubmissions,
      mySeats,
      recentEvidence,
    ] = await Promise.all([
        prisma.project.findMany({
          where: {
            tenantId: membership.tenantId,
            members: { some: { userId: membership.userId, leftAt: null } },
          },
          orderBy: { updatedAt: "desc" },
          select: projectCardSelect,
        }),
        prisma.project.count({
          where: { tenantId: membership.tenantId, status: { notIn: ["DRAFT", "REJECTED"] } },
        }),
        prisma.evidence.count({
          where: { creatorId: membership.userId, state: "VERIFIED" },
        }),
        // Your own work still waiting on a reviewer. Surfacing this is the
        // difference between "nothing is happening" and "the queue is slow".
        prisma.evidence.count({
          where: {
            creatorId: membership.userId,
            state: { in: ["SUBMITTED", "UNDER_REVIEW", "MACHINE_VERIFIED"] },
          },
        }),
        prisma.standing.findUnique({
          where: { membershipId: membership.membershipId },
          select: { points: true, tier: true, rank: true },
        }),

        prisma.bountySubmission.findMany({
          where: { userId: membership.userId },
          orderBy: { submittedAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            summary: true,
            submittedAt: true,
            awardedAt: true,
            bounty: {
              select: { id: true, title: true, rewardPoints: true, closesAt: true, status: true },
            },
          },
        }),

        prisma.eventRegistration.findMany({
          where: {
            userId: membership.userId,
            status: { in: ["REGISTERED", "WAITLISTED"] },
            event: { status: "SCHEDULED" },
          },
          orderBy: { event: { startsAt: "asc" } },
          take: 10,
          select: {
            id: true,
            status: true,
            allocation: true,
            waitlistPosition: true,
            event: { select: { id: true, title: true, startsAt: true, location: true } },
          },
        }),

        // The most recent decisions on your own evidence, whichever way they
        // went. A rejection you never see is a rejection you cannot act on.
        prisma.evidence.findMany({
          where: { creatorId: membership.userId },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            state: true,
            createdAt: true,
            project: { select: { slug: true, title: true } },
            reviews: {
              orderBy: { decidedAt: "desc" },
              take: 1,
              select: { decision: true, rationale: true, decidedAt: true },
            },
          },
        }),
      ]);

    return NextResponse.json({
      data: {
        myIdeas: myProjects.map(toProjectCard),
        stats: {
          ideasOwned: myProjects.length,
          totalIdeas: totalProjects,
          proofsVerified: verifiedEvidence,
          proofsAwaitingReview: awaitingReview,
          points: standing?.points ?? 0,
          rank: standing?.rank ?? null,
          rankTier: standing?.tier ?? "BRONZE",
          // Derived from the same ladder as the tier, so the two can never
          // disagree on screen.
          nextTier: nextTier(standing?.points ?? 0),
        },
        claims: mySubmissions.map((sub) => ({
          _id: sub.id,
          status: sub.status.toLowerCase(),
          summary: sub.summary,
          submittedAt: sub.submittedAt.toISOString(),
          awardedAt: sub.awardedAt?.toISOString() ?? null,
          bounty: {
            _id: sub.bounty.id,
            title: sub.bounty.title,
            rewardPoints: sub.bounty.rewardPoints,
            status: sub.bounty.status.toLowerCase(),
            closesAt: sub.bounty.closesAt?.toISOString() ?? null,
          },
        })),
        seats: mySeats.map((seat) => ({
          _id: seat.id,
          status: seat.status.toLowerCase(),
          allocation: seat.allocation,
          waitlistPosition: seat.waitlistPosition,
          event: {
            _id: seat.event.id,
            title: seat.event.title,
            startsAt: seat.event.startsAt?.toISOString() ?? null,
            location: seat.event.location ?? undefined,
          },
        })),
        evidence: recentEvidence.map((e) => ({
          _id: e.id,
          title: e.title,
          state: e.state.toLowerCase(),
          createdAt: e.createdAt.toISOString(),
          project: e.project,
          lastDecision: e.reviews[0]
            ? {
                decision: e.reviews[0].decision.toLowerCase(),
                rationale: e.reviews[0].rationale,
                at: e.reviews[0].decidedAt.toISOString(),
              }
            : null,
        })),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch dashboard", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}
