import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Campus events.
 *
 * PROPOSED events are pure demand signal: a student proposed it and others
 * voted. Vote weight is one person one vote regardless of standing, so the
 * agenda cannot be bought by the already-ranked.
 */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const events = await prisma.campusEvent.findMany({
      where: {
        tenantId: membership.tenantId,
        ...(status
          ? { status: status.toUpperCase() as Prisma.CampusEventWhereInput["status"] }
          : {}),
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        track: true,
        status: true,
        startsAt: true,
        endsAt: true,
        location: true,
        capacity: true,
        newcomerQuotaPercent: true,
        _count: { select: { demandVotes: true } },
        // Seats held, not rows written. Counting every registration row
        // includes the waitlist and cancellations, which reports an event as
        // over capacity ("24 of 20 taken") and drives seatsLeft to zero while
        // seats are in fact free.
        registrations: {
          where: { status: { in: ["REGISTERED", "ATTENDED"] } },
          select: { id: true },
        },
        demandVotes: { where: { userId: membership.userId }, select: { id: true } },
      },
    });

    // The viewer's own registration is fetched separately: Prisma cannot select
    // the same relation twice with two different filters, and the seat count
    // above must stay filtered to seats actually held.
    const mine = await prisma.eventRegistration.findMany({
      where: { userId: membership.userId, eventId: { in: events.map((e) => e.id) } },
      select: { eventId: true, status: true, allocation: true, waitlistPosition: true },
    });
    const byEvent = new Map(mine.map((r) => [r.eventId, r]));

    return NextResponse.json({
      data: events.map((e) => ({
        _id: e.id,
        title: e.title,
        description: e.description,
        kind: e.kind.toLowerCase(),
        track: e.track ?? undefined,
        status: e.status.toLowerCase(),
        scheduledAt: e.startsAt?.toISOString() ?? null,
        endsAt: e.endsAt?.toISOString() ?? null,
        location: e.location ?? undefined,
        capacity: e.capacity,
        newcomerQuotaPercent: e.newcomerQuotaPercent,
        demandVotes: e._count.demandVotes,
        registered: e.registrations.length,
        seatsLeft:
          e.capacity === null ? null : Math.max(e.capacity - e.registrations.length, 0),
        viewerHasVoted: e.demandVotes.length > 0,
        viewerRegistration: byEvent.has(e.id)
          ? {
              status: byEvent.get(e.id)!.status.toLowerCase(),
              allocation: byEvent.get(e.id)!.allocation,
              waitlistPosition: byEvent.get(e.id)!.waitlistPosition,
            }
          : null,
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch events", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

/**
 * Toggle a demand vote on a proposed event.
 *
 * Unique on (eventId, userId) in the database, so ballot-stuffing is a
 * constraint violation rather than something a handler has to remember to check.
 */
export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "event:create",
      membership.userId,
      "You are creating events too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { eventId, note } = await req.json();
    if (typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const event = await prisma.campusEvent.findFirst({
      where: { id: eventId, tenantId: membership.tenantId },
      select: { id: true, status: true },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const existing = await prisma.eventDemandVote.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: membership.userId } },
      select: { id: true },
    });

    if (existing) {
      await prisma.eventDemandVote.delete({ where: { id: existing.id } });
    } else {
      await prisma.eventDemandVote.create({
        data: {
          eventId: event.id,
          userId: membership.userId,
          note: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
        },
      });
    }

    const votes = await prisma.eventDemandVote.count({ where: { eventId: event.id } });
    return NextResponse.json({ data: { voted: !existing, demandVotes: votes } });
  } catch (error) {
    logger.error("Failed to toggle demand vote", { error: String(error) });
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 });
  }
}

/** Roles that may schedule an event or promote a proposal. */
const ORGANISER_ROLES = ["FACULTY", "ADMIN", "MENTOR", "ALUMNI"] as const;

const createEventSchema = z
  .object({
    title: z.string().min(8).max(140),
    description: z.string().min(30, "Say what happens and who it is for.").max(2000),
    kind: z.enum(["WORKSHOP", "HACKATHON", "TALK", "BOOTCAMP", "DEMO_DAY", "REVIEW_CLINIC"]),
    track: z.string().max(60).optional(),
    /// Omit both dates to create a PROPOSED event: a demand signal students vote on.
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    location: z.string().max(160).optional(),
    /// Null means unlimited. A number switches on allocation and the waitlist.
    capacity: z.number().int().min(1).max(5000).nullable().default(null),
    newcomerQuotaPercent: z.number().int().min(0).max(100).default(40),
  })
  .refine((v) => !v.endsAt || !v.startsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "The event cannot end before it starts.",
    path: ["endsAt"],
  });

/**
 * Create an event, or a proposal.
 *
 * An event with no start date is a PROPOSED event — it carries demand votes
 * and nothing else. Scheduling it is a separate act by someone who owns a room
 * and a slot, which is how it works on an actual campus.
 */
export async function PUT(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createEventSchema.parse(body);
    const scheduling = Boolean(data.startsAt);

    // Anyone may propose. Only organisers may put a date and a room on it.
    if (scheduling && !ORGANISER_ROLES.includes(membership.role as (typeof ORGANISER_ROLES)[number])) {
      return NextResponse.json(
        { error: "Only faculty, mentors, alumni and admins can schedule events. You can propose one instead." },
        { status: 403 }
      );
    }

    if (data.startsAt && new Date(data.startsAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "That start time is in the past." }, { status: 422 });
    }

    const event = await prisma.campusEvent.create({
      data: {
        tenantId: membership.tenantId,
        title: data.title,
        description: data.description,
        kind: data.kind,
        track: data.track || null,
        status: scheduling ? "SCHEDULED" : "PROPOSED",
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        location: data.location || null,
        capacity: scheduling ? data.capacity : null,
        newcomerQuotaPercent: data.newcomerQuotaPercent,
      },
      select: { id: true, title: true, status: true, capacity: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        actorId: membership.userId,
        action: scheduling ? "event.scheduled" : "event.proposed",
        targetType: "campus_event",
        targetId: event.id,
        diff: { title: event.title, capacity: event.capacity },
      },
    });

    logger.info("Event created", { eventId: event.id, status: event.status });

    return NextResponse.json({ data: { _id: event.id, ...event } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to create event", { error: String(error) });
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
