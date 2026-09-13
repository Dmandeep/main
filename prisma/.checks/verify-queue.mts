import { PrismaClient } from "@prisma/client";
import { closeQueues, enqueueMaintenance } from "../../src/lib/queue/enqueue";
import { closeQueueConnection, isQueueEnabled } from "../../src/lib/queue/connection";

/**
 * Proves both halves of the queue contract.
 *
 * The claim this code makes is that the app works identically with and without
 * a broker: with REDIS_URL the work is queued, without it the work still
 * happens, inline. Both halves have to be exercised or the configuration
 * nobody tests is the one that silently loses work.
 *
 * Run twice to check both:
 *   npx tsx --env-file=.env prisma/.checks/verify-queue.mts     (queued)
 *   npx tsx prisma/.checks/verify-queue.mts                     (inline)
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

const tenant = await prisma.tenant.findFirstOrThrow({ select: { id: true } });
console.log(`Queue ${isQueueEnabled() ? "ENABLED (REDIS_URL set)" : "DISABLED (no REDIS_URL)"}\n`);

// ---- 1. Evidence reconcile ------------------------------------------------
// Corrupt the cached counter the way a failed write would, then let the job
// put it back. This is the drift the reconciler exists to catch.
const project = await prisma.project.findFirstOrThrow({
  where: { verifiedEvidenceCount: { gt: 0 } },
  select: { id: true, title: true, verifiedEvidenceCount: true },
});

await prisma.project.update({
  where: { id: project.id },
  data: { verifiedEvidenceCount: 0 },
});
console.log(`corrupted "${project.title}": ${project.verifiedEvidenceCount} -> 0`);

const reconcileResult = await enqueueMaintenance({
  name: "reconcile-evidence",
  data: { tenantId: tenant.id },
});

if ("queued" in reconcileResult && reconcileResult.queued) {
  check("reconcile was queued", true, `job ${reconcileResult.jobId}`);
  console.log("      (a worker must be running for the repair to land)");
} else {
  check("reconcile ran inline", true);

  const after = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    select: { verifiedEvidenceCount: true },
  });
  check(
    "inline reconcile repaired the counter",
    after.verifiedEvidenceCount === project.verifiedEvidenceCount,
    `${after.verifiedEvidenceCount} vs expected ${project.verifiedEvidenceCount}`
  );
}

// Always leave the database as we found it, whichever path ran.
await prisma.project.update({
  where: { id: project.id },
  data: { verifiedEvidenceCount: project.verifiedEvidenceCount },
});

// ---- 2. Waitlist sweep ----------------------------------------------------
const event = await prisma.campusEvent.findFirst({
  where: { status: "SCHEDULED", capacity: { not: null } },
  select: { id: true, title: true, capacity: true },
});

if (!event) {
  console.log("SKIP  no scheduled event with a capacity to sweep");
} else {
  const heldBefore = await prisma.eventRegistration.count({
    where: { eventId: event.id, status: { in: ["REGISTERED", "ATTENDED"] } },
  });
  const waitingBefore = await prisma.eventRegistration.count({
    where: { eventId: event.id, status: "WAITLISTED" },
  });

  console.log(
    `\n"${event.title}": capacity ${event.capacity}, held ${heldBefore}, waiting ${waitingBefore}`
  );

  if (waitingBefore === 0) {
    console.log("SKIP  nobody is waiting");
  } else {
    // Free exactly one seat, so the sweep has something to do and we know
    // precisely how many promotions to expect.
    const victim = await prisma.eventRegistration.findFirstOrThrow({
      where: { eventId: event.id, status: "REGISTERED" },
      select: { id: true, status: true, allocation: true },
    });
    await prisma.eventRegistration.update({
      where: { id: victim.id },
      data: { status: "CANCELLED", waitlistPosition: null },
    });

    const sweep = await enqueueMaintenance({ name: "sweep-waitlists", data: { tenantId: tenant.id } });

    if ("queued" in sweep && sweep.queued) {
      check("sweep was queued", true, `job ${sweep.jobId}`);
    } else {
      const heldAfter = await prisma.eventRegistration.count({
        where: { eventId: event.id, status: { in: ["REGISTERED", "ATTENDED"] } },
      });
      const waitingAfter = await prisma.eventRegistration.count({
        where: { eventId: event.id, status: "WAITLISTED" },
      });

      // Freeing one seat only creates a vacancy if the event was at or under
      // capacity to begin with. A faculty override can leave it above, and the
      // sweep must then promote nobody rather than pushing it further over.
      const hadVacancy = heldBefore - 1 < event.capacity!;

      if (hadVacancy) {
        check(
          "sweep promoted exactly one person into the freed seat",
          heldAfter === heldBefore && waitingAfter === waitingBefore - 1,
          `held ${heldBefore} -> ${heldAfter}, waiting ${waitingBefore} -> ${waitingAfter}`
        );
      } else {
        check(
          "sweep promoted nobody into an event still over capacity",
          waitingAfter === waitingBefore,
          `capacity ${event.capacity}, held ${heldBefore} -> ${heldAfter}`
        );
      }

      // Waitlist positions must be a dense 1..n, or a student is told they are
      // "number 7" with three people ahead of them.
      const remaining = await prisma.eventRegistration.findMany({
        where: { eventId: event.id, status: "WAITLISTED" },
        orderBy: { waitlistPosition: "asc" },
        select: { waitlistPosition: true },
      });
      check(
        "waitlist positions are renumbered densely",
        remaining.every((r, i) => r.waitlistPosition === i + 1),
        remaining.map((r) => r.waitlistPosition).join(",")
      );
    }

    // Restore the seat we cancelled.
    await prisma.eventRegistration.update({
      where: { id: victim.id },
      data: { status: victim.status, allocation: victim.allocation },
    });
  }
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);

await closeQueues();
await closeQueueConnection();
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
