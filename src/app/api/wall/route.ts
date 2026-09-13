import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";

/** Verified work across the department. Unverified rows never appear here. */
export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const evidence = await prisma.evidence.findMany({
      where: { state: "VERIFIED", project: { tenantId: membership.tenantId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        sourceType: true,
        createdAt: true,
        overallScore: true,
        creator: { select: userRefSelect },
        project: { select: { title: true, slug: true, track: true } },
        reviews: {
          where: { decision: "APPROVED" },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { decidedAt: true, reviewer: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json({
      data: evidence.map((e) => ({
        _id: e.id,
        title: e.title,
        description: e.description ?? undefined,
        evidenceUrl: e.sourceUrl,
        type: e.sourceType.toLowerCase(),
        isVerified: true,
        overallScore: e.overallScore,
        verifiedBy: e.reviews[0]?.reviewer.name ?? null,
        verifiedAt: e.reviews[0]?.decidedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
        idea: e.project,
        submittedBy: {
          name: e.creator.name,
          username: e.creator.username,
          avatarUrl: e.creator.avatarUrl ?? undefined,
        },
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch wall", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch wall" }, { status: 500 });
  }
}
