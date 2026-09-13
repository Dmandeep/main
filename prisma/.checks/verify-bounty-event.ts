import { PrismaClient } from "@prisma/client";
import { claimEligibility } from "../../src/lib/bounties/select";
import { POINTS } from "../../src/lib/standing/rules";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();

  // ---- Bounty eligibility matrix -------------------------------------
  const reserved = await prisma.bounty.findFirstOrThrow({
    where: { tenantId: tenant.id, reservedForNewcomers: true },
    include: { poster: true, submissions: { include: { user: true } } },
  });

  const newcomer = await prisma.standing.findFirstOrThrow({
    where: { points: 0 }, include: { membership: { include: { user: true } } },
  });
  const ranked = await prisma.standing.findFirstOrThrow({
    orderBy: { points: "desc" }, include: { membership: { include: { user: true } } },
  });

  const mk = (viewerId: string, isNew: boolean) =>
    claimEligibility({
      bounty: reserved as never,
      submissionCount: reserved.submissions.length,
      viewerId, viewerIsNewcomer: isNew, viewerHasSubmitted: false,
    });

  console.log(`Reserved bounty: "${reserved.title}"  reward=${reserved.rewardPoints}`);
  const a = mk(newcomer.membership.userId, true);
  const b = mk(ranked.membership.userId, false);
  const c = mk(reserved.posterId, false);
  console.log(`  newcomer (${newcomer.points}pts) canClaim=${a.canClaim}`);
  console.log(`  ranked   (${ranked.points}pts) canClaim=${b.canClaim} reason=${b.reason}`);
  console.log(`     -> "${b.message}"`);
  console.log(`  poster   canClaim=${c.canClaim} reason=${c.reason}`);

  console.log(`\nReward is system-owned, not caller-supplied: POINTS.BOUNTY_COMPLETED=${POINTS.BOUNTY_COMPLETED}`);

  // ---- Allocation roster maths ---------------------------------------
  const ev = await prisma.campusEvent.findFirstOrThrow({ where: { status: "SCHEDULED" } });
  const regs = await prisma.eventRegistration.findMany({ where: { eventId: ev.id } });
  const held = regs.filter(r => r.status === "REGISTERED");
  const quotaSeats = ev.capacity === null ? null : Math.floor(ev.capacity * ev.newcomerQuotaPercent / 100);
  const quotaUsed = held.filter(r => r.allocation === "NEWCOMER_QUOTA").length;

  console.log(`\nEvent "${ev.title}"  capacity=${ev.capacity} quota=${ev.newcomerQuotaPercent}%`);
  console.log(`  quotaSeats=${quotaSeats} quotaUsed=${quotaUsed} unfilled=${quotaSeats! - quotaUsed}`);
  console.log(`  seatsHeld=${held.length} waitlisted=${regs.filter(r=>r.status==="WAITLISTED").length}`);
  console.log(`  newcomerShare=${Math.round(quotaUsed / held.length * 100)}%  (quota promised ${ev.newcomerQuotaPercent}%)`);
  const honoured = quotaUsed >= Math.min(quotaSeats!, held.length) || quotaUsed === quotaSeats;
  console.log(`  quota honoured: ${honoured ? "PASS" : "FAIL"}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
