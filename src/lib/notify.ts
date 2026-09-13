import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { logger } from "@/lib/logger";

export interface NotifyInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Where clicking it goes. A notification with no destination is noise. */
  href?: string;
}

export async function createNotification(input: NotifyInput) {
  const notif = await prisma.notification.create({ data: input });
  try {
    await pusherServer.trigger(`user-${input.userId}`, "notification-new", notif);
  } catch (error) {
    logger.warn("Notification broadcast failed", { error: String(error) });
  }
  return notif;
}

/** Bulk notify — one insert, not N. */
export async function createNotifications(inputs: NotifyInput[]) {
  if (inputs.length === 0) return { count: 0 };
  const res = await prisma.notification.createMany({ data: inputs });
  
  // Best-effort realtime for bulk notifications
  try {
    const byUser = inputs.reduce((acc, input) => {
      acc[input.userId] = (acc[input.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    await Promise.all(
      Object.keys(byUser).map(userId =>
        pusherServer.trigger(`user-${userId}`, "notifications-bulk", { count: byUser[userId] })
      )
    );
  } catch (error) {
    logger.warn("Bulk notification broadcast failed", { error: String(error) });
  }
  
  return res;
}

export async function markAsRead(notificationId: string, userId: string) {
  // Scoped by userId so a guessed id cannot mark someone else's row.
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
