import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";

/**
 * Teams the caller is on.
 *
 * Joining is not done here — it goes through `/api/ideas/[id]/join`, which
 * requires the owner to decide. A POST that adds you to a team directly would
 * be a hole straight through that decision.
 */
export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.projectMembership.findMany({
      where: {
        userId: membership.userId,
        leftAt: null,
        project: { tenantId: membership.tenantId },
      },
      orderBy: { joinedAt: "desc" },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        project: { select: { id: true, slug: true, title: true, status: true } },
      },
    });

    return NextResponse.json({
      data: memberships.map((m) => ({
        _id: m.id,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        idea: {
          _id: m.project.id,
          slug: m.project.slug,
          title: m.project.title,
          status: m.project.status.toLowerCase(),
        },
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch collaborations", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch collaborations" }, { status: 500 });
  }
}
