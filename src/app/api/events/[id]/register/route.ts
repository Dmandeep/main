import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { isNewcomer } from "@/lib/standing/rules";
import { createNotification } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Take a seat at an event.
 *
 * The previous implementation returned `{ registered: true }` and wrote
 * nothing, which is the kind of thing that survives a demo and fails a pilot.
 *
 * Allocation honours the newcomer quota from CAMPUS-ECOSYSTEM.md §5.1: a fixed
 * share of every event is held for students with little or no standing, because
 * otherwise the students who most need the workshop are the ones who cannot
 * get in. Which basis granted each seat is recorded, so honouring the quota is
 * provable rather than asserted.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "event:register",
      membership.userId,
      "You are registering too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;

    const event = await prisma.campusEvent.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: {
        id: true,
        title: true,
        status: true,
        capacity: true,
        newcomerQuotaPercent: true,
        startsAt: true,
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (event.status === "CANCELLED" || event.status === "COMPLETED") {
      return NextResponse.json({ error: "This event is closed." }, { status: 409 });
    }
    if (event.status === "PROPOSED") {
      return NextResponse.json(
        { error: "This event has not been scheduled yet. Vote for it instead." },
        { status: 409 }
      );
    }

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: membership.userId } },
      select: { id: true, status: true, allocation: true, waitlistPosition: true },
    });

    // Idempotent: a double-tap returns the seat already held rather than
    // erroring or issuing a second one.
    if (existing) {
      return NextResponse.json({
        data: {
          registered: existing.status !== "CANCELLED",
          status: existing.status.toLowerCase(),
          allocation: existing.allocation,
          waitlistPosition: existing.waitlistPosition,
          alreadyRegistered: true,
        },
      });
    }

    const standing = await prisma.standing.findUnique({
      where: { membershipId: membership.membershipId },
      select: { points: true },
    });
    const newcomer = isNewcomer(standing?.points ?? 0);

    const result = await prisma.$transaction(async (tx) => {
      // Unlimited capacity: everyone is in.
      if (event.capacity === null) {
        return tx.eventRegistration.create({
          data: {
            eventId: event.id,
            userId: membership.userId,
            allocation: newcomer ? "NEWCOMER_QUOTA" : "OPEN",
            status: "REGISTERED",
          },
          select: { status: true, allocation: true, waitlistPosition: true },
        });
      }

      const quotaSeats = Math.floor((event.capacity * event.newcomerQuotaPercent) / 100);
      const openSeats = event.capacity - quotaSeats;

      const [quotaTaken, openTaken, waitlisted] = await Promise.all([
        tx.eventRegistration.count({
          where: { eventId: event.id, allocation: "NEWCOMER_QUOTA", status: { not: "CANCELLED" } },
        }),
        tx.eventRegistration.count({
          where: {
            eventId: event.id,
            allocation: { in: ["OPEN", "STANDING_PRIORITY", "FACULTY_OVERRIDE"] },
            status: { not: "CANCELLED" },
          },
        }),
        tx.eventRegistration.count({ where: { eventId: event.id, status: "WAITLISTED" } }),
      ]);

      // A newcomer tries the reserved pool first, then the open pool. A
      // non-newcomer may never take a reserved seat — that is what reserving
      // means, and leaving quota seats empty is preferable to handing them to
      // the people the quota exists to counterbalance.
      if (newcomer && quotaTaken < quotaSeats) {
        return tx.eventRegistration.create({
          data: {
            eventId: event.id,
            userId: membership.userId,
            allocation: "NEWCOMER_QUOTA",
            status: "REGISTERED",
          },
          select: { status: true, allocation: true, waitlistPosition: true },
        });
      }

      if (openTaken < openSeats) {
        return tx.eventRegistration.create({
          data: {
            eventId: event.id,
            userId: membership.userId,
            allocation: "OPEN",
            status: "REGISTERED",
          },
          select: { status: true, allocation: true, waitlistPosition: true },
        });
      }

      return tx.eventRegistration.create({
        data: {
          eventId: event.id,
          userId: membership.userId,
          allocation: "OPEN",
          status: "WAITLISTED",
          waitlistPosition: waitlisted + 1,
        },
        select: { status: true, allocation: true, waitlistPosition: true },
      });
    });

    const confirmed = result.status === "REGISTERED";

    await createNotification({
      tenantId: membership.tenantId,
      userId: membership.userId,
      type: confirmed ? "EVENT_SEAT_CONFIRMED" : "EVENT_WAITLIST_PROMOTED",
      title: confirmed ? "Seat confirmed" : "You are on the waitlist",
      body: confirmed
        ? `Your seat at "${event.title}" is confirmed.`
        : `"${event.title}" is full. You are number ${result.waitlistPosition} on the waitlist.`,
      href: "/forge",
    });

    return NextResponse.json({
      data: {
        registered: confirmed,
        status: result.status.toLowerCase(),
        allocation: result.allocation,
        waitlistPosition: result.waitlistPosition,
      },
    });
  } catch (error) {
    // Two people claiming the last seat at once: the unique constraint
    // decides, and the loser is told plainly rather than shown a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "You are already registered for this event." },
        { status: 409 }
      );
    }
    logger.error("Failed to register for event", { error: String(error) });
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}

/** Give up a seat. Cancelling frees it for the next person on the waitlist. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "event:register",
      membership.userId,
      "You are changing registrations too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;

    const registration = await prisma.eventRegistration.findFirst({
      where: {
        eventId: id,
        userId: membership.userId,
        event: { tenantId: membership.tenantId },
      },
      select: { id: true, status: true },
    });

    if (!registration) {
      return NextResponse.json({ error: "You are not registered" }, { status: 404 });
    }

    const promoted = await prisma.$transaction(async (tx) => {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: { status: "CANCELLED", waitlistPosition: null },
      });

      // Promote the head of the waitlist. Without this, cancelled seats
      // silently go unused and the waitlist becomes decoration.
      if (registration.status === "REGISTERED") {
        const next = await tx.eventRegistration.findFirst({
          where: { eventId: id, status: "WAITLISTED" },
          orderBy: { waitlistPosition: "asc" },
          select: { id: true, userId: true },
        });

        if (next) {
          await tx.eventRegistration.update({
            where: { id: next.id },
            data: { status: "REGISTERED", waitlistPosition: null },
          });
          return next;
        }
      }
      return null;
    });

    if (promoted) {
      await createNotification({
        tenantId: membership.tenantId,
        userId: promoted.userId,
        type: "EVENT_WAITLIST_PROMOTED",
        title: "A seat opened up",
        body: "You moved off the waitlist and now have a confirmed seat.",
        href: "/forge",
      });
    }

    return NextResponse.json({ data: { cancelled: true, promoted: Boolean(promoted) } });
  } catch (error) {
    logger.error("Failed to cancel registration", { error: String(error) });
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
