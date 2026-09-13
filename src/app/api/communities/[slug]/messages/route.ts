import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { canModerate, canPost, canRead } from "@/lib/communities/access";

/**
 * Community messages.
 *
 * v1 stores plaintext deliberately. See docs/design/CAMPUS-ECOSYSTEM.md: an
 * unaudited encryption claim is worse than an honest absence of one, and
 * moderation only works on content the server can read. The `contentType` and
 * `envelope` columns exist so MLS ciphertext can replace this without
 * migrating the table.
 */

async function loadContext(slug: string, tenantId: string, userId: string) {
  const community = await prisma.community.findFirst({
    where: { tenantId, slug },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      visibility: true,
      archivedAt: true,
      projectId: true,
      members: {
        where: { userId },
        select: { role: true, status: true, leftAt: true, mutedUntil: true },
      },
    },
  });

  if (!community) return null;

  // A PROJECT community is readable by the project's team without a separate
  // join, so the parent membership has to be resolved too.
  let isOnParentProject = false;
  if (community.kind === "PROJECT" && community.projectId) {
    isOnParentProject = Boolean(
      await prisma.projectMembership.findFirst({
        where: { projectId: community.projectId, userId, leftAt: null },
        select: { id: true },
      })
    );
  }

  return { community, membership: community.members[0] ?? null, isOnParentProject };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const viewer = await getActiveMembership();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const ctx = await loadContext(slug, viewer.tenantId, viewer.userId);
    if (!ctx) return NextResponse.json({ error: "Community not found" }, { status: 404 });

    const read = canRead(ctx.community, {
      role: viewer.role,
      membership: ctx.membership,
      isOnParentProject: ctx.isOnParentProject,
    });

    if (!read.allowed) {
      // 404 rather than 403: confirming a private community exists is itself
      // a disclosure.
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
    const before = searchParams.get("before");

    const messages = await prisma.communityMessage.findMany({
      where: {
        communityId: ctx.community.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        body: true,
        contentType: true,
        createdAt: true,
        editedAt: true,
        removedAt: true,
        removedReason: true,
        replyToId: true,
        author: { select: userRefSelect },
      },
    });

    const post = canPost(ctx.community, {
      role: viewer.role,
      membership: ctx.membership,
      isOnParentProject: ctx.isOnParentProject,
    });

    return NextResponse.json({
      data: messages.reverse().map((m) => ({
        _id: m.id,
        // A removed message keeps its row so the audit trail survives, but the
        // body never goes back over the wire.
        body: m.removedAt ? null : m.body,
        removed: Boolean(m.removedAt),
        removedReason: m.removedAt ? (m.removedReason ?? "Removed by a moderator") : undefined,
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
        replyToId: m.replyToId,
        author: {
          _id: m.author.id,
          name: m.author.name,
          username: m.author.username,
          avatarUrl: m.author.avatarUrl ?? undefined,
        },
      })),
      meta: {
        community: {
          _id: ctx.community.id,
          slug: ctx.community.slug,
          name: ctx.community.name,
          kind: ctx.community.kind.toLowerCase(),
          archived: Boolean(ctx.community.archivedAt),
        },
        canPost: post.allowed,
        // Drives the join-request panel. Same rule as the actions on each
        // message, so what a moderator can see and what they can do agree.
        canModerate: canModerate(ctx.community, {
          role: viewer.role,
          membership: ctx.membership,
          isOnParentProject: ctx.isOnParentProject,
        }).allowed,
        postBlockedReason: post.allowed ? null : post.reason,
        postBlockedMessage: post.allowed ? null : post.message,
        // Stated plainly so no part of the UI can imply otherwise.
        encryption: "transport-only",
      },
    });
  } catch (error) {
    logger.error("Failed to fetch messages", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

const sendSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000),
  replyToId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const viewer = await getActiveMembership();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await rateLimit("message:send", viewer.userId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "You are sending messages too quickly." },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const { slug } = await params;
    const ctx = await loadContext(slug, viewer.tenantId, viewer.userId);
    if (!ctx) return NextResponse.json({ error: "Community not found" }, { status: 404 });

    const decision = canPost(ctx.community, {
      role: viewer.role,
      membership: ctx.membership,
      isOnParentProject: ctx.isOnParentProject,
    });

    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, reason: decision.reason },
        { status: 403 }
      );
    }

    const data = sendSchema.parse(await req.json());

    // A reply must belong to the same community, or a message could be
    // threaded onto a conversation the author cannot see.
    if (data.replyToId) {
      const parent = await prisma.communityMessage.findFirst({
        where: { id: data.replyToId, communityId: ctx.community.id },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "That message is not in this community." }, { status: 422 });
      }
    }

    const message = await prisma.communityMessage.create({
      data: {
        communityId: ctx.community.id,
        authorId: viewer.userId,
        body: data.body,
        contentType: "PLAINTEXT",
        replyToId: data.replyToId ?? null,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        replyToId: true,
        author: { select: userRefSelect },
      },
    });

    const messageData = {
      _id: message.id,
      body: message.body,
      removed: false,
      createdAt: message.createdAt.toISOString(),
      replyToId: message.replyToId,
      author: {
        _id: message.author.id,
        name: message.author.name,
        username: message.author.username,
        avatarUrl: message.author.avatarUrl ?? undefined,
      },
    };

    try {
      // Dynamic import to avoid module init issues if needed, or just import at top.
      const { pusherServer } = await import("@/lib/pusher");
      await pusherServer.trigger(`community-${ctx.community.slug}`, "message-new", messageData);
    } catch (err) {
      logger.warn("Message broadcast failed", { error: String(err) });
    }

    return NextResponse.json(
      {
        data: messageData,
      },
      { status: 201, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to send message", { error: String(error) });
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
