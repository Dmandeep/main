import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";
import { canModerate } from "@/lib/communities/access";
import { createNotification } from "@/lib/notify";

/**
 * Pending join requests for one community.
 *
 * The other half of request-to-join. A request a moderator cannot see is the
 * same dead end as a community you cannot ask to join — it just moves where
 * the student waits.
 *
 * Who may answer comes from the same `canModerate` used everywhere else, so a
 * community owner, a moderator, and campus staff all resolve identically here
 * and on the message actions.
 */

async function loadForModerator(slug: string) {
  const viewer = await getActiveMembership();
  if (!viewer) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const community = await prisma.community.findFirst({
    where: { tenantId: viewer.tenantId, slug },
    select: {
      id: true,
      name: true,
      kind: true,
      visibility: true,
      archivedAt: true,
      members: {
        where: { userId: viewer.userId },
        select: { role: true, status: true, leftAt: true, mutedUntil: true },
      },
    },
  });

  if (!community) {
    return { error: NextResponse.json({ error: "Community not found" }, { status: 404 }) };
  }

  const decision = canModerate(community, {
    role: viewer.role,
    membership: community.members[0] ?? null,
  });

  if (!decision.allowed) {
    return { error: NextResponse.json({ error: decision.message }, { status: 403 }) };
  }

  return { viewer, community };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const loaded = await loadForModerator(slug);
    if ("error" in loaded) return loaded.error;

    const requests = await prisma.communityMember.findMany({
      where: { communityId: loaded.community.id, status: "PENDING", leftAt: null },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        joinedAt: true,
        user: { select: userRefSelect },
      },
    });

    return NextResponse.json({
      data: requests.map((r) => ({
        _id: r.id,
        requestedAt: r.joinedAt.toISOString(),
        user: {
          _id: r.user.id,
          name: r.user.name,
          username: r.user.username,
          avatarUrl: r.user.avatarUrl ?? undefined,
        },
      })),
    });
  } catch (error) {
    logger.error("Failed to list join requests", { error: String(error) });
    return NextResponse.json({ error: "Failed to load join requests" }, { status: 500 });
  }
}

const decisionSchema = z.object({
  memberId: z.string(),
  decision: z.enum(["approve", "reject"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const loaded = await loadForModerator(slug);
    if ("error" in loaded) return loaded.error;
    const { viewer, community } = loaded;

    const limited = await enforceRateLimit(
      "community:join",
      viewer.userId,
      "You are answering requests too quickly. Try again shortly."
    );
    if (limited) return limited;

    const body = decisionSchema.parse(await req.json());

    const request = await prisma.communityMember.findFirst({
      where: { id: body.memberId, communityId: community.id, status: "PENDING" },
      select: { id: true, userId: true },
    });

    if (!request) {
      return NextResponse.json(
        { error: "That request has already been answered." },
        { status: 409 }
      );
    }

    if (body.decision === "approve") {
      await prisma.communityMember.update({
        where: { id: request.id },
        data: { status: "ACTIVE", joinedAt: new Date() },
      });
    } else {
      // Rejection removes the row rather than keeping a tombstone, so the
      // student can ask again later. A permanent refusal is a block, which is
      // a different thing and should look like one.
      await prisma.communityMember.delete({ where: { id: request.id } });
    }

    await prisma.auditLog.create({
      data: {
        tenantId: viewer.tenantId,
        actorId: viewer.userId,
        action: `community.join_${body.decision}d`,
        targetType: "community_member",
        targetId: request.id,
        diff: { communityId: community.id, userId: request.userId },
      },
    });

    if (body.decision === "approve") {
      await createNotification({
        tenantId: viewer.tenantId,
        userId: request.userId,
        // JOIN_DECISION already covers this; adding a near-identical enum
        // value would mean a migration for no new meaning.
        type: "JOIN_DECISION",
        title: "You are in",
        body: `Your request to join ${community.name} was approved.`,
        href: `/communities/${slug}`,
      });
    }

    return NextResponse.json({ data: { decision: body.decision, memberId: request.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to answer a join request", { error: String(error) });
    return NextResponse.json({ error: "Failed to answer the request" }, { status: 500 });
  }
}
