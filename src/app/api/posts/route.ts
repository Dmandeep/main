import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";
import { canModerate, canPost } from "@/lib/communities/access";

/**
 * Posts.
 *
 * Posts existed in the schema, were rendered by the feed, and were created by
 * nothing but the seed — so the department could read three posts written by a
 * fixture and no student could ever write a fourth. Saying something to the
 * people around you is the most basic act a community platform has, and it was
 * the one thing missing.
 *
 * A post always points at something real: a community or a project. The schema
 * comment says so and this enforces it. A post attached to nothing is a status
 * update, and the product has no use for those — it is the difference between
 * "here is what my team learned" and "good morning".
 */

const createSchema = z
  .object({
    body: z
      .string()
      .min(10, "Say a little more than that.")
      .max(2000, "Keep it shorter than this — link to the detail."),
    kind: z.enum(["UPDATE", "MILESTONE", "ASK_FOR_HELP", "SHOWCASE", "ANNOUNCEMENT"]).default("UPDATE"),
    communityId: z.string().optional(),
    projectId: z.string().optional(),
  })
  .refine((v) => Boolean(v.communityId) || Boolean(v.projectId), {
    message: "Post it to a community or a project.",
    path: ["communityId"],
  });

export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "post:create",
      membership.userId,
      "You are posting too quickly. Try again shortly."
    );
    if (limited) return limited;

    const data = createSchema.parse(await req.json());

    // Posting into a community is governed by exactly the same rule as posting
    // a message there — membership, not staff role, and never while muted or
    // while a join request is still pending.
    if (data.communityId) {
      const community = await prisma.community.findFirst({
        where: { id: data.communityId, tenantId: membership.tenantId },
        select: {
          id: true,
          visibility: true,
          kind: true,
          archivedAt: true,
          members: {
            where: { userId: membership.userId },
            select: { role: true, status: true, leftAt: true, mutedUntil: true },
          },
        },
      });

      if (!community) {
        return NextResponse.json({ error: "Community not found" }, { status: 404 });
      }

      const decision = canPost(community, {
        role: membership.role,
        membership: community.members[0] ?? null,
      });

      if (!decision.allowed) {
        return NextResponse.json({ error: decision.message }, { status: 403 });
      }
    }

    // Posting to a project is for the people building it. Anyone else has the
    // join request, which is the front door.
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, tenantId: membership.tenantId },
        select: {
          id: true,
          ownerId: true,
          members: {
            where: { userId: membership.userId, leftAt: null },
            select: { id: true },
          },
        },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const onTeam = project.ownerId === membership.userId || project.members.length > 0;
      if (!onTeam) {
        return NextResponse.json(
          { error: "Only people on this project can post updates about it." },
          { status: 403 }
        );
      }
    }

    const post = await prisma.post.create({
      data: {
        tenantId: membership.tenantId,
        authorId: membership.userId,
        body: data.body.trim(),
        kind: data.kind,
        communityId: data.communityId ?? null,
        projectId: data.projectId ?? null,
      },
      select: {
        id: true,
        body: true,
        kind: true,
        createdAt: true,
        author: { select: { name: true, username: true, avatarUrl: true } },
        community: { select: { slug: true, name: true } },
        project: { select: { slug: true, title: true } },
      },
    });

    return NextResponse.json(
      {
        data: {
          _id: post.id,
          type: "post",
          body: post.body,
          postKind: post.kind.toLowerCase(),
          author: post.author,
          community: post.community,
          project: post.project,
          createdAt: post.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to create a post", { error: String(error) });
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}

const deleteSchema = z.object({ id: z.string() });

/**
 * Remove a post.
 *
 * Soft, always. `removedAt` keeps the row so moderation is auditable and a
 * removal can be explained; hard-deleting would let a moderator erase the fact
 * that they removed something.
 */
export async function DELETE(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = deleteSchema.parse(await req.json());

    const post = await prisma.post.findFirst({
      where: { id, tenantId: membership.tenantId, removedAt: null },
      select: {
        id: true,
        authorId: true,
        community: {
          select: {
            visibility: true,
            kind: true,
            archivedAt: true,
            members: {
              where: { userId: membership.userId },
              select: { role: true, status: true, leftAt: true, mutedUntil: true },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAuthor = post.authorId === membership.userId;
    const moderates = post.community
      ? canModerate(post.community, {
          role: membership.role,
          membership: post.community.members[0] ?? null,
        }).allowed
      : false;

    if (!isAuthor && !moderates) {
      return NextResponse.json(
        { error: "Only the author or a moderator can remove this." },
        { status: 403 }
      );
    }

    await prisma.post.update({ where: { id: post.id }, data: { removedAt: new Date() } });

    await prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        actorId: membership.userId,
        action: isAuthor ? "post.deleted_by_author" : "post.removed_by_moderator",
        targetType: "post",
        targetId: post.id,
        diff: {},
      },
    });

    return NextResponse.json({ data: { removed: post.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    logger.error("Failed to remove a post", { error: String(error) });
    return NextResponse.json({ error: "Failed to remove the post" }, { status: 500 });
  }
}
