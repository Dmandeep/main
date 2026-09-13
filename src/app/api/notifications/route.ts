import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { markAllAsRead, markAsRead } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: membership.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          href: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: membership.userId, isRead: false } }),
    ]);

    return NextResponse.json({
      data: notifications.map((n) => ({
        _id: n.id,
        type: n.type.toLowerCase(),
        title: n.title,
        body: n.body,
        linkUrl: n.href ?? undefined,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      meta: { unreadCount },
    });
  } catch (error) {
    logger.error("Failed to fetch notifications", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "notification:read",
      membership.userId,
      "Too many requests. Try again shortly."
    );
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));

    // Both paths are scoped by userId, so a guessed id cannot mark someone
    // else's notification as read.
    if (body.all === true) {
      const result = await markAllAsRead(membership.userId);
      return NextResponse.json({ data: { updated: result.count } });
    }

    if (typeof body.id === "string") {
      const result = await markAsRead(body.id, membership.userId);
      return NextResponse.json({ data: { updated: result.count } });
    }

    return NextResponse.json({ error: "Supply `id` or `all: true`" }, { status: 400 });
  } catch (error) {
    logger.error("Failed to update notifications", { error: String(error) });
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
