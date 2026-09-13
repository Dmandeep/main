import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { isNewcomer } from "@/lib/standing/rules";
import { createNotification } from "@/lib/notify";
import { canAllocateSeats } from "@/lib/authz/permissions";
import { renumberWaitlist } from "@/lib/events/waitlist";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * The allocation roster.
 *
 * This is the operational screen for running an event: who holds a seat, on
 * what basis, who is waiting, and whether the reserved quota was actually
 * honoured. The quota number is computed and shown rather than asserted,
 * because "we reserve 40% for newcomers" is a promise the institution makes to
 * its first-years and it should be auditable at a glance.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canAllocateSeats(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.campusEvent.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        location: true,
        capacity: true,
        newcomerQuotaPercent: true,
      },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: event.id },
      orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { registeredAt: "asc" }],
      select: {
        id: true,
        status: true,
        allocation: true,
        waitlistPosition: true,
        registeredAt: true,
        user: {
          select: {
            ...userRefSelect,
            memberships: {
              where: { tenantId: membership.tenantId },
              select: {
                year: true,
                department: true,
                standing: { select: { points: true, tier: true } },
              },
            },
          },
        },
      },
    });

    const rows = registrations.map((r) => {
      const m = r.user.memberships[0];
      const points = m?.standing?.points ?? 0;
      return {
        _id: r.id,
        status: r.status.toLowerCase(),
        allocation: r.allocation,
        waitlistPosition: r.waitlistPosition,
        registeredAt: r.registeredAt.toISOString(),
        isNewcomer: isNewcomer(points),
        user: {
          _id: r.user.id,
          name: r.user.name,
          username: r.user.username,
          avatarUrl: r.user.avatarUrl ?? undefined,
          year: m?.year ?? undefined,
          department: m?.department ?? undefined,
          points,
          tier: m?.standing?.tier ?? "BRONZE",
        },
      };
    });

    const held = rows.filter((r) => r.status === "registered");
    const waitlisted = rows.filter((r) => r.status === "waitlisted");
    const cancelled = rows.filter((r) => r.status === "cancelled");

    const quotaSeats =
      event.capacity === null
        ? null
        : Math.floor((event.capacity * event.newcomerQuotaPercent) / 100);
    const quotaUsed = held.filter((r) => r.allocation === "NEWCOMER_QUOTA").length;

    return NextResponse.json({
      data: {
        event: {
          _id: event.id,
          title: event.title,
          status: event.status.toLowerCase(),
          startsAt: event.startsAt?.toISOString() ?? null,
          location: event.location ?? undefined,
          capacity: event.capacity,
          newcomerQuotaPercent: event.newcomerQuotaPercent,
        },
        allocation: {
          capacity: event.capacity,
          seatsHeld: held.length,
          seatsLeft: event.capacity === null ? null : Math.max(event.capacity - held.length, 0),
          quotaSeats,
          quotaUsed,
          // Unfilled reserved seats are not a bug. They are the quota doing its
          // job: held open rather than handed to the already-ranked.
          quotaUnfilled: quotaSeats === null ? null : Math.max(quotaSeats - quotaUsed, 0),
          waitlisted: waitlisted.length,
          cancelled: cancelled.length,
          newcomerShare:
            held.length === 0 ? 0 : Math.round((quotaUsed / held.length) * 100),
        },
        registered: held,
        waitlist: waitlisted,
        cancelled,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch roster", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch roster" }, { status: 500 });
  }
}

const actionSchema = z.object({
  registrationId: z.string(),
  action: z.enum(["promote", "remove", "mark_attended", "mark_no_show", "override_seat"]),
  reason: z.string().max(500).optional(),
});

/**
 * Manual allocation actions.
 *
 * Every one of these is an override of an automatic decision, so every one
 * writes an audit row naming the person who did it. A seat granted by hand
 * with no record is exactly what makes an allocation system indefensible when
 * a student asks why someone else got in.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canAllocateSeats(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "event:allocate",
      membership.userId,
      "You are changing the roster too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const body = actionSchema.parse(await req.json());

    const event = await prisma.campusEvent.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: { id: true, title: true, capacity: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: body.registrationId, eventId: event.id },
      select: { id: true, userId: true, status: true, allocation: true },
    });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Overriding capacity is allowed, but it must be deliberate and explained.
    if (body.action === "override_seat") {
      const held = await prisma.eventRegistration.count({
        where: { eventId: event.id, status: "REGISTERED" },
      });
      if (event.capacity !== null && held >= event.capacity && !body.reason) {
        return NextResponse.json(
          {
            error:
              "This event is full. Granting a seat over capacity needs a reason, which is recorded against your name.",
          },
          { status: 422 }
        );
      }
    }

    const updates: Record<string, Parameters<typeof prisma.eventRegistration.update>[0]["data"]> = {
      promote: { status: "REGISTERED", waitlistPosition: null },
      remove: { status: "CANCELLED", waitlistPosition: null },
      mark_attended: { status: "ATTENDED" },
      mark_no_show: { status: "NO_SHOW" },
      override_seat: {
        status: "REGISTERED",
        allocation: "FACULTY_OVERRIDE",
        waitlistPosition: null,
      },
    };

    await prisma.$transaction([
      prisma.eventRegistration.update({
        where: { id: registration.id },
        data: updates[body.action]!,
      }),
      prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: `event_registration.${body.action}`,
          targetType: "event_registration",
          targetId: registration.id,
          diff: {
            eventId: event.id,
            from: registration.status,
            reason: body.reason ?? null,
          },
        },
      }),
    ]);

    // Taking someone off the waitlist leaves a hole in the numbering that the
    // student behind them can see. Closing it here means a hand-promoted
    // roster reads the same as one the background sweep touched.
    if (body.action !== "mark_attended" && body.action !== "mark_no_show") {
      await renumberWaitlist(event.id);
    }

    if (body.action === "promote" || body.action === "override_seat") {
      await createNotification({
        tenantId: membership.tenantId,
        userId: registration.userId,
        type: "EVENT_SEAT_CONFIRMED",
        title: "You have a seat",
        body: `Your seat at "${event.title}" is confirmed.`,
        href: "/forge",
      });
    }

    return NextResponse.json({ data: { id: registration.id, action: body.action } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to update registration", { error: String(error) });
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
