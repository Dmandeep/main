import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { projectCardSelect, toProjectCard } from "@/lib/projects/select";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const viewer = await getActiveMembership();
    if (!viewer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await params;

    // Scoped to the viewer's tenant: a profile in another department is a 404
    // here, not a cross-tenant read.
    const membership = await prisma.membership.findFirst({
      where: {
        tenantId: viewer.tenantId,
        user: { username: username.toLowerCase() },
      },
      select: {
        role: true,
        department: true,
        year: true,
        standing: {
          select: {
            points: true,
            rank: true,
            tier: true,
            verifiedEvidenceCount: true,
            projectsShipped: true,
            bountiesCompleted: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            bio: true,
            githubUsername: true,
            githubVerified: true,
            createdAt: true,
            profileLinks: {
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                platform: true,
                handle: true,
                isVerified: true,
                statLabel: true,
                statValue: true,
              },
            },
            profileTags: {
              orderBy: [{ source: "asc" }, { createdAt: "asc" }],
              select: { id: true, label: true, source: true, sourceRef: true },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = membership.user.id;

    const [owned, collaborated] = await Promise.all([
      prisma.project.findMany({
        where: { tenantId: viewer.tenantId, ownerId: userId, status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        select: projectCardSelect,
      }),
      prisma.project.findMany({
        where: {
          tenantId: viewer.tenantId,
          status: { not: "DRAFT" },
          ownerId: { not: userId },
          members: { some: { userId } },
        },
        orderBy: { createdAt: "desc" },
        select: projectCardSelect,
      }),
    ]);

    const standing = membership.standing;

    return NextResponse.json({
      data: {
        _id: userId,
        name: membership.user.name,
        username: membership.user.username,
        avatarUrl: membership.user.avatarUrl ?? undefined,
        bio: membership.user.bio ?? undefined,
        githubUsername: membership.user.githubUsername ?? undefined,
        role: membership.role.toLowerCase(),
        department: membership.department ?? undefined,
        branch: membership.department ?? undefined,
        year: membership.year ?? undefined,
        primaryTrack: "",
        skills: [],
        interests: [],
        createdAt: membership.user.createdAt.toISOString(),
        points: standing?.points ?? 0,
        rank: standing?.rank ?? undefined,
        rankTier: standing?.tier ?? "BRONZE",
        verifiedEvidenceCount: standing?.verifiedEvidenceCount ?? 0,
        projectsShipped: standing?.projectsShipped ?? 0,
        bountiesCompleted: standing?.bountiesCompleted ?? 0,
        // Links and tags are returned with their provenance intact. A handle
        // the student typed is a claim; only `isVerified` makes it evidence,
        // and the UI has to be able to tell them apart to say so.
        links: membership.user.profileLinks.map((l) => ({
          _id: l.id,
          platform: l.platform.toLowerCase(),
          handle: l.handle,
          isVerified: l.isVerified,
          statLabel: l.statLabel ?? undefined,
          statValue: l.statValue ?? undefined,
        })),
        tags: membership.user.profileTags.map((t) => ({
          _id: t.id,
          label: t.label,
          source: t.source.toLowerCase(),
          sourceRef: t.sourceRef ?? undefined,
        })),
        forgedIdeas: owned.map(toProjectCard),
        collaboratedIdeas: collaborated.map(toProjectCard),
      },
    });
  } catch (error) {
    logger.error("Failed to fetch profile", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
