import { prisma } from "@/lib/prisma";

/**
 * Renumber an event's waitlist to a dense 1..n.
 *
 * Every path that takes someone off a waitlist leaves a hole: a promotion, a
 * removal, a cancellation. A student then sees "number 7" with three people
 * ahead of them, which reads as the queue being rigged rather than stale.
 *
 * Shared deliberately. This was originally done only inside the background
 * sweep, so a faculty member promoting someone by hand from the roster left
 * the remaining positions starting at 2 — the queue was correct in order and
 * wrong in every number it showed.
 */
export async function renumberWaitlist(eventId: string): Promise<number> {
  const waiting = await prisma.eventRegistration.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ waitlistPosition: "asc" }, { registeredAt: "asc" }],
    select: { id: true, waitlistPosition: true },
  });

  let changed = 0;

  for (let i = 0; i < waiting.length; i++) {
    const expected = i + 1;
    const row = waiting[i]!;
    if (row.waitlistPosition === expected) continue;

    await prisma.eventRegistration.update({
      where: { id: row.id },
      data: { waitlistPosition: expected },
    });
    changed++;
  }

  return changed;
}
