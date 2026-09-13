import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { calculateHealthScore } from "@/lib/health-score";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Accepts either a cuid or a slug, so shareable URLs can use the slug.
 * Both lookups are tenant-scoped: an id from another department must 404, not
 * leak a row.
 */
function identify(idOrSlug: string, tenantId: string) {
  return idOrSlug.startsWith("c") && idOrSlug.length > 20
    ? { id: idOrSlug, tenantId }
    : { tenantId_slug: { tenantId, slug: idOrSlug } };
}

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
    const project = await prisma.project.findFirst({
      where: { tenantId: membership.tenantId, OR: [{ id }, { slug: id }] },
      select: {
        id: true,
        slug: true,
        title: true,
        tagline: true,
        problem: true,
        solution: true,
        track: true,
        tags: true,
        skillsNeeded: true,
        coverImage: true,
        githubUrl: true,
        demoUrl: true,
        status: true,
        briefCompleteness: true,
        upvoteCount: true,
        postmortem: true,
        outcome: true,
        archivedAt: true,
        createdAt: true,
        owner: { select: { ...userRefSelect, bio: true } },
        revivedFrom: { select: { id: true, slug: true, title: true } },
        members: {
          where: { leftAt: null },
          select: { userId: true, role: true, joinedAt: true, user: { select: userRefSelect } },
        },
        // The viewer's own outstanding request, so the page can say "asked"
        // rather than offering to ask again and returning a 409.
        joinRequests: {
          where: { userId: membership.userId },
          select: { id: true, status: true, role: true, createdAt: true },
        },
        milestones: {
          orderBy: { ordinal: "asc" },
          select: { id: true, ordinal: true, title: true, dueAt: true, completedAt: true },
        },
        evidence: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            sourceType: true,
            sourceUrl: true,
            state: true,
            capturedAt: true,
            createdAt: true,
            creator: { select: userRefSelect },
            reviews: {
              orderBy: { decidedAt: "desc" },
              take: 1,
              select: {
                decision: true,
                rationale: true,
                decidedAt: true,
                reviewer: { select: userRefSelect },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const proofs = project.evidence.map((e) => {
      const review = e.reviews[0];
      return {
        _id: e.id,
        title: e.title,
        description: e.description ?? undefined,
        url: e.sourceUrl,
        type: e.sourceType.toLowerCase(),
        status:
          e.state === "VERIFIED" ? "approved" : e.state === "REJECTED" ? "rejected" : "pending",
        state: e.state,
        pointsAwarded: e.state === "VERIFIED" ? 10 : 0,
        createdAt: e.createdAt.toISOString(),
        verifiedBy: review?.reviewer
          ? { name: review.reviewer.name, username: review.reviewer.username }
          : undefined,
        verifiedAt: review?.decidedAt?.toISOString(),
        rationale: review?.rationale ?? undefined,
        submitter: {
          _id: e.creator.id,
          name: e.creator.name,
          username: e.creator.username,
          avatarUrl: e.creator.avatarUrl ?? undefined,
        },
      };
    });

    return NextResponse.json({
      data: {
        _id: project.id,
        slug: project.slug,
        title: project.title,
        tagline: project.tagline ?? undefined,
        problem: project.problem,
        solution: project.solution,
        track: project.track,
        tags: project.tags,
        skillsNeeded: project.skillsNeeded,
        coverImage: project.coverImage ?? undefined,
        githubUrl: project.githubUrl ?? undefined,
        demoUrl: project.demoUrl ?? undefined,
        status: project.status.toLowerCase(),
        healthScore: project.briefCompleteness,
        briefCompleteness: project.briefCompleteness,
        upvotes: project.upvoteCount,
        // `views` is gone: it was a vanity counter with no provenance, and the
        // product's rule is that a number must be able to explain itself.
        views: 0,
        postmortem: project.postmortem ?? undefined,
        outcome: project.outcome ?? undefined,
        archivedAt: project.archivedAt?.toISOString(),
        revivedFrom: project.revivedFrom ?? undefined,
        createdAt: project.createdAt.toISOString(),
        owner: {
          _id: project.owner.id,
          name: project.owner.name,
          username: project.owner.username,
          avatarUrl: project.owner.avatarUrl ?? undefined,
          bio: project.owner.bio ?? undefined,
        },
        collaborators: project.members
          .filter((m) => m.user.id !== project.owner.id)
          .map((m) => ({
            _id: m.user.id,
            name: m.user.name,
            username: m.user.username,
            avatarUrl: m.user.avatarUrl ?? undefined,
          })),
        // Roles are shown on the team, so "who is the designer here" is
        // answerable without asking in a group chat.
        team: project.members.map((m) => ({
          _id: m.user.id,
          name: m.user.name,
          username: m.user.username,
          avatarUrl: m.user.avatarUrl ?? undefined,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          isOwner: m.user.id === project.owner.id,
        })),
        viewer: {
          isOwner: project.owner.id === membership.userId,
          isMember: project.members.some((m) => m.userId === membership.userId),
          joinRequest: project.joinRequests[0]
            ? {
                _id: project.joinRequests[0].id,
                status: project.joinRequests[0].status.toLowerCase(),
                role: project.joinRequests[0].role,
              }
            : null,
        },
        milestones: project.milestones,
        proofs,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch project", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

/** Fields an owner may edit. Anything not listed here is not editable by API. */
const EDITABLE = [
  "title",
  "tagline",
  "problem",
  "solution",
  "track",
  "tags",
  "skillsNeeded",
  "coverImage",
  "githubUrl",
  "demoUrl",
] as const;

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
      "project:update",
      membership.userId,
      "You are editing too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const existing = await prisma.project.findFirst({
      where: { tenantId: membership.tenantId, OR: [{ id }, { slug: id }] },
      select: { id: true, ownerId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.ownerId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    // Allowlist, not the raw body. The previous implementation passed the whole
    // request body to the update, so a caller could set status, owner or score.
    const data: Record<string, unknown> = {};
    for (const field of EDITABLE) {
      if (field in body) data[field] = body[field];
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }

    const merged = await prisma.project.findUniqueOrThrow({
      where: { id: existing.id },
      select: {
        title: true, tagline: true, problem: true, solution: true,
        tags: true, track: true, coverImage: true, githubUrl: true, demoUrl: true,
      },
    });

    const next = { ...merged, ...data } as typeof merged;
    const briefCompleteness = calculateHealthScore({
      title: next.title,
      tagline: next.tagline ?? undefined,
      problem: next.problem,
      solution: next.solution,
      tags: next.tags,
      track: next.track,
      coverImage: next.coverImage ?? undefined,
      githubUrl: next.githubUrl ?? undefined,
      demoUrl: next.demoUrl ?? undefined,
    });

    const updated = await prisma.project.update({
      where: { id: existing.id },
      data: { ...data, briefCompleteness },
      select: { id: true, slug: true, title: true, briefCompleteness: true },
    });

    return NextResponse.json({ data: { ...updated, _id: updated.id } });
  } catch (error) {
    logger.error("Failed to update project", { error: String(error) });
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

/**
 * Archiving, not deletion.
 *
 * A hard delete would destroy the evidence, the ledger provenance and the
 * postmortem — the three things this product exists to keep. Archived projects
 * stay readable and can be revived by a later team.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "project:update",
      membership.userId,
      "You are editing too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const existing = await prisma.project.findFirst({
      where: { tenantId: membership.tenantId, OR: [{ id }, { slug: id }] },
      select: { id: true, ownerId: true, archivedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.ownerId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.archivedAt) {
      return NextResponse.json({ error: "Already archived" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const postmortem = typeof body.postmortem === "string" ? body.postmortem.trim() : "";

    // A postmortem is the price of archiving. Without it the archive is a
    // graveyard rather than institutional memory, and nothing can be revived
    // usefully from it.
    if (postmortem.length < 80) {
      return NextResponse.json(
        {
          error:
            "Archiving requires a postmortem of at least 80 characters: what happened, what is worth keeping, what a future team should do differently.",
        },
        { status: 422 }
      );
    }

    await prisma.$transaction([
      prisma.project.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          postmortem,
          outcome: body.outcome ?? "PAUSED",
        },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: "project.archived",
          targetType: "project",
          targetId: existing.id,
        },
      }),
    ]);

    return NextResponse.json({ data: { archived: true } });
  } catch (error) {
    logger.error("Failed to archive project", { error: String(error) });
    return NextResponse.json({ error: "Failed to archive project" }, { status: 500 });
  }
}
