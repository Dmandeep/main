import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notify";
import { recomputeStanding } from "@/lib/standing/recompute";
import { reconcileEvidenceCounts } from "@/lib/projects/reconcile";
import { renumberWaitlist } from "@/lib/events/waitlist";
import type { MaintenanceJob, NotificationJob } from "./jobs";

/**
 * What jobs actually do.
 *
 * Kept apart from both the producer and the worker process so the same code
 * runs whether a job was queued or executed inline. Two implementations of
 * "recompute standing" — one for the queue, one for the fallback — would
 * eventually disagree, and the one nobody tests would be the one that runs on
 * the box with no Redis.
 */

/**
 * Fill seats that opened up.
 *
 * Cancellations leave a gap between the seats an event holds and its capacity,
 * and nothing in the request path closes it: the person who cancelled is gone
 * by then. This promotes from the waitlist in position order and tells the
 * people who got in.
 *
 * Reserved seats are not backfilled from the general waitlist. A newcomer seat
 * that frees up stays a newcomer seat — handing it to whoever is next in line
 * would quietly convert the quota into ordinary capacity over a term.
 */
async function sweepWaitlists(tenantId: string) {
  const events = await prisma.campusEvent.findMany({
    where: { tenantId, status: "SCHEDULED", capacity: { not: null } },
    select: { id: true, title: true, capacity: true, newcomerQuotaPercent: true },
  });

  let promoted = 0;

  for (const event of events) {
    const capacity = event.capacity!;

    const [held, waiting] = await Promise.all([
      prisma.eventRegistration.count({
        where: { eventId: event.id, status: { in: ["REGISTERED", "ATTENDED"] } },
      }),
      prisma.eventRegistration.findMany({
        where: { eventId: event.id, status: "WAITLISTED" },
        orderBy: [{ waitlistPosition: "asc" }, { registeredAt: "asc" }],
        select: { id: true, userId: true },
      }),
    ]);

    const free = capacity - held;

    // Renumber regardless of whether a seat is free. Holes are left by
    // cancellations and manual removals too, and an over-capacity event —
    // which a faculty override can produce — would otherwise never have its
    // waitlist tidied at all.
    if (free <= 0 || waiting.length === 0) {
      await renumberWaitlist(event.id);
      continue;
    }

    for (const registration of waiting.slice(0, free)) {
      await prisma.$transaction([
        prisma.eventRegistration.update({
          where: { id: registration.id },
          data: { status: "REGISTERED", allocation: "OPEN", waitlistPosition: null },
        }),
        prisma.auditLog.create({
          data: {
            tenantId,
            actorId: null,
            action: "event_registration.promoted_by_sweep",
            targetType: "event_registration",
            targetId: registration.id,
            diff: { eventId: event.id, reason: "seat freed" },
          },
        }),
      ]);

      await createNotification({
        tenantId,
        userId: registration.userId,
        type: "EVENT_WAITLIST_PROMOTED",
        title: "A seat opened up",
        body: `You now have a seat at "${event.title}".`,
        href: "/events",
      });

      promoted++;
    }

    await renumberWaitlist(event.id);
  }

  return { eventsChecked: events.length, promoted };
}

export async function runMaintenanceJob(job: MaintenanceJob) {
  switch (job.name) {
    case "recompute-standing": {
      const result = await recomputeStanding(job.data.tenantId);
      logger.info("Standing recomputed", {
        tenantId: job.data.tenantId,
        updated: result?.membershipsUpdated ?? 0,
        drifted: result?.drifted.length ?? 0,
      });
      return result;
    }

    case "reconcile-evidence": {
      const result = await reconcileEvidenceCounts(job.data.tenantId);
      if (result.projectsCorrected > 0) {
        // Drift here means something wrote verified evidence without going
        // through the verification handler. Worth a louder line than "done".
        logger.warn("Evidence counters had drifted", {
          corrected: result.projectsCorrected,
          checked: result.projectsChecked,
        });
      }
      return result;
    }

    case "sweep-waitlists": {
      const result = await sweepWaitlists(job.data.tenantId);
      if (result.promoted > 0) {
        logger.info("Waitlist sweep promoted registrations", result);
      }
      return result;
    }
  }
}

export async function runNotificationJob(job: NotificationJob) {
  const { tenantId, userId, type, title, body, href } = job.data;
  return createNotification({
    tenantId,
    userId,
    type: type as NotificationType,
    title,
    body,
    href,
  });
}
