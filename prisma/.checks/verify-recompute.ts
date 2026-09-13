import { PrismaClient } from "@prisma/client";
import { recomputeStanding } from "../../src/lib/standing/recompute";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();

  // Deliberately corrupt the cache the way a failed write would.
  const victim = await prisma.standing.findFirstOrThrow({
    orderBy: { points: "desc" },
    select: { id: true, membershipId: true, points: true, rank: true },
  });
  await prisma.standing.update({
    where: { id: victim.id },
    data: { points: 99999, rank: 999, tier: "BRONZE" },
  });
  console.log(`corrupted: points ${victim.points} -> 99999, rank ${victim.rank} -> 999`);

  const result = await recomputeStanding(tenant.id);
  console.log(`recomputed ${result?.membershipsUpdated} memberships, drift found: ${result?.drifted.length}`);

  const fixed = await prisma.standing.findUniqueOrThrow({
    where: { id: victim.id },
    select: { points: true, rank: true, tier: true },
  });
  console.log(`after: points=${fixed.points} rank=${fixed.rank} tier=${fixed.tier}`);
  console.log(`points restored from ledger: ${fixed.points === victim.points ? "PASS" : "FAIL"}`);

  // Ranks must be dense, 1..n, with no duplicates.
  const all = await prisma.standing.findMany({
    where: { membership: { tenantId: tenant.id } },
    select: { rank: true, points: true },
    orderBy: { rank: "asc" },
  });
  const ranks = all.map(r => r.rank);
  const dense = ranks.every((r, i) => r === i + 1);
  const ordered = all.every((r, i) => i === 0 || all[i-1]!.points >= r.points);
  console.log(`ranks 1..${all.length} dense: ${dense ? "PASS" : "FAIL"}`);
  console.log(`ranks ordered by points: ${ordered ? "PASS" : "FAIL"}`);

  // Idempotency: run twice, expect no further drift.
  const second = await recomputeStanding(tenant.id);
  console.log(`second run drift (must be 0): ${second?.drifted.length}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
