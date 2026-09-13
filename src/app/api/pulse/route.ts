import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { matchSkills } from "@/lib/feed/matching";

/**
 * The campus pulse.
 *
 * Three questions a student actually has when they open the app, and which
 * nothing answered: what has this place done lately, who needs what I can do,
 * and who just arrived.
 *
 * All three are recognition surfaces rather than metrics. The counters on the
 * landing page say the department has 27 members; this says Priya got her
 * deploy verified on Tuesday and a team two floors away is short a person who
 * can do the thing you listed. That is the difference between a dashboard and
 * a place with people in it.
 */

const WINDOW_DAYS = 14;

export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

    const [verified, myTags, openProjects, newcomers] = await Promise.all([
      // What the department got signed off lately. Names attached, because
      // recognition with the name removed is a statistic.
      prisma.evidence.findMany({
        where: {
          state: "VERIFIED",
          project: { tenantId: membership.tenantId },
          updatedAt: { gte: since },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          creator: { select: { name: true, username: true, avatarUrl: true } },
          project: { select: { slug: true, title: true } },
        },
      }),

      prisma.profileTag.findMany({
        where: { userId: membership.userId },
        select: { label: true },
      }),

      // Projects still looking for people, that the viewer is not already on.
      prisma.project.findMany({
        where: {
          tenantId: membership.tenantId,
          status: { in: ["DISCOVERY", "BUILDING"] },
          skillsNeeded: { isEmpty: false },
          ownerId: { not: membership.userId },
          members: { none: { userId: membership.userId, leftAt: null } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          skillsNeeded: true,
          verifiedEvidenceCount: true,
          owner: { select: { name: true, username: true, avatarUrl: true } },
          _count: { select: { members: true } },
        },
      }),

      // People who arrived recently and have nothing verified yet. Surfaced so
      // seniors can help them, never ranked down for it — this is the same
      // commitment the newcomer quota makes, on a different surface.
      prisma.membership.findMany({
        where: {
          tenantId: membership.tenantId,
          status: "ACTIVE",
          role: "STUDENT",
          joinedAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
          userId: { not: membership.userId },
        },
        orderBy: { joinedAt: "desc" },
        take: 12,
        select: {
          year: true,
          joinedAt: true,
          standing: { select: { points: true } },
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
              _count: { select: { submittedEvidence: { where: { state: "VERIFIED" } } } },
            },
          },
        },
      }),
    ]);

    const mySkills = myTags.map((t) => t.label);

    // Matching happens here, over a bounded set, rather than in the database:
    // the rule is a pure function with its own tests, and skill aliasing is
    // not something a SQL `overlaps` can do.
    const needsYou = openProjects
      .map((p) => ({ project: p, match: matchSkills(p.skillsNeeded, mySkills) }))
      .filter((row) => row.match.matched.length > 0)
      .sort((a, b) => b.match.matched.length - a.match.matched.length)
      .slice(0, 6)
      .map(({ project, match }) => ({
        _id: project.id,
        slug: project.slug,
        title: project.title,
        tagline: project.tagline,
        skillsNeeded: project.skillsNeeded,
        matched: match.matched,
        teamSize: project._count.members,
        verifiedEvidenceCount: project.verifiedEvidenceCount,
        owner: project.owner,
      }));

    return NextResponse.json({
      data: {
        verified: verified.map((e) => ({
          _id: e.id,
          title: e.title,
          at: e.updatedAt.toISOString(),
          by: e.creator,
          project: e.project,
        })),
        needsYou,
        // Only those with nothing verified yet: someone already going does not
        // need welcoming, and listing them would make this a leaderboard.
        newFaces: newcomers
          .filter((m) => m.user._count.submittedEvidence === 0)
          .slice(0, 6)
          .map((m) => ({
            _id: m.user.id,
            name: m.user.name,
            username: m.user.username,
            avatarUrl: m.user.avatarUrl ?? undefined,
            year: m.year ?? undefined,
            joinedAt: m.joinedAt.toISOString(),
          })),
        meta: {
          windowDays: WINDOW_DAYS,
          viewerHasSkills: mySkills.length > 0,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to build the pulse", { error: String(error) });
    return NextResponse.json({ error: "Failed to load the pulse" }, { status: 500 });
  }
}
