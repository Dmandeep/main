import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";
import { canJoinDirectly, needsApproval } from "@/lib/communities/access";
import { createNotifications } from "@/lib/notify";

/** Join a community, or rejoin one previously left. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const viewer = await getActiveMembership();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await enforceRateLimit(
      "community:join",
      viewer.userId,
      "You are joining and leaving too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { slug } = await params;
    const community = await prisma.community.findFirst({
      where: { tenantId: viewer.tenantId, slug },
      select: {
        id: true,
        name: true,
        kind: true,
        visibility: true,
        archivedAt: true,
        isSystemManaged: true,
      },
    });
    if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

    // Batch, project and event rooms follow the thing they belong to. Joining
    // one by hand would create a member the parent does not know about.
    if (community.isSystemManaged) {
      return NextResponse.json(
        {
          error:
            "You are in this community because of your batch, project or event registration. It is not joined by hand.",
        },
        { status: 409 }
      );
    }

    // Request to join. This used to be a dead end: the handler said a
    // moderator had to approve, and offered no way to ask one.
    if (needsApproval(community)) {
      if (community.archivedAt) {
        return NextResponse.json(
          { error: "This community is archived." },
          { status: 409 }
        );
      }

      const request = await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId: viewer.userId } },
        create: {
          communityId: community.id,
          userId: viewer.userId,
          role: "MEMBER",
          status: "PENDING",
        },
        // Re-asking after leaving reopens the same row rather than stacking
        // duplicates. An already-approved member is left approved: asking
        // twice must never demote someone who is already in.
        update: { leftAt: null },
        select: { status: true },
      });

      // Tell the people who can answer. A request that sits unseen is the
      // same dead end with extra steps.
      if (request.status === "PENDING") {
        const moderators = await prisma.communityMember.findMany({
          where: {
            communityId: community.id,
            status: "ACTIVE",
            leftAt: null,
            role: { in: ["OWNER", "MODERATOR"] },
          },
          select: { userId: true },
        });

        await createNotifications(
          moderators.map((m) => ({
            tenantId: viewer.tenantId,
            userId: m.userId,
            type: "JOIN_REQUEST" as const,
            title: "Someone asked to join",
            body: `A student asked to join ${community.name}.`,
            href: `/communities/${slug}`,
          }))
        );
      }

      return NextResponse.json({
        data: {
          joined: request.status === "ACTIVE",
          pending: request.status === "PENDING",
          community: community.name,
        },
      });
    }

    if (!canJoinDirectly(community)) {
      return NextResponse.json(
        { error: "This community is not open to join." },
        { status: 403 }
      );
    }

    // Upsert so rejoining after leaving restores the same row and its history
    // rather than creating a duplicate membership.
    const membership = await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: viewer.userId } },
      create: { communityId: community.id, userId: viewer.userId, role: "MEMBER" },
      update: { leftAt: null },
      select: { id: true, role: true },
    });

    return NextResponse.json({
      data: { joined: true, role: membership.role.toLowerCase(), community: community.name },
    });
  } catch (error) {
    logger.error("Failed to join community", { error: String(error) });
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }
}

/** Leave a community. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const viewer = await getActiveMembership();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await enforceRateLimit(
      "community:join",
      viewer.userId,
      "You are joining and leaving too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { slug } = await params;
    const community = await prisma.community.findFirst({
      where: { tenantId: viewer.tenantId, slug },
      select: { id: true, isSystemManaged: true },
    });
    if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

    if (community.isSystemManaged) {
      return NextResponse.json(
        { error: "You cannot leave your batch, project or event community." },
        { status: 409 }
      );
    }

    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: viewer.userId } },
      select: { id: true, role: true, leftAt: true },
    });

    if (!existing || existing.leftAt) {
      return NextResponse.json({ error: "You are not in this community." }, { status: 409 });
    }

    // The last owner leaving would make the community unmoderatable.
    if (existing.role === "OWNER") {
      const otherOwners = await prisma.communityMember.count({
        where: {
          communityId: community.id,
          role: "OWNER",
          leftAt: null,
          NOT: { userId: viewer.userId },
        },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: "Make someone else an owner before you leave, or the community loses its moderator." },
          { status: 409 }
        );
      }
    }

    await prisma.communityMember.update({
      where: { id: existing.id },
      data: { leftAt: new Date() },
    });

    return NextResponse.json({ data: { left: true } });
  } catch (error) {
    logger.error("Failed to leave community", { error: String(error) });
    return NextResponse.json({ error: "Failed to leave" }, { status: 500 });
  }
}
