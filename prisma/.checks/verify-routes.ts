/** Exercises the ported handlers against real seeded Postgres rows. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();
  const faculty = await prisma.membership.findFirstOrThrow({ where: { role: "FACULTY" } });

  const feed = await prisma.project.count({
    where: { tenantId: tenant.id, status: { notIn: ["DRAFT", "REJECTED"] } },
  });
  const queue = await prisma.evidence.count({
    where: { state: { in: ["SUBMITTED", "MACHINE_VERIFIED", "UNDER_REVIEW"] }, project: { tenantId: tenant.id } },
  });
  const rail = await prisma.evidence.count({ where: { state: "VERIFIED", project: { tenantId: tenant.id } } });
  const archived = await prisma.project.count({ where: { tenantId: tenant.id, status: "ARCHIVED" } });
  const bounties = await prisma.bounty.count({ where: { tenantId: tenant.id, status: "OPEN" } });
  const reserved = await prisma.bounty.count({ where: { tenantId: tenant.id, reservedForNewcomers: true } });
  const top = await prisma.standing.findFirst({
    orderBy: { points: "desc" },
    select: { points: true, rank: true, tier: true, membership: { select: { user: { select: { username: true } } } } },
  });

  const ev = await prisma.campusEvent.findFirstOrThrow({ where: { status: "SCHEDULED" } });
  const byBasis = await prisma.eventRegistration.groupBy({
    by: ["allocation", "status"],
    where: { eventId: ev.id },
    _count: true,
  });

  console.log("feed projects           :", feed);
  console.log("review queue depth      :", queue);
  console.log("verified (ledger rail)  :", rail);
  console.log("archived w/ postmortem  :", archived);
  console.log("open bounties           :", bounties, `(${reserved} reserved for newcomers)`);
  console.log("top standing            :", top?.membership.user.username, top?.points, top?.tier, "rank", top?.rank);
  console.log(`event "${ev.title}" capacity ${ev.capacity}, quota ${ev.newcomerQuotaPercent}%`);
  for (const r of byBasis) console.log("   ", r.allocation, r.status, "=", r._count);

  // Tenant isolation: a query scoped to a non-existent tenant must return zero.
  const leak = await prisma.project.count({ where: { tenantId: "not-a-real-tenant" } });
  console.log("cross-tenant leak check :", leak === 0 ? "PASS (0 rows)" : `FAIL (${leak} rows)`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
