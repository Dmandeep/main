import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";

/**
 * Standing for the current season.
 *
 * Reads the materialized `Standing` rows rather than summing the ledger on
 * every request, but every row here is reproducible from `reputation_events` —
 * which is what the Provenance Drawer shows when a student asks why they are
 * ranked where they are.
 */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

    const season = await prisma.season.findFirst({
      where: { tenantId: membership.tenantId, isCurrent: true },
      select: { id: true, name: true },
    });

    if (!season) {
      return NextResponse.json({ data: [], meta: { season: null } });
    }

    const standings = await prisma.standing.findMany({
      where: {
        seasonId: season.id,
        membership: { tenantId: membership.tenantId, status: "ACTIVE" },
      },
      orderBy: [{ points: "desc" }, { recomputedAt: "asc" }],
      take: limit,
      select: {
        id: true,
        points: true,
        rank: true,
        tier: true,
        verifiedEvidenceCount: true,
        projectsShipped: true,
        bountiesCompleted: true,
        membership: {
          select: {
            year: true,
            department: true,
            user: { select: { ...userRefSelect, bio: true } },
          },
        },
      },
    });

    const data = standings.map((s, i) => ({
      _id: s.id,
      // Fall back to list position when the nightly recompute has not run yet,
      // rather than rendering a blank rank column.
      rank: s.rank ?? i + 1,
      points: s.points,
      rankTier: s.tier,
      proofsSubmitted: s.verifiedEvidenceCount,
      ideasShipped: s.projectsShipped,
      workshopsAttended: s.bountiesCompleted,
      user: {
        _id: s.membership.user.id,
        name: s.membership.user.name,
        username: s.membership.user.username,
        avatarUrl: s.membership.user.avatarUrl ?? undefined,
        bio: s.membership.user.bio ?? undefined,
        rankTier: s.tier,
        points: s.points,
      },
    }));

    return NextResponse.json({ data, meta: { season: season.name } });
  } catch (error) {
    logger.error("Failed to fetch leaderboard", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
