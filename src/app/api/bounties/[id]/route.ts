import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { isNewcomer } from "@/lib/standing/rules";
import {
  bountyDetailSelect,
  claimEligibility,
  serialiseBountyDetail,
} from "@/lib/bounties/select";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const bounty = await prisma.bounty.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: bountyDetailSelect,
    });

    if (!bounty) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    const standing = await prisma.standing.findUnique({
      where: { membershipId: membership.membershipId },
      select: { points: true },
    });
    const viewerIsNewcomer = isNewcomer(standing?.points ?? 0);

    const eligibility = claimEligibility({
      status: bounty.status,
      closesAt: bounty.closesAt,
      maxClaims: bounty.maxClaims,
      reservedForNewcomers: bounty.reservedForNewcomers,
      posterId: bounty.poster.id,
      submissionCount: bounty.submissions.length,
      viewerId: membership.userId,
      viewerIsNewcomer,
      viewerHasSubmitted: bounty.submissions.some((s) => s.user.id === membership.userId),
    });

    return NextResponse.json({
      data: serialiseBountyDetail(bounty, eligibility, viewerIsNewcomer),
    });
  } catch (error) {
    logger.error("Failed to fetch bounty", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch bounty" }, { status: 500 });
  }
}

/** Close or reopen a bounty. Poster or admin only. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "bounty:update",
      membership.userId,
      "You are editing bounties too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const bounty = await prisma.bounty.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: { id: true, posterId: true, status: true },
    });
    if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

    if (bounty.posterId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const next = String(body.status ?? "").toUpperCase();
    if (!["OPEN", "IN_REVIEW", "CLOSED"].includes(next)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.bounty.update({
        where: { id: bounty.id },
        data: { status: next as "OPEN" | "IN_REVIEW" | "CLOSED" },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: `bounty.${next.toLowerCase()}`,
          targetType: "bounty",
          targetId: bounty.id,
        },
      }),
    ]);

    return NextResponse.json({ data: { id: bounty.id, status: next } });
  } catch (error) {
    logger.error("Failed to update bounty", { error: String(error) });
    return NextResponse.json({ error: "Failed to update bounty" }, { status: 500 });
  }
}
