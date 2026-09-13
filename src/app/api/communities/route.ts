import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import { isStaff } from "@/lib/authz/permissions";

/**
 * Communities the viewer can see.
 *
 * Private communities are filtered out at the query rather than after
 * serialising, so a community the viewer may not read never leaves the
 * database. Filtering in the handler is how that kind of leak happens.
 */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    const mineOnly = searchParams.get("mine") === "true";

    const visibilityScope: Prisma.CommunityWhereInput = isStaff(membership.role)
      ? {}
      : {
          OR: [
            { visibility: { in: ["CAMPUS", "REQUEST_TO_JOIN"] } },
            { members: { some: { userId: membership.userId, leftAt: null } } },
            // A project's private room is readable by the people on the project.
            { kind: "PROJECT", project: { members: { some: { userId: membership.userId, leftAt: null } } } },
          ],
        };

    const communities = await prisma.community.findMany({
      where: {
        tenantId: membership.tenantId,
        archivedAt: null,
        ...(kind ? { kind: kind.toUpperCase() as Prisma.CommunityWhereInput["kind"] } : {}),
        ...(mineOnly ? { members: { some: { userId: membership.userId, leftAt: null } } } : {}),
        ...visibilityScope,
      },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        kind: true,
        visibility: true,
        isSystemManaged: true,
        batchYear: true,
        project: { select: { id: true, slug: true, title: true } },
        members: {
          where: { userId: membership.userId },
          select: { role: true, status: true, leftAt: true, lastReadAt: true },
        },
        // Pending requests, so a moderator sees there is something to answer
        // without opening every room.
        _count: { select: { members: true, messages: true } },
      },
    });

    // One grouped query rather than a count per row.
    const pending = await prisma.communityMember.groupBy({
      by: ["communityId"],
      where: {
        status: "PENDING",
        leftAt: null,
        communityId: { in: communities.map((c) => c.id) },
      },
      _count: { _all: true },
    });
    const pendingByCommunity = new Map(pending.map((p) => [p.communityId, p._count._all]));

    return NextResponse.json({
      data: communities.map((c) => {
        const mine = c.members[0];
        return {
          _id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          kind: c.kind.toLowerCase(),
          visibility: c.visibility.toLowerCase(),
          isSystemManaged: c.isSystemManaged,
          batchYear: c.batchYear ?? undefined,
          project: c.project ?? undefined,
          memberCount: c._count.members,
          messageCount: c._count.messages,
          viewer: {
            // PENDING is not membership. Reporting it as such would let the
            // UI offer a post box to someone who cannot post.
            isMember: Boolean(mine && !mine.leftAt && mine.status === "ACTIVE"),
            awaitingApproval: Boolean(mine && !mine.leftAt && mine.status === "PENDING"),
            role: mine?.role.toLowerCase() ?? null,
            lastReadAt: mine?.lastReadAt?.toISOString() ?? null,
          },
          pendingRequests: pendingByCommunity.get(c.id) ?? 0,
        };
      }),
    });
  } catch (error) {
    logger.error("Failed to fetch communities", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch communities" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(3, "Give it a name of at least 3 characters.").max(60),
  description: z.string().min(20, "Say what this community is for.").max(400),
  visibility: z.enum(["CAMPUS", "REQUEST_TO_JOIN"]).default("CAMPUS"),
});

/**
 * Create an interest community.
 *
 * Only INTEREST communities can be created by hand. PROJECT, BATCH and EVENT
 * communities are created by the thing they belong to, so that a channel
 * always has a real parent and cannot be orphaned.
 */
export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await rateLimit("default", membership.userId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "You are creating communities too quickly. Try again shortly." },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const data = createSchema.parse(await req.json());
    const base = slugify(data.name);

    for (let attempt = 0; ; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      try {
        const community = await prisma.community.create({
          data: {
            tenantId: membership.tenantId,
            slug,
            name: data.name,
            description: data.description,
            kind: "INTEREST",
            visibility: data.visibility,
            // The creator is the owner and a member from the start; a channel
            // with nobody in it cannot be moderated.
            members: {
              create: { userId: membership.userId, role: "OWNER" },
            },
          },
          select: { id: true, slug: true, name: true },
        });

        await prisma.auditLog.create({
          data: {
            tenantId: membership.tenantId,
            actorId: membership.userId,
            action: "community.created",
            targetType: "community",
            targetId: community.id,
            diff: { name: community.name, visibility: data.visibility },
          },
        });

        return NextResponse.json({ data: { _id: community.id, ...community } }, { status: 201 });
      } catch (error) {
        const clash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!clash || attempt >= 5) throw error;
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to create community", { error: String(error) });
    return NextResponse.json({ error: "Failed to create community" }, { status: 500 });
  }
}
