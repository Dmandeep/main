import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";

/**
 * The archive: projects that stopped, with the postmortem that says why.
 *
 * This is the institutional-memory surface. Every row is revivable, and a
 * revival inherits the original's ledger rather than starting from zero.
 */
export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const archived = await prisma.project.findMany({
      where: { tenantId: membership.tenantId, status: "ARCHIVED" },
      orderBy: { archivedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        track: true,
        problem: true,
        postmortem: true,
        outcome: true,
        archivedAt: true,
        verifiedEvidenceCount: true,
        owner: { select: userRefSelect },
        revivals: { select: { id: true, slug: true, title: true } },
      },
    });

    return NextResponse.json({
      data: archived.map((p) => ({
        _id: p.id,
        slug: p.slug,
        title: p.title,
        track: p.track,
        problem: p.problem,
        lessons: p.postmortem ?? "",
        postmortem: p.postmortem ?? "",
        outcome: p.outcome ?? "PAUSED",
        archivedAt: p.archivedAt?.toISOString() ?? null,
        verifiedEvidenceCount: p.verifiedEvidenceCount,
        revivedBy: p.revivals,
        isPublic: true,
        idea: { title: p.title, slug: p.slug, track: p.track },
        author: {
          name: p.owner.name,
          username: p.owner.username,
          avatarUrl: p.owner.avatarUrl ?? undefined,
        },
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch archive", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch archive" }, { status: 500 });
  }
}
